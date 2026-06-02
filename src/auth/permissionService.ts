import { getGraphClient } from '../services/graph';
import { sharePointConfig } from '../authConfig';
import { getSiteId } from '../services/sharepoint';
import { MenuKey, ALL_MENU_KEYS } from '../constants/menus';
import { Role } from './constants';

export interface UserPermission {
    email: string;
    displayName: string;
    role: Role;
    allowedMenus: MenuKey[];
    isActive: boolean;
}

export interface UserPermissionRecord extends UserPermission {
    spItemId: string;
    remarks: string;
}

interface SharePointUserPermission {
    Title?: string;
    FullName?: string;
    Role?: string;
    AllowedMenus?: string;
    IsActive?: boolean;
    Remarks?: string;
}

const VALID_MENU_KEYS = new Set<string>(ALL_MENU_KEYS);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const parseAllowedMenus = (csv: string | undefined): MenuKey[] => {
    if (!csv) return [];
    return csv
        .split(',')
        .map(s => s.trim())
        .filter(s => VALID_MENU_KEYS.has(s)) as MenuKey[];
};

const serializeAllowedMenus = (menus: MenuKey[]): string => menus.join(',');

const sanitizeOdataString = (s: string): string => s.replace(/'/g, "''");

const mapItemToRecord = (
    item: { id: string; fields: SharePointUserPermission },
): UserPermissionRecord => {
    const role: Role = item.fields.Role === 'ADMIN' ? 'ADMIN' : 'USER';
    const allowedMenus: MenuKey[] =
        role === 'ADMIN' ? [...ALL_MENU_KEYS] : parseAllowedMenus(item.fields.AllowedMenus);
    return {
        spItemId: item.id,
        email: normalizeEmail(item.fields.Title || ''),
        displayName: item.fields.FullName || '',
        role,
        allowedMenus,
        isActive: item.fields.IsActive !== false,
        remarks: item.fields.Remarks || '',
    };
};

export const fetchUserPermission = async (
    email: string,
): Promise<UserPermission | null> => {
    const normalizedEmail = normalizeEmail(email);
    const client = await getGraphClient();
    const sId = await getSiteId();
    const listName = sharePointConfig.listNames.userPermissions;

    const response = await client
        .api(`/sites/${sId}/lists/${listName}/items`)
        .expand('fields')
        .filter(`fields/Title eq '${sanitizeOdataString(normalizedEmail)}'`)
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .top(1)
        .get();

    const items: Array<{ id: string; fields: SharePointUserPermission }> = response.value || [];
    if (items.length === 0) return null;
    const rec = mapItemToRecord(items[0]);
    return {
        email: rec.email,
        displayName: rec.displayName,
        role: rec.role,
        allowedMenus: rec.allowedMenus,
        isActive: rec.isActive,
    };
};

export const fetchAllUserPermissions = async (): Promise<UserPermissionRecord[]> => {
    const client = await getGraphClient();
    const sId = await getSiteId();
    const listName = sharePointConfig.listNames.userPermissions;

    let allItems: Array<{ id: string; fields: SharePointUserPermission }> = [];
    let response = await client
        .api(`/sites/${sId}/lists/${listName}/items`)
        .expand('fields')
        .top(5000)
        .get();

    allItems = allItems.concat(response.value || []);
    while (response['@odata.nextLink']) {
        response = await client.api(response['@odata.nextLink']).get();
        allItems = allItems.concat(response.value || []);
    }

    return allItems
        .map(mapItemToRecord)
        .filter(r => r.email.length > 0)
        .sort((a, b) => a.email.localeCompare(b.email));
};

export interface UserPermissionInput {
    email: string;
    displayName: string;
    role: Role;
    allowedMenus: MenuKey[];
    isActive: boolean;
    remarks?: string;
}

export const createUserPermission = async (input: UserPermissionInput): Promise<void> => {
    const client = await getGraphClient();
    const sId = await getSiteId();
    const listName = sharePointConfig.listNames.userPermissions;

    const fields: SharePointUserPermission = {
        Title: normalizeEmail(input.email),
        FullName: input.displayName,
        Role: input.role,
        AllowedMenus: serializeAllowedMenus(input.allowedMenus),
        IsActive: input.isActive,
        Remarks: input.remarks || '',
    };

    await client.api(`/sites/${sId}/lists/${listName}/items`).post({ fields });
};



export const updateUserPermission = async (
    spItemId: string,
    input: UserPermissionInput,
): Promise<void> => {
    const client = await getGraphClient();
    const sId = await getSiteId();
    const listName = sharePointConfig.listNames.userPermissions;

    const fields: SharePointUserPermission = {
        Title: normalizeEmail(input.email),
        FullName: input.displayName,
        Role: input.role,
        AllowedMenus: serializeAllowedMenus(input.allowedMenus),
        IsActive: input.isActive,
        Remarks: input.remarks || '',
    };

    await client.api(`/sites/${sId}/lists/${listName}/items/${spItemId}`).patch({ fields });
};

export const deleteUserPermission = async (spItemId: string): Promise<void> => {
    const client = await getGraphClient();
    const sId = await getSiteId();
    const listName = sharePointConfig.listNames.userPermissions;
    await client.api(`/sites/${sId}/lists/${listName}/items/${spItemId}`).delete();
};
