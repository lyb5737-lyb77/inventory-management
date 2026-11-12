export type MenuKey =
    | 'admin'
    | 'inventory'
    | 'order-register'
    | 'outbound-request'
    | 'rental'
    | 'ip-management'
    | 'equipment';

export interface MenuDef {
    key: MenuKey;
    title: string;
    desc: string;
    subDesc: string;
    icon: string;
    colorClass: string;
    path?: string;        // 내부 라우트. externalUrl이 있으면 생략
    externalUrl?: string; // 지정하면 새 탭으로 외부 주소를 연다
}

export const MENUS: MenuDef[] = [
    {
        key: 'admin',
        title: '관리자 페이지',
        desc: '품목 추가, 수정, 삭제 관리',
        subDesc: '품명, 제품그룹, 품번, 수량, 가격, 비고',
        icon: 'ri-admin-line',
        colorClass: 'from-blue-500 to-blue-600',
        path: '/admin',
    },
    {
        key: 'inventory',
        title: '자재 관리',
        desc: '입출고 관리 및 재고 현황',
        subDesc: '입고, 출고, 재고 검색, 인쇄',
        icon: 'ri-archive-line',
        colorClass: 'from-green-500 to-green-600',
        path: '/inventory',
    },
    {
        key: 'order-register',
        title: '주문 등록',
        desc: '비트몰 주문 접수 및 출고 처리',
        subDesc: '엑셀 업로드, 개별 입력, 출고 신청 연동',
        icon: 'ri-shopping-cart-2-line',
        colorClass: 'from-orange-500 to-orange-600',
        path: '/order-register',
    },
    {
        key: 'outbound-request',
        title: '출고 신청',
        desc: '창고 담당자에게 출고 요청',
        subDesc: '출고 신청, 이메일 발송, 거래 기록',
        icon: 'ri-truck-line',
        colorClass: 'from-pink-500 to-pink-600',
        path: '/outbound-request',
    },
    {
        key: 'rental',
        title: '임대 관리',
        desc: '임대 현황 및 계약 관리',
        subDesc: '임대 현황, 계약 만료 알림, 엑셀 관리',
        icon: 'ri-building-2-line',
        colorClass: 'from-purple-500 to-purple-600',
        path: '/rental',
    },
    {
        key: 'ip-management',
        title: 'IP 관리통제(NAC)',
        desc: '사내 IP 사용 통제 (NAC 관리 콘솔)',
        subDesc: 'MS 계정으로 자동 로그인, 새 탭에서 열림',
        icon: 'ri-shield-check-line',
        colorClass: 'from-cyan-500 to-cyan-600',
        externalUrl: 'https://10.10.10.133:8765/map',
    },
    {
        key: 'equipment',
        title: '장비 관리',
        desc: '업무용 장비 및 이력 관리',
        subDesc: '장비 정보, 사용 이력, QR 코드',
        icon: 'ri-macbook-line',
        colorClass: 'from-indigo-500 to-indigo-600',
        path: '/equipment',
    },
];

export const ALL_MENU_KEYS: MenuKey[] = MENUS.map(m => m.key);

export const ASSIGNABLE_MENU_KEYS: MenuKey[] = [...ALL_MENU_KEYS];
