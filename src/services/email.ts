import emailjs from '@emailjs/browser';

// EmailJS 설정
const EMAILJS_SERVICE_ID = 'service_iw7m5s6';
const EMAILJS_TEMPLATE_ID = 'template_liqrmaa';
const EMAILJS_PUBLIC_KEY = 'J8-0xoUen8g9u3pMf';

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
        };

        console.log('Sending email with params:', templateParams);

        // EmailJS로 이메일 전송
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            EMAILJS_PUBLIC_KEY
        );

        console.log('Email sent successfully:', response);
    } catch (error: any) {
        console.error('Error sending email:', error);
        throw new Error(`이메일 발송 실패: ${error.text || error.message}`);
    }
};

