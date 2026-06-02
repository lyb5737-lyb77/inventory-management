import { useAuth } from './AuthContext';
import { MenuKey } from '../constants/menus';

export const usePermission = () => {
    const { allowedMenus, role, isLoading, isReady, hasError, isRegistered, refresh } = useAuth();

    const canAccess = (menuKey: MenuKey): boolean => {
        if (role === 'ADMIN') return true;
        return allowedMenus.has(menuKey);
    };

    return {
        canAccess,
        role,
        isLoading,
        isReady,
        hasError,
        isRegistered,
        refresh,
    };
};
