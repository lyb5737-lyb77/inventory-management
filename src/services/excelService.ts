import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Rental, Order, Item } from '../types';

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

// 주문 내역을 "비트몰 자재출고 2026-07.xlsx"와 동일한 서식(27열 ERP 양식)으로 월단위 다운로드.
// 폰트/색상/열너비/번호서식 등을 100% 맞추기 위해, 양식 파일(public/order-template.xlsx)을
// 그대로 불러와 데이터만 주입한다. (xlsx 무료판은 스타일 쓰기를 지원하지 않아 exceljs 사용)
// 창고코드/장소코드/거래구분/과세구분/단가구분/환종/환율/프로젝트코드는 항상 고정값,
// 재고수량은 출고수량과 동일, 매입단가/매입금액/마진은 공란, 매출금액/부가세/합계액은 자동 계산.
const TEMPLATE_LAYOUT = {
    sheet: 'Worksheet',
    baseDateCell: 'C2', // 기준일 셀 (제목/기준일은 C열부터 병합)
    firstDataRow: 9,    // 데이터 시작 행 (헤더 8행)
    sampleDataRow: 9,   // 데이터 셀 서식 추출 행
    sampleTotalRow: 16, // 합계 셀 서식 추출 행
    cols: 27,           // A~AA
};

// 항상 동일하게 들어가는 고정값 (열 번호는 1-based)
const FIXED_COLS: Record<number, string> = {
    1: '1000',   // 창고코드
    2: '1100',   // 장소코드
    7: '0',      // 거래구분
    8: '0',      // 과세구분
    9: '0',      // 단가구분
    24: 'KRW',   // 환종
    25: '1',     // 환율
    26: '3100',  // 프로젝트코드
};

export const exportOrdersExcel = async (orders: Order[], yearMonth: string, items: Item[] = []): Promise<void> => {
    const monthly = orders
        .filter(o => (o.orderDate || '').startsWith(yearMonth))
        .sort((a, b) => (a.orderDate || '').localeCompare(b.orderDate || ''));

    // 품번 → 매입단가(품목 가격) 매핑
    const purchasePriceByPart = new Map<string, number>();
    items.forEach(i => {
        const pn = i.partNumber.trim();
        if (pn && !purchasePriceByPart.has(pn)) purchasePriceByPart.set(pn, i.price || 0);
    });

    const [y, m] = yearMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // m=1~12 → 해당 월 말일
    const start = `${yearMonth}-01`;
    const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    const { sheet, baseDateCell, firstDataRow, sampleDataRow, sampleTotalRow, cols } = TEMPLATE_LAYOUT;

    // 양식 파일 로드 (서식 보존)
    const res = await fetch(`${import.meta.env.BASE_URL}order-template.xlsx`);
    if (!res.ok) throw new Error('출고 양식 파일(order-template.xlsx)을 불러오지 못했습니다.');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    const ws = wb.getWorksheet(sheet) || wb.worksheets[0];

    // 기준일 갱신 (스타일 유지)
    ws.getCell(baseDateCell).value = `기준일: ${start} ~ ${end}`;

    // 데이터/합계 행의 열별 서식을 미리 캡처
    const dataStyles: Partial<ExcelJS.Style>[] = [];
    const totalStyles: Partial<ExcelJS.Style>[] = [];
    for (let c = 1; c <= cols; c++) {
        dataStyles[c] = ws.getRow(sampleDataRow).getCell(c).style;
        totalStyles[c] = ws.getRow(sampleTotalRow).getCell(c).style;
    }
    const clearUpTo = Math.max(ws.rowCount, sampleTotalRow);

    // 데이터 행 기록 (열 순서: A~AA)
    let r = firstDataRow;
    for (const o of monthly) {
        const purchaseUnit = purchasePriceByPart.get(o.partNumber.trim()) || 0; // 매입단가 = 품목 가격
        const purchaseAmount = o.quantity * purchaseUnit;                        // 매입금액 = 출고수량 × 매입단가
        const salesAmount = o.quantity * o.salesUnitPrice;
        const vat = Math.round(salesAmount * 0.1);
        const margin = salesAmount - purchaseAmount;                             // 마진 = 매출금액 − 매입금액
        // 1-based 열 순서대로 값 구성
        const values: (string | number | null)[] = [
            FIXED_COLS[1], FIXED_COLS[2],           // 창고코드, 장소코드
            o.orderDate, o.bizNumber, o.customerCode, o.customerName, // 출고일자, 사업자번호, 거래처코드, 거래처명
            FIXED_COLS[7], FIXED_COLS[8], FIXED_COLS[9],  // 거래구분, 과세구분, 단가구분
            o.partNumber, o.productName, o.quantity, // 품번, 품명, 출고수량
            purchaseUnit, purchaseAmount,            // 매입단가, 매입금액
            o.salesUnitPrice, salesAmount, vat, salesAmount + vat, // 매출단가, 매출금액, 부가세, 합계액
            margin,                                  // 마진
            o.paymentType, o.email, o.contact, o.address, // 결제구분, 이메일주소, 연락처, 배송처
            FIXED_COLS[24], FIXED_COLS[25], FIXED_COLS[26], // 환종, 환율, 프로젝트코드
            o.quantity,                              // 재고수량 = 출고수량
        ];
        const row = ws.getRow(r);
        row.height = 30;
        for (let c = 1; c <= cols; c++) {
            const cell = row.getCell(c);
            cell.value = values[c - 1];
            cell.style = dataStyles[c];
        }
        r++;
    }

    // 합계 행 (품명열에 '합계', 수량/금액 합계)
    const purchaseUnitOf = (o: Order) => purchasePriceByPart.get(o.partNumber.trim()) || 0;
    const sum = (sel: (o: Order) => number) => monthly.reduce((acc, o) => acc + sel(o), 0);
    const totalPurchase = sum(o => o.quantity * purchaseUnitOf(o));
    const totalSales = sum(o => o.quantity * o.salesUnitPrice);
    const totalVat = sum(o => Math.round(o.quantity * o.salesUnitPrice * 0.1));
    const totalRow = ws.getRow(r);
    totalRow.height = 30;
    for (let c = 1; c <= cols; c++) totalRow.getCell(c).style = totalStyles[c];
    totalRow.getCell(11).value = '합계';                 // K 품명열
    totalRow.getCell(12).value = sum(o => o.quantity);   // L 출고수량
    totalRow.getCell(14).value = totalPurchase;          // N 매입금액
    totalRow.getCell(16).value = totalSales;             // P 매출금액
    totalRow.getCell(17).value = totalVat;               // Q 부가세
    totalRow.getCell(18).value = totalSales + totalVat;  // R 합계액
    totalRow.getCell(19).value = totalSales - totalPurchase; // S 마진
    const totalRowNum = r;

    // 합계 행 이후 남아있는 양식의 빈 행 정리
    for (let rr = totalRowNum + 1; rr <= clearUpTo; rr++) {
        const row = ws.getRow(rr);
        for (let c = 1; c <= cols; c++) {
            const cell = row.getCell(c);
            cell.value = null;
            cell.style = {};
        }
    }

    // 다운로드
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `비트몰 자재출고 ${yearMonth}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

// 거래처목록.xlsx 파싱 (헤더: 더존번호/사업자번호/대표명/출고처명/주소/연락처/핸드폰/이메일)
export interface CustomerImportRow {
    douzoneNumber: string;
    businessNumber: string;
    representativeName: string;
    name: string;
    address: string;
    contact: string;
    mobilePhone: string;
    email: string;
}

export const readCustomerListExcel = (file: File): Promise<CustomerImportRow[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', blankrows: false });

                // 헤더 행 탐색 ('더존번호' + '출고처명' 포함)
                const headerIdx = aoa.findIndex(row =>
                    row.some(c => cellStr(c) === '더존번호') &&
                    row.some(c => ['출고처명', '거래처명', '상호'].includes(cellStr(c)))
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
                    douzoneNumber: col('더존번호'),
                    businessNumber: col('사업자번호'),
                    representativeName: col('대표명', '대표자', '대표자명'),
                    name: col('출고처명', '거래처명', '상호'),
                    address: col('주소'),
                    contact: col('연락처', '전화번호', '전화'),
                    mobilePhone: col('핸드폰', '휴대폰', '휴대전화', '핸드폰번호'),
                    email: col('이메일', '이메일주소', 'email', 'E-mail'),
                };
                const at = (row: any[], i: number) => (i >= 0 ? row[i] : '');

                const rows: CustomerImportRow[] = aoa.slice(headerIdx + 1)
                    .map((row) => ({
                        douzoneNumber: cellStr(at(row, idx.douzoneNumber)),
                        businessNumber: cellStr(at(row, idx.businessNumber)),
                        representativeName: cellStr(at(row, idx.representativeName)),
                        name: cellStr(at(row, idx.name)),
                        address: cellStr(at(row, idx.address)),
                        contact: cellStr(at(row, idx.contact)),
                        mobilePhone: cellStr(at(row, idx.mobilePhone)),
                        email: cellStr(at(row, idx.email)),
                    }))
                    // 더존번호와 출고처명이 모두 없는 행 제외
                    .filter(r => r.douzoneNumber || r.name);

                resolve(rows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
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
