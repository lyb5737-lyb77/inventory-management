import { Client } from '@microsoft/microsoft-graph-client';
import { msalInstance, sharePointConfig } from '../authConfig';

// Microsoft Graph 클라이언트 생성
export const getGraphClient = async (): Promise<Client> => {
    const account = msalInstance.getAllAccounts()[0];

    if (!account) {
        throw new Error('No account found. Please login first.');
    }

    // 액세스 토큰 획득
    const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: ['Sites.ReadWrite.All'],
        account: account,
    });

    // Graph 클라이언트 생성
    return Client.init({
        authProvider: (done) => {
            done(null, tokenResponse.accessToken);
        },
    });
};

// SharePoint 사이트 ID 가져오기 (캐싱)
let siteId: string | null = null;

export const getSiteId = async (): Promise<string> => {
    if (siteId) return siteId;

    const client = await getGraphClient();
    const urlParts = sharePointConfig.siteUrl.split('/');
    const hostname = urlParts[2];
    const sitePath = '/' + urlParts.slice(3).join('/');

    const site = await client
        .api(`/sites/${hostname}:${sitePath}`)
        .get();

    siteId = site.id;
    return siteId as string;
};

// SharePoint 리스트 아이템 조회
export const getListItems = async <T>(listName: string): Promise<T[]> => {
    try {
        const client = await getGraphClient();
        const sId = await getSiteId();

        const response = await client
            .api(`/sites/${sId}/lists/${listName}/items`)
            .expand('fields')
            .get();

        return response.value.map((item: any) => item.fields);
    } catch (error: any) {
        console.error(`Error fetching list items from ${listName}:`, error);
        throw new Error(`SharePoint 데이터 조회 실패: ${error.message}`);
    }
};

// SharePoint 리스트 아이템 생성
export const createListItem = async <T>(listName: string, data: any): Promise<T> => {
    try {
        const client = await getGraphClient();
        const sId = await getSiteId();

        console.log('Creating list item in:', listName);
        console.log('Data to be sent:', data);

        const response = await client
            .api(`/sites/${sId}/lists/${listName}/items`)
            .post({
                fields: data,
            });

        console.log('Create response:', response);
        return response.fields;
    } catch (error: any) {
        console.error(`Error creating list item in ${listName}:`, error);
        console.error('Error details:', {
            message: error.message,
            statusCode: error.statusCode,
            body: error.body,
            requestId: error.requestId,
        });

        // 더 자세한 에러 메시지 제공
        let errorMessage = `SharePoint 데이터 생성 실패`;
        if (error.statusCode === 400) {
            errorMessage += ': 잘못된 데이터 형식입니다. SharePoint 리스트의 열 이름과 타입을 확인하세요.';
        } else if (error.statusCode === 403) {
            errorMessage += ': 권한이 없습니다.';
        } else if (error.statusCode === 404) {
            errorMessage += `: 리스트 "${listName}"을(를) 찾을 수 없습니다.`;
        } else if (error.message) {
            errorMessage += `: ${error.message}`;
        }

        throw new Error(errorMessage);
    }
};

// SharePoint 리스트 아이템 업데이트
export const updateListItem = async (listName: string, itemId: string, data: any): Promise<void> => {
    try {
        const client = await getGraphClient();
        const sId = await getSiteId();

        await client
            .api(`/sites/${sId}/lists/${listName}/items/${itemId}`)
            .patch({
                fields: data,
            });
    } catch (error: any) {
        console.error(`Error updating list item in ${listName}:`, error);
        throw new Error(`SharePoint 데이터 업데이트 실패: ${error.message}`);
    }
};

// SharePoint 리스트 아이템 삭제
export const deleteListItem = async (listName: string, itemId: string): Promise<void> => {
    try {
        const client = await getGraphClient();
        const sId = await getSiteId();

        await client
            .api(`/sites/${sId}/lists/${listName}/items/${itemId}`)
            .delete();
    } catch (error: any) {
        console.error(`Error deleting list item in ${listName}:`, error);
        throw new Error(`SharePoint 데이터 삭제 실패: ${error.message}`);
    }
};
