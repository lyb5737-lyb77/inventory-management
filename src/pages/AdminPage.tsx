import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PermissionAdminPanel from '../components/PermissionAdminPanel';
import MailSettingsPanel from '../components/MailSettingsPanel';
import { useAuth } from '../auth/AuthContext';
import { Item, ProductGroup, Warehouse, Customer } from '../types';
import {
    getItems, addItem, updateItem, deleteItem,
    getProductGroups, addProductGroup, updateProductGroup, deleteProductGroup,
    getWarehouses, addWarehouse, updateWarehouse, deleteWarehouse,
    getCustomers, addCustomer, updateCustomer, deleteCustomer
} from '../storage';

type AdminTabId = 'items' | 'groups' | 'warehouses' | 'customers' | 'permissions' | 'mail';

export default function AdminPage() {
    const { role } = useAuth();
    const isAdminRole = role === 'ADMIN';

    const [activeTab, setActiveTab] = useState<AdminTabId>('items');

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
        email: '',
        address: '',
        businessNumber: '',
        representativeName: '',
        mobilePhone: '',
        remarks: '',
    });

    const [customerSearch, setCustomerSearch] = useState('');

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
            email: customer.email || '',
            address: customer.address,
            businessNumber: customer.businessNumber || '',
            representativeName: customer.representativeName || '',
            mobilePhone: customer.mobilePhone || '',
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
            email: '',
            address: '',
            businessNumber: '',
            representativeName: '',
            mobilePhone: '',
            remarks: '',
        });
        setEditingCustomer(null);
        setIsCustomerModalOpen(false);
    };

    return (
        <Layout title="관리자 페이지" showBackButton={true}>
            {/* 로딩 표시 */}
            {loading && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-600 font-semibold">처리 중...</p>
                    </div>
                </div>
            )}

            {/* 에러 메시지 */}
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <i className="ri-error-warning-line text-xl"></i>
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                        <i className="ri-close-line text-xl"></i>
                    </button>
                </div>
            )}

            {/* 탭 네비게이션 */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 pb-1 flex-wrap">
                {[
                    { id: 'items' as const, label: '품목 관리', adminOnly: false },
                    { id: 'groups' as const, label: '제품그룹 관리', adminOnly: false },
                    { id: 'warehouses' as const, label: '창고 관리', adminOnly: false },
                    { id: 'customers' as const, label: '출고처 관리', adminOnly: false },
                    { id: 'permissions' as const, label: '권한 관리', adminOnly: true },
                    { id: 'mail' as const, label: '메일 설정', adminOnly: true },
                ]
                    .filter(tab => !tab.adminOnly || isAdminRole)
                    .map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 rounded-t-lg font-bold transition-all ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-md translate-y-[1px]'
                                : 'bg-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                        >
                            {tab.id === 'permissions' && (
                                <i className="ri-shield-user-line mr-2"></i>
                            )}
                            {tab.id === 'mail' && (
                                <i className="ri-mail-settings-line mr-2"></i>
                            )}
                            {tab.label}
                        </button>
                    ))}
            </div>

            {/* 품목 관리 탭 */}
            {activeTab === 'items' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">품목 리스트</h2>
                        <button
                            onClick={() => setIsItemModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
                        >
                            <i className="ri-add-line"></i> 품목 추가
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">품명</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">제품그룹</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">창고</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">품번</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">수량</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">가격</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">비고</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">작업</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                                등록된 품목이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{item.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.group}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.warehouse || '비트본사'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.partNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-semibold">{item.quantity}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">₩{item.price.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500 text-sm max-w-xs truncate">{item.remarks}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleItemEdit(item)}
                                                        className="text-blue-600 hover:text-blue-800 mr-4 transition-colors"
                                                    >
                                                        <i className="ri-edit-line text-lg"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => handleItemDelete(item.id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors"
                                                    >
                                                        <i className="ri-delete-bin-line text-lg"></i>
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
                        <h2 className="text-2xl font-bold text-gray-800">제품그룹 리스트</h2>
                        <button
                            onClick={() => setIsGroupModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
                        >
                            <i className="ri-add-line"></i> 제품그룹 추가
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">그룹명</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">설명</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">작업</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {productGroups.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                                등록된 제품그룹이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        productGroups.map((group) => (
                                            <tr key={group.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{group.name}</td>
                                                <td className="px-6 py-4 text-gray-600">{group.description || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleGroupEdit(group)}
                                                        className="text-blue-600 hover:text-blue-800 mr-4 transition-colors"
                                                    >
                                                        <i className="ri-edit-line text-lg"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => handleGroupDelete(group.id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors"
                                                    >
                                                        <i className="ri-delete-bin-line text-lg"></i>
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
                        <h2 className="text-2xl font-bold text-gray-800">창고 리스트</h2>
                        <button
                            onClick={() => setIsWarehouseModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
                        >
                            <i className="ri-add-line"></i> 창고 추가
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">창고명</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">위치</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">담당자</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">이메일</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">비고</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">작업</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {warehouses.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                등록된 창고가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        warehouses.map((warehouse) => (
                                            <tr key={warehouse.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{warehouse.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{warehouse.location}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{warehouse.manager}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{warehouse.email}</td>
                                                <td className="px-6 py-4 text-gray-500 text-sm max-w-xs truncate">{warehouse.remarks || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleWarehouseEdit(warehouse)}
                                                        className="text-blue-600 hover:text-blue-800 mr-4 transition-colors"
                                                    >
                                                        <i className="ri-edit-line text-lg"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => handleWarehouseDelete(warehouse.id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors"
                                                    >
                                                        <i className="ri-delete-bin-line text-lg"></i>
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
                        <h2 className="text-2xl font-bold text-gray-800">출고처 리스트</h2>
                        <div className="flex gap-4">
                            <div className="relative">
                                <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                <input
                                    type="text"
                                    placeholder="출고처명, 번호 검색"
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 shadow-sm"
                                />
                            </div>
                            <button
                                onClick={() => setIsCustomerModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
                            >
                                <i className="ri-add-line"></i> 출고처 추가
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">출고처명</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">더존번호</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">연락처</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">이메일</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">작업</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {customers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                등록된 출고처가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        customers
                                            .filter(c =>
                                                c.name.includes(customerSearch) ||
                                                c.douzoneNumber.includes(customerSearch)
                                            )
                                            .map((customer) => (
                                                <tr key={customer.id} className="hover:bg-blue-50 transition-colors">
                                                    <td className="px-6 py-4 truncate max-w-[240px] text-gray-900 font-medium" title={customer.name}>{customer.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{customer.douzoneNumber}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{customer.contact}</td>
                                                    <td className="px-6 py-4 text-gray-600">{customer.email}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleCustomerEdit(customer)}
                                                            className="text-blue-600 hover:text-blue-800 mr-4 transition-colors"
                                                        >
                                                            <i className="ri-edit-line text-lg"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleCustomerDelete(customer.id)}
                                                            className="text-red-500 hover:text-red-700 transition-colors"
                                                        >
                                                            <i className="ri-delete-bin-line text-lg"></i>
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

            {/* 권한 관리 탭 (ADMIN 전용) */}
            {activeTab === 'permissions' && isAdminRole && (
                <PermissionAdminPanel />
            )}

            {/* 메일 설정 탭 (ADMIN 전용) */}
            {activeTab === 'mail' && isAdminRole && (
                <MailSettingsPanel />
            )}

            {/* Modal Styles Updated */}
            {[isItemModalOpen, isGroupModalOpen, isWarehouseModalOpen, isCustomerModalOpen].some(Boolean) && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    {isItemModalOpen && (
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                                {editingItem ? '품목 수정' : '품목 추가'}
                            </h3>
                            <form onSubmit={handleItemSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">품명</label>
                                    <input type="text" required value={itemFormData.name} onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">제품그룹</label>
                                    <select required value={itemFormData.group} onChange={(e) => setItemFormData({ ...itemFormData, group: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                                        <option value="">선택하세요</option>
                                        {productGroups.map((group) => (
                                            <option key={group.id} value={group.name}>{group.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">창고</label>
                                        <select required value={itemFormData.warehouse} onChange={(e) => setItemFormData({ ...itemFormData, warehouse: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                                            {warehouses.map((wh) => (
                                                <option key={wh.id} value={wh.name}>{wh.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">품번</label>
                                        <input type="text" required value={itemFormData.partNumber} onChange={(e) => setItemFormData({ ...itemFormData, partNumber: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">수량</label>
                                        <input type="number" required value={itemFormData.quantity} onChange={(e) => setItemFormData({ ...itemFormData, quantity: Number(e.target.value) })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">가격</label>
                                        <input type="number" required value={itemFormData.price} onChange={(e) => setItemFormData({ ...itemFormData, price: Number(e.target.value) })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">비고</label>
                                    <textarea value={itemFormData.remarks} onChange={(e) => setItemFormData({ ...itemFormData, remarks: e.target.value })} rows={3}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-all">
                                        {editingItem ? '수정 완료' : '추가하기'}
                                    </button>
                                    <button type="button" onClick={resetItemForm} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl shadow-sm transition-all border border-gray-200">
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {isGroupModalOpen && (
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                                {editingGroup ? '제품그룹 수정' : '제품그룹 추가'}
                            </h3>
                            <form onSubmit={handleGroupSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">그룹명</label>
                                    <input type="text" required value={groupFormData.name} onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">설명 (선택사항)</label>
                                    <textarea value={groupFormData.description} onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })} rows={3}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        placeholder="제품그룹에 대한 간단한 설명" />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-all">
                                        {editingGroup ? '수정 완료' : '추가하기'}
                                    </button>
                                    <button type="button" onClick={resetGroupForm} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl shadow-sm transition-all border border-gray-200">
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {isWarehouseModalOpen && (
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                                {editingWarehouse ? '창고 수정' : '창고 추가'}
                            </h3>
                            <form onSubmit={handleWarehouseSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">창고명</label>
                                    <input type="text" required value={warehouseFormData.name} onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">창고위치</label>
                                    <input type="text" required value={warehouseFormData.location} onChange={(e) => setWarehouseFormData({ ...warehouseFormData, location: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">담당자</label>
                                    <input type="text" required value={warehouseFormData.manager} onChange={(e) => setWarehouseFormData({ ...warehouseFormData, manager: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
                                    <input type="email" required value={warehouseFormData.email} onChange={(e) => setWarehouseFormData({ ...warehouseFormData, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">비고</label>
                                    <textarea value={warehouseFormData.remarks} onChange={(e) => setWarehouseFormData({ ...warehouseFormData, remarks: e.target.value })} rows={3}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-all">
                                        {editingWarehouse ? '수정 완료' : '추가하기'}
                                    </button>
                                    <button type="button" onClick={resetWarehouseForm} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl shadow-sm transition-all border border-gray-200">
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {isCustomerModalOpen && (
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                                {editingCustomer ? '출고처 수정' : '출고처 추가'}
                            </h3>
                            <form onSubmit={handleCustomerSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">더존번호</label>
                                    <input type="text" required value={customerFormData.douzoneNumber} onChange={(e) => setCustomerFormData({ ...customerFormData, douzoneNumber: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">이름(출고처명)</label>
                                    <input type="text" required value={customerFormData.name} onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">사업자번호</label>
                                        <input type="text" value={customerFormData.businessNumber} onChange={(e) => setCustomerFormData({ ...customerFormData, businessNumber: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">대표명</label>
                                        <input type="text" value={customerFormData.representativeName} onChange={(e) => setCustomerFormData({ ...customerFormData, representativeName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">연락처</label>
                                        <input type="text" value={customerFormData.contact} onChange={(e) => setCustomerFormData({ ...customerFormData, contact: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">핸드폰</label>
                                        <input type="text" value={customerFormData.mobilePhone} onChange={(e) => setCustomerFormData({ ...customerFormData, mobilePhone: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">이메일</label>
                                    <input type="email" value={customerFormData.email} onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">주소</label>
                                    <input type="text" required value={customerFormData.address} onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">비고</label>
                                    <textarea value={customerFormData.remarks} onChange={(e) => setCustomerFormData({ ...customerFormData, remarks: e.target.value })} rows={3}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-all">
                                        {editingCustomer ? '수정 완료' : '추가하기'}
                                    </button>
                                    <button type="button" onClick={resetCustomerForm} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl shadow-sm transition-all border border-gray-200">
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}
