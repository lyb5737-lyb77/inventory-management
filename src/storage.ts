import { Item, Transaction, ProductGroup } from './types';
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
    Target?: string;
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
