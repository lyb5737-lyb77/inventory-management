// 제품그룹 (Product Group) 인터페이스
export interface ProductGroup {
    id: string;
    name: string;
    description?: string;
}

// 품목 (Item) 인터페이스
export interface Item {
    id: string;
    name: string; // 품명
    group: string; // 제품그룹
    partNumber: string; // 품번
    quantity: number; // 현재고
    price: number; // 가격
    remarks: string; // 비고
}

// 거래 (Transaction) 인터페이스
export interface Transaction {
    id: string;
    itemId: string;
    itemName: string; // 검색 편의를 위해 추가
    type: 'IN' | 'OUT'; // 입고 | 출고
    quantity: number;
    date: string; // ISO date string
    target?: string; // 출고처 (출고시만)
    remarks: string; // 비고
}

// 임대 (Rental) 인터페이스
export interface Rental {
    id: string;
    type: string; // 구분 (직원, 일반인)
    ho: string; // 호수 (고정)
    area: string; // 면적 (고정)
    tenantName: string; // 상호/성명
    contact: string; // 연락처
    email: string; // 이메일
    rentalType: string; // 임대형태 (월세, 전세, 반전세)
    deposit: number; // 보증금
    monthlyRent: number; // 월임대료
    maintenanceFee: number; // 월관리비
    parkingFee: number; // 주차비
    paymentDate: string; // 입금날짜
    contractStartDate: string; // 계약시작일
    contractEndDate: string; // 계약종료일
    remarks: string; // 비고
}
