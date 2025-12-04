import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Item, ProductGroup, Warehouse, Customer } from '../types';
import {
    getItems, addItem, updateItem, deleteItem,
    getProductGroups, addProductGroup, updateProductGroup, deleteProductGroup,
    getWarehouses, addWarehouse, updateWarehouse, deleteWarehouse,
    getCustomers, addCustomer, updateCustomer, deleteCustomer
} from '../storage';

export default function AdminPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'items' | 'groups' | 'warehouses' | 'customers'>('items');

    // 품목 관리 상태
    const [items, setItems] = useState<Item[]>([]);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemFormData, setItemFormData] = useState({
        name: '',
        group: '',
        warehouse: '비트본사',
        partNumber: '',
        quantity: 0,
        price: 0,
        remarks: '',
    });

    // 제품그룹 관리 상태
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
    const [groupFormData, setGroupFormData] = useState({
        name: '',
        description: '',
    });

    // 창고 관리 상태
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [warehouseFormData, setWarehouseFormData] = useState({
        name: '',
        location: '',
        manager: '',
        email: '',
        remarks: '',
    });

    // 출고처 관리 상태
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [customerFormData, setCustomerFormData] = useState({
        name: '',
        douzoneNumber: '',
        contact: '',
        address: '',
        remarks: '',
    });

    // 로딩 및 에러 상태
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([loadItems(), loadProductGroups(), loadWarehouses(), loadCustomers()]);
        } catch (err: any) {
            setError(err.message || '데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const loadItems = async () => {
        const data = await getItems();
        setItems(data);
    };

    const loadProductGroups = async () => {
        const data = await getProductGroups();
        setProductGroups(data);
    };

    const loadWarehouses = async () => {
        const data = await getWarehouses();
        setWarehouses(data);
    };

    const loadCustomers = async () => {
        const data = await getCustomers();
        setCustomers(data);
    };

    // 품목 관련 핸들러
    const handleItemSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingItem) {
                await updateItem(editingItem.id, itemFormData);
            } else {
                await addItem(itemFormData);
            }

            resetItemForm();
            await loadItems();
        } catch (err: any) {
            setError(err.message || '품목 저장 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleItemEdit = (item: Item) => {
        setEditingItem(item);
        setItemFormData({
            name: item.name,
            group: item.group,
            warehouse: item.warehouse || '비트본사',
            partNumber: item.partNumber,
            quantity: item.quantity,
            price: item.price,
            remarks: item.remarks,
        });
        setIsItemModalOpen(true);
    };

    const handleItemDelete = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setLoading(true);
            setError(null);
            try {
                await deleteItem(id);
                await loadItems();
            } catch (err: any) {
                setError(err.message || '품목 삭제 실패');
            } finally {
                setLoading(false);
            }
        }
    };

    const resetItemForm = () => {
        setItemFormData({
            name: '',
            group: '',
            warehouse: '비트본사',
            partNumber: '',
            quantity: 0,
            price: 0,
            remarks: '',
        });
        setEditingItem(null);
        setIsItemModalOpen(false);
    };

    // 제품그룹 관련 핸들러
    const handleGroupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingGroup) {
                await updateProductGroup(editingGroup.id, groupFormData);
            } else {
                await addProductGroup(groupFormData);
            }

            resetGroupForm();
            await loadProductGroups();
        } catch (err: any) {
            setError(err.message || '제품그룹 저장 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleGroupEdit = (group: ProductGroup) => {
        setEditingGroup(group);
        setGroupFormData({
            name: group.name,
            description: group.description || '',
        });
        setIsGroupModalOpen(true);
    };

    const handleGroupDelete = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setLoading(true);
            setError(null);
            try {
                await deleteProductGroup(id);
                await loadProductGroups();
            } catch (err: any) {
                setError(err.message || '제품그룹 삭제 실패');
            } finally {
                setLoading(false);
            }
        }
    };

    const resetGroupForm = () => {
        setGroupFormData({
            name: '',
            description: '',
        });
        setEditingGroup(null);
        setIsGroupModalOpen(false);
    };

    // 창고 관련 핸들러
    const handleWarehouseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingWarehouse) {
                await updateWarehouse(editingWarehouse.id, warehouseFormData);
            } else {
                await addWarehouse(warehouseFormData);
            }

            resetWarehouseForm();
            await loadWarehouses();
        } catch (err: any) {
            setError(err.message || '창고 저장 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleWarehouseEdit = (warehouse: Warehouse) => {
        setEditingWarehouse(warehouse);
        setWarehouseFormData({
            name: warehouse.name,
            location: warehouse.location,
            manager: warehouse.manager,
            email: warehouse.email,
            remarks: warehouse.remarks,
        });
        setIsWarehouseModalOpen(true);
    };

    const handleWarehouseDelete = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setLoading(true);
            setError(null);
            try {
                await deleteWarehouse(id);
                await loadWarehouses();
            } catch (err: any) {
                setError(err.message || '창고 삭제 실패');
            } finally {
                setLoading(false);
            }
        }
    };

    const resetWarehouseForm = () => {
        setWarehouseFormData({
            name: '',
            location: '',
            manager: '',
            email: '',
            remarks: '',
        });
        setEditingWarehouse(null);
        setIsWarehouseModalOpen(false);
    };

    // 출고처 관련 핸들러
    const handleCustomerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingCustomer) {
                await updateCustomer(editingCustomer.id, customerFormData);
            } else {
                await addCustomer(customerFormData);
            }

            resetCustomerForm();
            await loadCustomers();
        } catch (err: any) {
            setError(err.message || '출고처 저장 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleCustomerEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setCustomerFormData({
            name: customer.name,
            douzoneNumber: customer.douzoneNumber,
            contact: customer.contact,
            address: customer.address,
            remarks: customer.remarks,
        });
        setIsCustomerModalOpen(true);
    };

    const handleCustomerDelete = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setLoading(true);
            setError(null);
            try {
                await deleteCustomer(id);
                await loadCustomers();
            } catch (err: any) {
                setError(err.message || '출고처 삭제 실패');
            } finally {
                setLoading(false);
            }
        }
    };

    const resetCustomerForm = () => {
        setCustomerFormData({
            name: '',
            douzoneNumber: '',
            contact: '',
            address: '',
            remarks: '',
        });
        setEditingCustomer(null);
        setIsCustomerModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            {/* 네비게이션 */}
            <nav className="bg-black/30 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <button
                            onClick={() => navigate('/')}
                            className="text-white hover:text-blue-400 transition flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            홈으로
                        </button>
                        <h1 className="text-2xl font-bold text-white">관리자 페이지</h1>
                        <div className="w-20"></div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* 로딩 표시 */}
                {loading && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-white font-semibold">처리 중...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 에러 메시지 */}
                {error && (
                    <div className="mb-6 bg-red-500/20 border border-red-500 rounded-lg p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-white">{error}</span>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-white hover:text-gray-300"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
                {/* 탭 네비게이션 */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === 'items'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                    >
                        품목 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === 'groups'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                    >
                        제품그룹 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === 'warehouses'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                    >
                        창고 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === 'customers'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                    >
                        출고처 관리
                    </button>
                </div>

                {/* 품목 관리 탭 */}
                {activeTab === 'items' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">품목 관리</h2>
                            <button
                                onClick={() => setIsItemModalOpen(true)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg transform transition hover:scale-105"
                            >
                                + 품목 추가
                            </button>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/20">
                                    <thead className="bg-black/30">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">품명</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">제품그룹</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">창고</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">품번</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">수량</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">가격</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">비고</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                                    등록된 품목이 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item) => (
                                                <tr key={item.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-white">{item.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.group}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.warehouse || '비트본사'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.partNumber}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.quantity}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">₩{item.price.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-gray-300">{item.remarks}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleItemEdit(item)}
                                                            className="text-blue-400 hover:text-blue-300 mr-3"
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleItemDelete(item.id)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* 제품그룹 관리 탭 */}
                {activeTab === 'groups' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">제품그룹 관리</h2>
                            <button
                                onClick={() => setIsGroupModalOpen(true)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg transform transition hover:scale-105"
                            >
                                + 제품그룹 추가
                            </button>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/20">
                                    <thead className="bg-black/30">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">그룹명</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">설명</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {productGroups.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                                    등록된 제품그룹이 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            productGroups.map((group) => (
                                                <tr key={group.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-white font-medium">{group.name}</td>
                                                    <td className="px-6 py-4 text-gray-300">{group.description || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleGroupEdit(group)}
                                                            className="text-blue-400 hover:text-blue-300 mr-3"
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleGroupDelete(group.id)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* 창고 관리 탭 */}
                {activeTab === 'warehouses' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">창고 관리</h2>
                            <button
                                onClick={() => setIsWarehouseModalOpen(true)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg transform transition hover:scale-105"
                            >
                                + 창고 추가
                            </button>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/20">
                                    <thead className="bg-black/30">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">창고명</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">위치</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">담당자</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">이메일</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">비고</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {warehouses.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                    등록된 창고가 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            warehouses.map((warehouse) => (
                                                <tr key={warehouse.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-white font-medium">{warehouse.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{warehouse.location}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{warehouse.manager}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{warehouse.email}</td>
                                                    <td className="px-6 py-4 text-gray-300">{warehouse.remarks || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleWarehouseEdit(warehouse)}
                                                            className="text-blue-400 hover:text-blue-300 mr-3"
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleWarehouseDelete(warehouse.id)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* 출고처 관리 탭 */}
                {activeTab === 'customers' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">출고처 관리</h2>
                            <button
                                onClick={() => setIsCustomerModalOpen(true)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg transform transition hover:scale-105"
                            >
                                + 출고처 추가
                            </button>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/20">
                                    <thead className="bg-black/30">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">출고처명</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">더존번호</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">연락처</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">주소</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">비고</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {customers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                    등록된 출고처가 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            customers.map((customer) => (
                                                <tr key={customer.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-white font-medium">{customer.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{customer.douzoneNumber}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{customer.contact}</td>
                                                    <td className="px-6 py-4 text-gray-300">{customer.address}</td>
                                                    <td className="px-6 py-4 text-gray-300">{customer.remarks || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleCustomerEdit(customer)}
                                                            className="text-blue-400 hover:text-blue-300 mr-3"
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleCustomerDelete(customer.id)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* 품목 추가/수정 모달 */}
            {isItemModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            {editingItem ? '품목 수정' : '품목 추가'}
                        </h3>
                        <form onSubmit={handleItemSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">품명</label>
                                <input
                                    type="text"
                                    required
                                    value={itemFormData.name}
                                    onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">제품그룹</label>
                                <select
                                    required
                                    value={itemFormData.group}
                                    onChange={(e) => setItemFormData({ ...itemFormData, group: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="" className="bg-gray-800">선택하세요</option>
                                    {productGroups.map((group) => (
                                        <option key={group.id} value={group.name} className="bg-gray-800">
                                            {group.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">창고</label>
                                <select
                                    required
                                    value={itemFormData.warehouse}
                                    onChange={(e) => setItemFormData({ ...itemFormData, warehouse: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="비트본사" className="bg-gray-800">비트본사 (기본)</option>
                                    {warehouses.map((wh) => (
                                        <option key={wh.id} value={wh.name} className="bg-gray-800">
                                            {wh.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">품번</label>
                                <input
                                    type="text"
                                    required
                                    value={itemFormData.partNumber}
                                    onChange={(e) => setItemFormData({ ...itemFormData, partNumber: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">수량</label>
                                <input
                                    type="number"
                                    required
                                    value={itemFormData.quantity}
                                    onChange={(e) => setItemFormData({ ...itemFormData, quantity: Number(e.target.value) })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">가격</label>
                                <input
                                    type="number"
                                    required
                                    value={itemFormData.price}
                                    onChange={(e) => setItemFormData({ ...itemFormData, price: Number(e.target.value) })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">비고</label>
                                <textarea
                                    value={itemFormData.remarks}
                                    onChange={(e) => setItemFormData({ ...itemFormData, remarks: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                                >
                                    {editingItem ? '수정' : '추가'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetItemForm}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
                                >
                                    취소
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 제품그룹 추가/수정 모달 */}
            {isGroupModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            {editingGroup ? '제품그룹 수정' : '제품그룹 추가'}
                        </h3>
                        <form onSubmit={handleGroupSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">그룹명</label>
                                <input
                                    type="text"
                                    required
                                    value={groupFormData.name}
                                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">설명 (선택사항)</label>
                                <textarea
                                    value={groupFormData.description}
                                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="제품그룹에 대한 간단한 설명을 입력하세요"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                                >
                                    {editingGroup ? '수정' : '추가'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetGroupForm}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
                                >
                                    취소
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 창고 추가/수정 모달 */}
            {
                isWarehouseModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20">
                            <h3 className="text-2xl font-bold text-white mb-4">
                                {editingWarehouse ? '창고 수정' : '창고 추가'}
                            </h3>
                            <form onSubmit={handleWarehouseSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">창고명</label>
                                    <input
                                        type="text"
                                        required
                                        value={warehouseFormData.name}
                                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">창고위치</label>
                                    <input
                                        type="text"
                                        required
                                        value={warehouseFormData.location}
                                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, location: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">담당자</label>
                                    <input
                                        type="text"
                                        required
                                        value={warehouseFormData.manager}
                                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, manager: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">E-mail</label>
                                    <input
                                        type="email"
                                        required
                                        value={warehouseFormData.email}
                                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, email: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">비고</label>
                                    <textarea
                                        value={warehouseFormData.remarks}
                                        onChange={(e) => setWarehouseFormData({ ...warehouseFormData, remarks: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                                    >
                                        {editingWarehouse ? '수정' : '추가'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetWarehouseForm}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
                                    >
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* 출고처 추가/수정 모달 */}
            {
                isCustomerModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20">
                            <h3 className="text-2xl font-bold text-white mb-4">
                                {editingCustomer ? '출고처 수정' : '출고처 추가'}
                            </h3>
                            <form onSubmit={handleCustomerSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">더존번호</label>
                                    <input
                                        type="text"
                                        required
                                        value={customerFormData.douzoneNumber}
                                        onChange={(e) => setCustomerFormData({ ...customerFormData, douzoneNumber: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">이름</label>
                                    <input
                                        type="text"
                                        required
                                        value={customerFormData.name}
                                        onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">연락처</label>
                                    <input
                                        type="text"
                                        required
                                        value={customerFormData.contact}
                                        onChange={(e) => setCustomerFormData({ ...customerFormData, contact: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">주소</label>
                                    <input
                                        type="text"
                                        required
                                        value={customerFormData.address}
                                        onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">비고</label>
                                    <textarea
                                        value={customerFormData.remarks}
                                        onChange={(e) => setCustomerFormData({ ...customerFormData, remarks: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                                    >
                                        {editingCustomer ? '수정' : '추가'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetCustomerForm}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
                                    >
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
