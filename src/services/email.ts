import emailjs from '@emailjs/browser';
import { getMailSettings, MailSettings } from './settings';

interface OutboundEmailData {
    warehouseName: string;
    managerEmail: string;
    items: Array<{
        name: string;
        quantity: number;
    }>;
    customerName: string;
    customerAddress: string;
    customerContact: string;
    requesterName: string;
    remarks: string;
}

export const sendOutboundEmail = async (data: OutboundEmailData): Promise<void> => {
    const cfg = await getMailSettings();

    if (!cfg.enabled) {
        console.warn('메일 발송이 비활성화되어 있어 발송을 건너뜁니다.');
        return;
    }

    try {
        // 품목 목록을 문자열로 변환
        const itemList = data.items
            .map(item => `${item.name} x${item.quantity}`)
            .join(', ');

        // EmailJS 템플릿 파라미터
        const templateParams = {
            warehouse_name: data.warehouseName,
            manager_email: data.managerEmail,
            item_list: itemList, // 여러 품목을 하나의 문자열로
            customer_name: data.customerName,
            customer_address: data.customerAddress,
            customer_contact: data.customerContact,
            requester_name: data.requesterName,
            remarks: data.remarks || '없음',
            to_email: data.managerEmail, // 수신자 이메일
            from_name: cfg.fromName,
            cc_email: cfg.ccEmail,
        };

        console.log('Sending email with params:', templateParams);

        const response = await emailjs.send(
            cfg.serviceId,
            cfg.templateId,
            templateParams,
            cfg.publicKey
        );

        console.log('Email sent successfully:', response);
    } catch (error: any) {
        console.error('Error sending email:', error);
        throw new Error(`이메일 발송 실패: ${error.text || error.message}`);
    }
};

// 설정 페이지용 테스트 발송 (저장 전 폼 값으로도 테스트 가능하도록 settings 인자 허용)
export const sendTestEmail = async (toEmail: string, settings?: MailSettings): Promise<void> => {
    const cfg = settings || await getMailSettings();
    try {
        const templateParams = {
            warehouse_name: '테스트 발송',
            manager_email: toEmail,
            to_email: toEmail,
            item_list: '테스트 품목 x1',
            customer_name: cfg.fromName || 'BIT 관리 시스템',
            customer_address: '-',
            customer_contact: '-',
            requester_name: cfg.fromName || 'BIT 관리 시스템',
            remarks: 'EmailJS 설정 테스트 메일입니다.',
            from_name: cfg.fromName,
            cc_email: cfg.ccEmail,
        };

        await emailjs.send(cfg.serviceId, cfg.templateId, templateParams, cfg.publicKey);
    } catch (error: any) {
        console.error('Test email error:', error);
        throw new Error(`테스트 메일 발송 실패: ${error.text || error.message}`);
    }
};
