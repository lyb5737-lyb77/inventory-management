import * as XLSX from 'xlsx';
import { Rental, Order } from '../types';

// 비트몰(닥터비트 온라인몰) 자재 출고 신청서 파싱
// 양식: 1행 제목, 2행 기준일, 3행 헤더(출고일자/거래처코드/거래처명/품번/품명/출고수량/매출단가/결제구분/이메일주소/연락처/배송처...), 4행~ 데이터, 마지막 합계행
export interface ParsedOrderRow {
    orderDate: string;        // 출고일자 = 주문일자
    bizNumber: string;        // 사업자번호
    customerCode: string;     // 거래처코드 (더존번호)
    customerName: string;     // 거래처명
    partNumber: string;       // 품번
    productName: string;      // 품명
    quantity: number;         // 출고수량
    salesUnitPrice: number;   // 매출단가
    paymentType: string;      // 결제구분
    email: string;            // 이메일주소
    contact: string;          // 연락처
    address: string;          // 배송처 = 주소
}

const cellStr = (v: any): string => (v === undefined || v === null) ? '' : String(v).trim();
const cellNum = (v: any): number => {
    if (v === undefined || v === null || v === '') return 0;
    const n = Number(String(v).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
};

// 엑셀 날짜 직렬값/문자 모두 YYYY-MM-DD 로 정규화
const normalizeDate = (v: any): string => {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) {
            const mm = String(d.m).padStart(2, '0');
            const dd = String(d.d).padStart(2, '0');
            return `${d.y}-${mm}-${dd}`;
        }
    }
    return String(v).trim().replace(/\./g, '-').replace(/-+$/, '');
};

// 주문 내역을 비트몰 자재출고 양식(동일 레이아웃)으로 월단위 다운로드
// 우리가 저장하지 않는 매입단가/매입금액/마진은 공란, 매출금액/부가세/합계액은 자동 계산
export const exportOrdersExcel = (orders: Order[], yearMonth: string) => {
    const monthly = orders
        .filter(o => (o.orderDate || '').startsWith(yearMonth))
        .sort((a, b) => (a.orderDate || '').localeCompare(b.orderDate || ''));

    const [y, m] = yearMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // m=1~12 → 해당 월 말일
    const start = `${yearMonth}-01`;
    const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    const header = [
        '출고일자', '사업자번호', '거래처코드', '거래처명', '품번', '품명', '출고수량',
        '매입단가', '매입금액', '매출단가', '매출금액', '부가세', '합계액', '마진',
        '결제구분', '이메일주소', '연락처', '배송처',
    ];

    const dataRows = monthly.map(o => {
        const salesAmount = o.quantity * o.salesUnitPrice;
        const vat = Math.round(salesAmount * 0.1);
        return [
            o.orderDate, o.bizNumber, o.customerCode, o.customerName, o.partNumber, o.productName, o.quantity,
            '', '', o.salesUnitPrice, salesAmount, vat, salesAmount + vat, '',
            o.paymentType, o.email, o.contact, o.address,
        ];
    });

    const sumCol = (idx: number) => dataRows.reduce((acc, r) => acc + (Number(r[idx]) || 0), 0);
    const totalRow = [
        '', '', '', '', '', '합계', sumCol(6),
        '', '', '', sumCol(10), sumCol(11), sumCol(12), '',
        '', '', '', '',
    ];

    const aoa = [
        ['닥터비트 온라인몰 자재 출고 신청서'],
        [`기준일: ${start} ~ ${end}`],
        header,
        ...dataRows,
        totalRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // 제목/기준일 행 병합 (원본 양식과 동일하게 A~R 18열 병합)
    ws['!merges'] = [
        { s: { c: 0, r: 0 }, e: { c: 17, r: 0 } },
        { s: { c: 0, r: 1 }, e: { c: 17, r: 1 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');
    XLSX.writeFile(wb, `비트몰 자재출고 ${yearMonth}.xlsx`);
};

export const readBitmallOrderExcel = (file: File): Promise<ParsedOrderRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];

                // 양식에 따라 제목/기준일/빈 행 수가 달라지므로, 고정 위치 대신
                // '품번' 컬럼을 포함하는 헤더 행을 탐색해 컬럼 인덱스로 매핑한다.
                const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', blankrows: false });

                const headerIdx = aoa.findIndex(row =>
                    row.some(c => cellStr(c) === '품번') &&
                    row.some(c => ['출고일자', '거래처코드', '거래처명'].includes(cellStr(c)))
                );
                if (headerIdx === -1) {
                    resolve([]);
                    return;
                }

                const header = aoa[headerIdx].map(cellStr);
                const col = (...names: string[]): number => {
                    for (const n of names) {
                        const i = header.indexOf(n);
                        if (i !== -1) return i;
                    }
                    return -1;
                };
                const idx = {
                    orderDate: col('출고일자'),
                    bizNumber: col('사업자번호'),
                    customerCode: col('거래처코드'),
                    customerName: col('거래처명'),
                    partNumber: col('품번'),
                    productName: col('품명'),
                    quantity: col('출고수량', '수량'),
                    salesUnitPrice: col('매출단가'),
                    paymentType: col('결제구분'),
                    email: col('이메일주소', '이메일'),
                    contact: col('연락처'),
                    address: col('배송처', '주소'),
                };
                const at = (row: any[], i: number) => (i >= 0 ? row[i] : '');

                const rows: ParsedOrderRow[] = aoa.slice(headerIdx + 1)
                    .map((row) => ({
                        orderDate: normalizeDate(at(row, idx.orderDate)),
                        bizNumber: cellStr(at(row, idx.bizNumber)),
                        customerCode: cellStr(at(row, idx.customerCode)),
                        customerName: cellStr(at(row, idx.customerName)),
                        partNumber: cellStr(at(row, idx.partNumber)),
                        productName: cellStr(at(row, idx.productName)),
                        quantity: cellNum(at(row, idx.quantity)),
                        salesUnitPrice: cellNum(at(row, idx.salesUnitPrice)),
                        paymentType: cellStr(at(row, idx.paymentType)),
                        email: cellStr(at(row, idx.email)),
                        contact: cellStr(at(row, idx.contact)),
                        address: cellStr(at(row, idx.address)),
                    }))
                    // 합계행/빈행 제외: 품번이 없거나 품명이 '합계'인 행
                    .filter(r => r.partNumber && r.productName !== '합계');

                resolve(rows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const readRentalExcel = (file: File): Promise<Rental[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // 2번째 행부터 읽기 (첫 번째 행은 제목, 두 번째 행은 헤더)
                const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', range: 2 });

                // 데이터 매핑 및 변환
                const rentals: Rental[] = jsonData.map((row: any, index: number) => ({
                    id: `rental-${Date.now()}-${index}`,
                    type: (row['__EMPTY'] || row['구분'] || '').toString().trim(), // 구분은 __EMPTY 컬럼에 있음
                    ho: (row['호수'] || row['호실'] || '').toString(),
                    area: (row['임대면적'] || row['면적'] || '').toString(),
                    tenantName: (row['사용인/임대인'] || row['상호/성명'] || row['임대인'] || '').toString().trim(),
                    contact: (row['연락처'] || '').toString().trim(),
                    email: (row['e-mail'] || row['Email'] || row['이메일'] || '').toString().trim(),
                    rentalType: (row[' 임대     형태 '] || row['임대형태'] || '').toString().trim(),
                    deposit: Number(row[' 보증금 '] || row['보증금'] || 0),
                    monthlyRent: Number(row[' 월임대료 '] || row['월임대료'] || 0),
                    maintenanceFee: Number(row[' 월관리비 '] || row['관리비'] || row['월관리비'] || 0),
                    parkingFee: Number(row[' 주차비 '] || row['주차비'] || 0),
                    paymentDate: (row[' 입금     날짜 '] || row['입금날짜'] || row['입금'] || '').toString().trim(),
                    contractStartDate: parseContractDate(row['계약기간'], true),
                    contractEndDate: parseContractDate(row['계약기간'], false),
                    remarks: (row['비고'] || '').toString().trim(),
                }));

                resolve(rentals);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

// 계약기간 파싱 함수 (예: "2022.07.06 ~ 2024.07.05")
function parseContractDate(dateRange: string, isStart: boolean): string {
    if (!dateRange) return '';
    const dates = dateRange.split('~').map(d => d.trim());
    if (dates.length !== 2) return '';
    return isStart ? dates[0] : dates[1];
}

export const exportRentalExcel = (rentals: Rental[]) => {
    const worksheet = XLSX.utils.json_to_sheet(rentals.map(r => ({
        '호실': r.ho,
        '임대인': r.tenantName,
        '연락처': r.contact,
        'e-mail': r.email,
        '임대면적': r.area,
        '계약기간': `${r.contractStartDate} ~ ${r.contractEndDate}`,
        '구분': r.type,
        '입금': r.paymentDate,
        '보증금': r.deposit,
        '월임대료': r.monthlyRent,
        '관리비': r.maintenanceFee,
        '주차비': r.parkingFee,
        '비고': r.remarks
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '임대현황');

    const date = new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(workbook, `임대현황_${dateString}.xlsx`);
};

// IP 자산 엑셀 업로드
export interface IpExcelItem {
    ipAddress: string;
    department: string;
    user: string;
    usage: string;
}

export const readIpInventoryExcel = (file: File): Promise<IpExcelItem[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                const items: IpExcelItem[] = jsonData.map((row: any) => ({
                    ipAddress: (row['IP주소'] || row['IP'] || row['Title'] || '').toString().trim(),
                    department: (row['사용부서'] || row['부서'] || row['Department'] || '').toString().trim(),
                    user: (row['사용자'] || row['UserName'] || '').toString().trim(),
                    usage: (row['용도'] || row['Usage'] || '').toString().trim(),
                })).filter(item => item.ipAddress); // IP가 있는 행만 필터링

                resolve(items);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};
