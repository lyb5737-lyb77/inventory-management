import { Item, Transaction, ProductGroup, Rental, Warehouse, Customer, IpRange, IpDetail } from './types';
import { getListItems, createListItem, updateListItem, deleteListItem } from './services/sharepoint';
import { sharePointConfig } from './authConfig';

// SharePoint 필드 매핑 타입
interface SharePointItem {
    id: string;
    Title: string;
    ProductGroup: string;
    PartNumber: string;
    Quantity: string;  // SharePoint에서 텍스트 타입
    Price: string;  // SharePoint에서 텍스트 타입
    Warehouse?: string; // 창고
    Remarks: string;
}

interface SharePointProductGroup {
    id: string;
    Title: string;
    Description?: string;
}

interface SharePointTransaction {
    id: string;
    ItemId: string;
    ItemName: string;
    TransactionType: 'IN' | 'OUT';
    Quantity: string;
    TransactionDate: string;
    Warehouse?: string; // 창고
    Target?: string;
    Remarks: string;
}

interface SharePointWarehouse {
    id: string;
    Title: string; // Name
    Location: string;
    Manager: string;
    Email: string;
    Remarks: string;
}

interface SharePointCustomer {
    id: string;
    Title: string; // Name
    DouzoneNumber: string;
    Contact: string;
    email: string; // Changed to lowercase 'email' as requested
    Address: string;
    Remarks: string;
}

interface SharePointRental {
    id: string;
    Title: string; // TenantName
    ContractType: string; // type (직원/일반인)
    Ho: string;
    Area: string;
    Contact: string;
    Email: string;
    RentalType: string; // 월세/전세/반전세
    Deposit: string;
    MonthlyRent: string;
    MaintenanceFee: string;
    ParkingFee: string;
    PaymentDate: string;
    ContractStartDate: string;
    ContractEndDate: string;
    Remarks: string;
}

// 품목 관리
export const getItems = async (): Promise<Item[]> => {
    try {
        const spItems = await getListItems<SharePointItem>(sharePointConfig.listNames.items);
        return spItems.map(spItem => ({
            id: spItem.id,
            name: spItem.Title,
            group: spItem.ProductGroup || '',
            warehouse: spItem.Warehouse || '비트본사', // 기본값 설정
            partNumber: spItem.PartNumber || '',
            quantity: parseInt(spItem.Quantity) || 0,
            price: parseInt(spItem.Price) || 0,
            remarks: spItem.Remarks || '',
        }));
    } catch (error) {
        console.error('Error getting items:', error);
        return [];
    }
};

export const addItem = async (item: Omit<Item, 'id'>): Promise<Item> => {
    const data: any = {
        Title: item.name,
        Quantity: String(item.quantity || 0),  // 텍스트 타입이므로 문자열로 변환
        Price: String(item.price || 0),  // 텍스트 타입이므로 문자열로 변환
        Warehouse: item.warehouse || '비트본사',
    };

    // 선택적 필드들 - 값이 있을 때만 추가
    if (item.group && item.group.trim() !== '') {
        data.ProductGroup = item.group;
    }
    if (item.partNumber && item.partNumber.trim() !== '') {
        data.PartNumber = item.partNumber;
    }
    if (item.remarks && item.remarks.trim() !== '') {
        data.Remarks = item.remarks;
    }

    const spItem = await createListItem<SharePointItem>(sharePointConfig.listNames.items, data);

    return {
        id: spItem.id,
        name: spItem.Title,
        group: spItem.ProductGroup || '',
        warehouse: spItem.Warehouse || '비트본사',
        partNumber: spItem.PartNumber || '',
        quantity: parseInt(spItem.Quantity) || 0,
        price: parseInt(spItem.Price) || 0,
        remarks: spItem.Remarks || '',
    };
};

export const updateItem = async (id: string, updates: Partial<Item>): Promise<void> => {
    const spUpdates: any = {};
    if (updates.name !== undefined) spUpdates.Title = updates.name;
    if (updates.group !== undefined) spUpdates.ProductGroup = updates.group;
    if (updates.partNumber !== undefined) spUpdates.PartNumber = updates.partNumber;
    if (updates.quantity !== undefined) spUpdates.Quantity = String(updates.quantity);
    if (updates.price !== undefined) spUpdates.Price = String(updates.price);
    if (updates.warehouse !== undefined) spUpdates.Warehouse = updates.warehouse;
    if (updates.remarks !== undefined) spUpdates.Remarks = updates.remarks;

    await updateListItem(sharePointConfig.listNames.items, id, spUpdates);
};

export const deleteItem = async (id: string): Promise<void> => {
    await deleteListItem(sharePointConfig.listNames.items, id);
};

// 거래 관리
export const getTransactions = async (): Promise<Transaction[]> => {
    try {
        const spTransactions = await getListItems<SharePointTransaction>(sharePointConfig.listNames.transactions);
        return spTransactions.map(spTx => ({
            id: spTx.id,
            itemId: spTx.ItemId,
            itemName: spTx.ItemName,
            type: spTx.TransactionType,
            warehouse: spTx.Warehouse || '비트본사',
            quantity: parseInt(spTx.Quantity) || 0,
            date: spTx.TransactionDate,
            target: spTx.Target,
            remarks: spTx.Remarks || '',
        }));
    } catch (error) {
        console.error('Error getting transactions:', error);
        return [];
    }
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
    const spTransaction = await createListItem<SharePointTransaction>(sharePointConfig.listNames.transactions, {
        ItemId: transaction.itemId,
        ItemName: transaction.itemName,
        TransactionType: transaction.type,
        Warehouse: transaction.warehouse || '비트본사',
        Quantity: String(transaction.quantity),
        TransactionDate: transaction.date,
        Target: transaction.target || '',
        Remarks: transaction.remarks,
    });

    // 재고 수량 업데이트
    const items = await getItems();
    const item = items.find(i => i.id === transaction.itemId);
    if (item) {
        const newQuantity = transaction.type === 'IN'
            ? item.quantity + transaction.quantity
            : item.quantity - transaction.quantity;

        await updateItem(item.id, { quantity: newQuantity });
    }

    return {
        id: spTransaction.id,
        itemId: spTransaction.ItemId,
        itemName: spTransaction.ItemName,
        type: spTransaction.TransactionType,
        warehouse: spTransaction.Warehouse || '비트본사',
        quantity: parseInt(spTransaction.Quantity) || 0,
        date: spTransaction.TransactionDate,
        target: spTransaction.Target,
        remarks: spTransaction.Remarks,
    };
};

// 날짜별 거래 검색
export const getTransactionsByDateRange = async (startDate: string, endDate: string): Promise<Transaction[]> => {
    const transactions = await getTransactions();
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
};

// 품목별 현재고 계산 (검증용)
export const calculateCurrentStock = async (itemId: string): Promise<number> => {
    const transactions = await getTransactions();
    const itemTransactions = transactions.filter(t => t.itemId === itemId);

    let stock = 0;
    itemTransactions.forEach(t => {
        if (t.type === 'IN') {
            stock += t.quantity;
        } else {
            stock -= t.quantity;
        }
    });

    return stock;
};

// 제품그룹 관리
export const getProductGroups = async (): Promise<ProductGroup[]> => {
    try {
        const spGroups = await getListItems<SharePointProductGroup>(sharePointConfig.listNames.productGroups);
        return spGroups.map(spGroup => ({
            id: spGroup.id,
            name: spGroup.Title,
            description: spGroup.Description,
        }));
    } catch (error) {
        console.error('Error getting product groups:', error);
        return [];
    }
};

export const addProductGroup = async (group: Omit<ProductGroup, 'id'>): Promise<ProductGroup> => {
    const data: any = {
        Title: group.name,
    };

    // Description 필드가 있을 때만 추가 (선택적)
    if (group.description && group.description.trim() !== '') {
        data.Description = group.description;
    }

    const spGroup = await createListItem<SharePointProductGroup>(sharePointConfig.listNames.productGroups, data);

    return {
        id: spGroup.id,
        name: spGroup.Title,
        description: spGroup.Description,
    };
};

export const updateProductGroup = async (id: string, updates: Partial<ProductGroup>): Promise<void> => {
    const spUpdates: any = {};
    if (updates.name !== undefined) spUpdates.Title = updates.name;
    if (updates.description !== undefined) spUpdates.Description = updates.description;

    await updateListItem(sharePointConfig.listNames.productGroups, id, spUpdates);
};

export const deleteProductGroup = async (id: string): Promise<void> => {
    await deleteListItem(sharePointConfig.listNames.productGroups, id);
};

// 임대 관리 (SharePoint 사용)
export const getRentals = async (): Promise<Rental[]> => {
    try {
        const spRentals = await getListItems<SharePointRental>(sharePointConfig.listNames.rentals);
        return spRentals.map(spRental => ({
            id: spRental.id,
            type: spRental.ContractType || '',
            ho: spRental.Ho || '',
            area: spRental.Area || '',
            tenantName: spRental.Title || '',
            contact: spRental.Contact || '',
            email: spRental.Email || '',
            rentalType: spRental.RentalType || '',
            deposit: parseInt(spRental.Deposit) || 0,
            monthlyRent: parseInt(spRental.MonthlyRent) || 0,
            maintenanceFee: parseInt(spRental.MaintenanceFee) || 0,
            parkingFee: parseInt(spRental.ParkingFee) || 0,
            paymentDate: spRental.PaymentDate || '',
            contractStartDate: spRental.ContractStartDate || '',
            contractEndDate: spRental.ContractEndDate || '',
            remarks: spRental.Remarks || '',
        }));
    } catch (error) {
        console.error('Error getting rentals:', error);
        return [];
    }
};

export const addRental = async (rental: Omit<Rental, 'id'>): Promise<Rental> => {
    const data: any = {
        Title: rental.tenantName,
        ContractType: rental.type,
        Ho: rental.ho,
        Area: rental.area,
        Contact: rental.contact,
        Email: rental.email,
        RentalType: rental.rentalType,
        Deposit: String(rental.deposit),
        MonthlyRent: String(rental.monthlyRent),
        MaintenanceFee: String(rental.maintenanceFee),
        ParkingFee: String(rental.parkingFee),
        PaymentDate: rental.paymentDate,
        ContractStartDate: rental.contractStartDate,
        ContractEndDate: rental.contractEndDate,
        Remarks: rental.remarks,
    };

    const spRental = await createListItem<SharePointRental>(sharePointConfig.listNames.rentals, data);

    return {
        id: spRental.id,
        type: spRental.ContractType || '',
        ho: spRental.Ho || '',
        area: spRental.Area || '',
        tenantName: spRental.Title || '',
        contact: spRental.Contact || '',
        email: spRental.Email || '',
        rentalType: spRental.RentalType || '',
        deposit: parseInt(spRental.Deposit) || 0,
        monthlyRent: parseInt(spRental.MonthlyRent) || 0,
        maintenanceFee: parseInt(spRental.MaintenanceFee) || 0,
        parkingFee: parseInt(spRental.ParkingFee) || 0,
        paymentDate: spRental.PaymentDate || '',
        contractStartDate: spRental.ContractStartDate || '',
        contractEndDate: spRental.ContractEndDate || '',
        remarks: spRental.Remarks || '',
    };
};

export const updateRental = async (id: string, updates: Partial<Rental>): Promise<void> => {
    const spUpdates: any = {};
    if (updates.tenantName !== undefined) spUpdates.Title = updates.tenantName;
    if (updates.type !== undefined) spUpdates.ContractType = updates.type;
    if (updates.ho !== undefined) spUpdates.Ho = updates.ho;
    if (updates.area !== undefined) spUpdates.Area = updates.area;
    if (updates.contact !== undefined) spUpdates.Contact = updates.contact;
    if (updates.email !== undefined) spUpdates.Email = updates.email;
    if (updates.rentalType !== undefined) spUpdates.RentalType = updates.rentalType;
    if (updates.deposit !== undefined) spUpdates.Deposit = String(updates.deposit);
    if (updates.monthlyRent !== undefined) spUpdates.MonthlyRent = String(updates.monthlyRent);
    if (updates.maintenanceFee !== undefined) spUpdates.MaintenanceFee = String(updates.maintenanceFee);
    if (updates.parkingFee !== undefined) spUpdates.ParkingFee = String(updates.parkingFee);
    if (updates.paymentDate !== undefined) spUpdates.PaymentDate = updates.paymentDate;
    if (updates.contractStartDate !== undefined) spUpdates.ContractStartDate = updates.contractStartDate;
    if (updates.contractEndDate !== undefined) spUpdates.ContractEndDate = updates.contractEndDate;
    if (updates.remarks !== undefined) spUpdates.Remarks = updates.remarks;

    await updateListItem(sharePointConfig.listNames.rentals, id, spUpdates);
};

export const deleteRental = async (id: string): Promise<void> => {
    await deleteListItem(sharePointConfig.listNames.rentals, id);
};

// 창고 관리
export const getWarehouses = async (): Promise<Warehouse[]> => {
    try {
        const spWarehouses = await getListItems<SharePointWarehouse>(sharePointConfig.listNames.warehouses);
        return spWarehouses.map(spWh => ({
            id: spWh.id,
            name: spWh.Title,
            location: spWh.Location || '',
            manager: spWh.Manager || '',
            email: spWh.Email || '',
            remarks: spWh.Remarks || '',
        }));
    } catch (error) {
        console.error('Error getting warehouses:', error);
        return [];
    }
};

export const addWarehouse = async (warehouse: Omit<Warehouse, 'id'>): Promise<Warehouse> => {
    const data: any = {
        Title: warehouse.name,
        Location: warehouse.location,
        Manager: warehouse.manager,
        Email: warehouse.email,
        Remarks: warehouse.remarks,
    };

    const spWh = await createListItem<SharePointWarehouse>(sharePointConfig.listNames.warehouses, data);

    return {
        id: spWh.id,
        name: spWh.Title,
        location: spWh.Location || '',
        manager: spWh.Manager || '',
        email: spWh.Email || '',
        remarks: spWh.Remarks || '',
    };
};

export const updateWarehouse = async (id: string, updates: Partial<Warehouse>): Promise<void> => {
    const spUpdates: any = {};
    if (updates.name !== undefined) spUpdates.Title = updates.name;
    if (updates.location !== undefined) spUpdates.Location = updates.location;
    if (updates.manager !== undefined) spUpdates.Manager = updates.manager;
    if (updates.email !== undefined) spUpdates.Email = updates.email;
    if (updates.remarks !== undefined) spUpdates.Remarks = updates.remarks;

    await updateListItem(sharePointConfig.listNames.warehouses, id, spUpdates);
};

export const deleteWarehouse = async (id: string): Promise<void> => {
    await deleteListItem(sharePointConfig.listNames.warehouses, id);
};

// 출고처 관리
export const getCustomers = async (): Promise<Customer[]> => {
    try {
        const spCustomers = await getListItems<SharePointCustomer>(sharePointConfig.listNames.customers);
        return spCustomers.map(spCust => ({
            id: spCust.id,
            name: spCust.Title,
            douzoneNumber: spCust.DouzoneNumber || '',
            contact: spCust.Contact || '',
            email: spCust.email || '',
            address: spCust.Address || '',
            remarks: spCust.Remarks || '',
        }));
    } catch (error) {
        console.error('Error getting customers:', error);
        return [];
    }
};

export const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer> => {
    const data: any = {
        Title: customer.name,
        DouzoneNumber: customer.douzoneNumber,
        Contact: customer.contact,
        email: customer.email,
        Address: customer.address,
        Remarks: customer.remarks,
    };

    const spCust = await createListItem<SharePointCustomer>(sharePointConfig.listNames.customers, data);

    return {
        id: spCust.id,
        name: spCust.Title,
        douzoneNumber: spCust.DouzoneNumber || '',
        contact: spCust.Contact || '',
        email: spCust.email || '',
        address: spCust.Address || '',
        remarks: spCust.Remarks || '',
    };
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<void> => {
    const spUpdates: any = {};
    if (updates.name !== undefined) spUpdates.Title = updates.name;
    if (updates.douzoneNumber !== undefined) spUpdates.DouzoneNumber = updates.douzoneNumber;
    if (updates.contact !== undefined) spUpdates.Contact = updates.contact;
    if (updates.email !== undefined) spUpdates.email = updates.email;
    if (updates.address !== undefined) spUpdates.Address = updates.address;
    if (updates.remarks !== undefined) spUpdates.Remarks = updates.remarks;

    await updateListItem(sharePointConfig.listNames.customers, id, spUpdates);
};

export const deleteCustomer = async (id: string): Promise<void> => {
    await deleteListItem(sharePointConfig.listNames.customers, id);
};

// Deprecated: LocalStorage functions removed
export const saveRentals = (_rentals: Rental[]): void => {
    console.warn('saveRentals is deprecated. Use addRental/updateRental instead.');
};

// IP 관리
interface SharePointIpRange {
    id: string;
    Title: string;        // 대역명
    DeviceName: string;   // 장비명
    StartIP: string;
    EndIP: string;
    Gateway: string;
    SubnetMask: string;
    Description: string;
}

interface SharePointIpDetail {
    id: string;
    Title: string;        // IP 주소
    RangeId: string;
    Department: string;
    UserName: string;
    Usage: string;
    Status: string;
}

export const getIpRanges = async (): Promise<IpRange[]> => {
    try {
        const spRanges = await getListItems<SharePointIpRange>(sharePointConfig.listNames.ipRanges);
        return spRanges.map(spRange => ({
            id: spRange.id,
            title: spRange.Title,
            device: spRange.DeviceName || '',
            startIp: spRange.StartIP || '',
            endIp: spRange.EndIP || '',
            gateway: spRange.Gateway || '',
            subnetMask: spRange.SubnetMask || '',
            description: spRange.Description || '',
        }));
    } catch (error) {
        console.error('Error getting IP ranges:', error);
        return [];
    }
};

export const addIpRange = async (range: Omit<IpRange, 'id'>): Promise<IpRange> => {
    const data: any = {
        Title: range.title,
        DeviceName: range.device,
        StartIP: range.startIp,
        EndIP: range.endIp,
        Gateway: range.gateway || '',
        SubnetMask: range.subnetMask || '',
        Description: range.description || '',
    };

    const spRange = await createListItem<SharePointIpRange>(sharePointConfig.listNames.ipRanges, data);

    return {
        id: spRange.id,
        title: spRange.Title,
        device: spRange.DeviceName || '',
        startIp: spRange.StartIP || '',
        endIp: spRange.EndIP || '',
        gateway: spRange.Gateway || '',
        subnetMask: spRange.SubnetMask || '',
        description: spRange.Description || '',
    };
};

export const deleteIpRange = async (id: string): Promise<void> => {
    await deleteListItem(sharePointConfig.listNames.ipRanges, id);
    // Note: Associated IP Details should be handled (warn user or cascade delete)
    // For now, we leave them as orphaned or assume manual cleanup
};

export const getIpDetails = async (rangeId?: string): Promise<IpDetail[]> => {
    try {
        const spDetails = await getListItems<SharePointIpDetail>(sharePointConfig.listNames.ipDetails);
        const details = spDetails.map(spDetail => ({
            id: spDetail.id,
            ipAddress: spDetail.Title,
            rangeId: spDetail.RangeId || '',
            department: spDetail.Department || '',
            user: spDetail.UserName || '',
            usage: spDetail.Usage || '',
            status: (spDetail.Status as '사용중' | '사용가능') || '사용가능',
        }));

        if (rangeId) {
            return details.filter(d => d.rangeId === rangeId);
        }
        return details;
    } catch (error) {
        console.error('Error getting IP details:', error);
        return [];
    }
};

export const updateIpDetail = async (detail: Omit<IpDetail, 'id'> & { id?: string }): Promise<void> => {
    // Check if it exists by IP Address and RangeId if ID is not provided
    // However, simplest way for UI is to pass ID if it exists.

    // If ID exists, update. If not, create.
    if (detail.id) {
        const data: any = {};
        if (detail.department !== undefined) data.Department = detail.department;
        if (detail.user !== undefined) data.UserName = detail.user;
        if (detail.usage !== undefined) data.Usage = detail.usage;
        if (detail.status !== undefined) data.Status = detail.status;

        await updateListItem(sharePointConfig.listNames.ipDetails, detail.id, data);
    } else {
        // Create new
        const data: any = {
            Title: detail.ipAddress,
            RangeId: detail.rangeId,
            Department: detail.department || '',
            UserName: detail.user || '',
            Usage: detail.usage || '',
            Status: detail.status || '사용배정',
        };
        await createListItem<SharePointIpDetail>(sharePointConfig.listNames.ipDetails, data);
    }
};

// IP Helper: Generate list of IPs between two IP addresses
export const generateIpListInRange = (startIp: string, endIp: string): string[] => {
    const ipToLong = (ip: string) => {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    };

    const longToIp = (long: number) => {
        return [
            (long >>> 24) & 255,
            (long >>> 16) & 255,
            (long >>> 8) & 255,
            long & 255
        ].join('.');
    };

    const start = ipToLong(startIp);
    const end = ipToLong(endIp);
    const ips: string[] = [];

    for (let i = start; i <= end; i++) {
        ips.push(longToIp(i));
    }
    return ips;
};
