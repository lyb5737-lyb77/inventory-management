// 업무 계정 비밀번호를 AES-256-GCM으로 암호화·복호화하는 헬퍼 (키는 SiteAccountKeys 리스트에 별도 보관)
export const VAULT_KEY_VERSION = 'v1';

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

export const generateVaultKeyValue = (): string =>
    toBase64(crypto.getRandomValues(new Uint8Array(32)));

const importKey = (keyValue: string): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', fromBase64(keyValue), 'AES-GCM', false, ['encrypt', 'decrypt']);

// 결과 형식은 "v1:" + Base64(IV 12바이트 + 암호문)
export const encryptText = async (keyValue: string, plain: string): Promise<string> => {
    if (!plain) return '';
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, await importKey(keyValue), new TextEncoder().encode(plain),
    );
    const payload = new Uint8Array(iv.length + cipher.byteLength);
    payload.set(iv);
    payload.set(new Uint8Array(cipher), iv.length);
    return `${VAULT_KEY_VERSION}:${toBase64(payload)}`;
};

export const decryptText = async (keyValue: string, payload: string): Promise<string> => {
    if (!payload) return '';
    const [version, data] = payload.split(':');
    if (version !== VAULT_KEY_VERSION || !data) throw new Error('지원하지 않는 암호문 형식입니다.');
    const bytes = fromBase64(data);
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes.slice(0, 12) }, await importKey(keyValue), bytes.slice(12),
    );
    return new TextDecoder().decode(plain);
};
