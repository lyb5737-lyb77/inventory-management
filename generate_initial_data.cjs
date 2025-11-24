const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('2025 임대현황.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(sheet);

const rentalItems = rawData
    .filter(row => row['__EMPTY_1'] && !isNaN(row['__EMPTY_1'])) // Filter valid rows (Room number exists and is number-ish)
    .map((row, index) => {
        const period = row['__EMPTY_6'] || '';
        const [startStr, endStr] = period.split('~').map(s => s.trim());

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            return dateStr.replace(/\./g, '-');
        };

        const rentalTypeMap = {
            '월세': 'Monthly',
            '반전세': 'Half-Charter',
            '전세': 'Charter'
        };

        return {
            id: `rental-${index + 1}`,
            roomNumber: String(row['__EMPTY_1']),
            area: parseFloat(row['__EMPTY_5']) || 0,
            tenantName: row['__EMPTY_2'] || '',
            phone: row['__EMPTY_3'] || '',
            email: row['__EMPTY_4'] || '',
            rentalType: rentalTypeMap[row['__EMPTY_8']] || 'Monthly',
            deposit: parseInt(row['__EMPTY_9']) || 0,
            monthlyRent: parseInt(row['__EMPTY_10']) || 0,
            maintenanceFee: parseInt(row['__EMPTY_11']) || 0,
            parkingFee: 0, // Not in Excel explicitly, assume 0 or part of total? User said Total = Rent + Maint + Parking. Excel has Total in __EMPTY_13.
            // Let's calculate parking if Total > Rent + Maint
            // Or just set parking to 0 for now.
            totalMonthly: parseInt(row['__EMPTY_13']) || 0,
            contractStartDate: formatDate(startStr),
            contractEndDate: formatDate(endStr),
            category: 'General', // Default
            remarks: row['__EMPTY_15'] || '',
            isVacancy: !row['__EMPTY_2'] // If no tenant name, it's vacancy? Or maybe check "Empty" string?
        };
    });

const fileContent = `import { RentalItem } from '../types';

export const INITIAL_RENTAL_DATA: RentalItem[] = ${JSON.stringify(rentalItems, null, 4)};
`;

fs.writeFileSync('src/constants/initialRentalData.ts', fileContent);
console.log('Generated src/constants/initialRentalData.ts');
