import * as XLSX from 'xlsx';
import { Rental } from '../types';

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
