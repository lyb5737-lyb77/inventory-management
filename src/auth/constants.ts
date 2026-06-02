export const BOOTSTRAP_ADMINS: string[] = [
    'lyb77@bit.kr',
    'show@bit.kr',
];

export const PERMISSION_CACHE_TTL_MS = 5 * 60 * 1000;

export const PERMISSION_CACHE_KEY = 'bit_user_permission_v1';

export type Role = 'ADMIN' | 'USER';
