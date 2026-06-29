import { getListItems, createListItem, updateListItem } from './sharepoint';
import { sharePointConfig } from '../authConfig';

// 메일(EmailJS) 발송 설정
export interface MailSettings {
    enabled: boolean;     // 메일 발송 사용 여부
    serviceId: string;    // EmailJS Service ID
    templateId: string;   // EmailJS Template ID
    publicKey: string;    // EmailJS Public Key
    fromName: string;     // 발신자 표시명 (template param: from_name)
    ccEmail: string;      // 참조(CC) 이메일 (template param: cc_email, 템플릿이 지원해야 적용)
}

// 기존 하드코딩 값 = 기본값 (AppSettings 리스트가 없거나 비어있을 때 사용)
export const DEFAULT_MAIL_SETTINGS: MailSettings = {
    enabled: true,
    serviceId: 'service_iw7m5s6',
    templateId: 'template_liqrmaa',
    publicKey: 'J8-0xoUen8g9u3pMf',
    fromName: 'BIT 관리 시스템',
    ccEmail: '',
};

const MAIL_KEY = 'emailjs';

interface SpAppSetting {
    id: string;
    Title: string;  // 설정 키
    Value: string;  // JSON 문자열
}

// 동일 세션 내 반복 조회 방지용 캐시
let mailCache: MailSettings | null = null;

export const getMailSettings = async (force = false): Promise<MailSettings> => {
    if (mailCache && !force) return mailCache;
    let result: MailSettings;
    try {
        const items = await getListItems<SpAppSetting>(sharePointConfig.listNames.appSettings);
        const found = items.find(i => i.Title === MAIL_KEY);
        if (found && found.Value) {
            result = { ...DEFAULT_MAIL_SETTINGS, ...JSON.parse(found.Value) };
        } else {
            result = { ...DEFAULT_MAIL_SETTINGS };
        }
    } catch (e) {
        // AppSettings 리스트 미생성 등 → 기본값으로 동작 (메일 발송은 계속 가능)
        console.error('메일 설정 조회 실패, 기본값 사용:', e);
        result = { ...DEFAULT_MAIL_SETTINGS };
    }
    mailCache = result;
    return result;
};

export const saveMailSettings = async (settings: MailSettings): Promise<void> => {
    const listName = sharePointConfig.listNames.appSettings;
    const items = await getListItems<SpAppSetting>(listName);
    const found = items.find(i => i.Title === MAIL_KEY);
    const value = JSON.stringify(settings);

    if (found) {
        await updateListItem(listName, found.id, { Value: value });
    } else {
        await createListItem(listName, { Title: MAIL_KEY, Value: value });
    }
    mailCache = { ...settings };
};

export const clearMailSettingsCache = (): void => {
    mailCache = null;
};
