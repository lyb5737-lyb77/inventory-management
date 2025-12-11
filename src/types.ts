// 제품그룹 (Product Group) 인터페이스
export interface ProductGroup {
    id: string;
    name: string;
    description?: string;
}

// 창고 (Warehouse) 인터페이스
export interface Warehouse {
    id: string;
    name: string;      // 창고명
    location: string;  // 창고위치
    manager: string;   // 담당자
    email: string;     // E-mail
    remarks: string;   // 비고
}

// 출고처 (Customer) 인터페이스
export interface Customer {
    id: string;
    douzoneNumber: string; // 더존번호
    name: string;          // 이름
    contact: string;       // 연락처
    email: string;         // 이메일
    address: string;       // 주소
    remarks: string;       // 비고
}

// 품목 (Item) 인터페이스
export interface Item {
    id: string;
    name: string; // 품명
    group: string; // 제품그룹
    warehouse: string; // 창고 (기본값: "비트본사")
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
    warehouse: string; // 창고
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
