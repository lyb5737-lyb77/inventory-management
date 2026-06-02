import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { MenuKey, ALL_MENU_KEYS } from '../constants/menus';
import { UserPermission, fetchUserPermission } from './permissionService';
import { BOOTSTRAP_ADMINS, PERMISSION_CACHE_KEY, PERMISSION_CACHE_TTL_MS, Role } from './constants';

interface AuthContextValue {
    email: string;
    displayName: string;
    role: Role | null;
    allowedMenus: Set<MenuKey>;
    isLoading: boolean;
    isReady: boolean;
    hasError: boolean;
    isRegistered: boolean;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface CachedPermission {
    cachedAt: number;
    value: UserPermission | null;
    email: string;
}

const readCache = (email: string): UserPermission | null | undefined => {
    try {
        const raw = sessionStorage.getItem(PERMISSION_CACHE_KEY);
        if (!raw) return undefined;
        const parsed: CachedPermission = JSON.parse(raw);
        if (parsed.email !== email) return undefined;
        if (Date.now() - parsed.cachedAt > PERMISSION_CACHE_TTL_MS) return undefined;
        return parsed.value;
    } catch {
        return undefined;
    }
};

const writeCache = (email: string, value: UserPermission | null) => {
    try {
        const payload: CachedPermission = { cachedAt: Date.now(), value, email };
        sessionStorage.setItem(PERMISSION_CACHE_KEY, JSON.stringify(payload));
    } catch {
        // sessionStorage 사용 불가 환경 — 캐시 없이 진행
    }
};

const isBootstrapAdmin = (email: string): boolean =>
    BOOTSTRAP_ADMINS.map(e => e.toLowerCase()).includes(email);

const buildBootstrapPermission = (email: string, displayName: string): UserPermission => ({
    email,
    displayName,
    role: 'ADMIN',
    allowedMenus: [...ALL_MENU_KEYS],
    isActive: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const { accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();

    const account = accounts[0];
    const rawEmail = account?.username || '';
    const email = rawEmail.trim().toLowerCase();
    const displayName = account?.name || email;

    const [permission, setPermission] = useState<UserPermission | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);

    const load = useCallback(async (skipCache = false) => {
        if (!email) {
            setPermission(null);
            setIsReady(true);
            return;
        }

        if (isBootstrapAdmin(email)) {
            const p = buildBootstrapPermission(email, displayName);
            setPermission(p);
            setHasError(false);
            setIsReady(true);
            return;
        }

        if (!skipCache) {
            const cached = readCache(email);
            if (cached !== undefined) {
                setPermission(cached);
                setHasError(false);
                setIsReady(true);
                return;
            }
        }

        setIsLoading(true);
        setHasError(false);
        try {
            const fetched = await fetchUserPermission(email);
            setPermission(fetched);
            writeCache(email, fetched);
        } catch (err) {
            console.error('[AuthContext] 권한 조회 실패:', err);
            setHasError(true);
            setPermission(null);
        } finally {
            setIsLoading(false);
            setIsReady(true);
        }
    }, [email, displayName]);

    useEffect(() => {
        if (!isAuthenticated) {
            setPermission(null);
            setIsReady(false);
            setHasError(false);
            return;
        }
        load(false);
    }, [isAuthenticated, load]);

    const refresh = useCallback(async () => {
        try {
            sessionStorage.removeItem(PERMISSION_CACHE_KEY);
        } catch {
            // ignore
        }
        await load(true);
    }, [load]);

    const allowedMenus = new Set<MenuKey>(
        permission && permission.isActive ? permission.allowedMenus : [],
    );

    const value: AuthContextValue = {
        email,
        displayName,
        role: permission?.role ?? null,
        allowedMenus,
        isLoading,
        isReady,
        hasError,
        isRegistered: permission !== null && permission.isActive,
        refresh,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
};
