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
