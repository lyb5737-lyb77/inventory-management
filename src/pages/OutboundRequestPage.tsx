import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import Layout from '../components/Layout';
import { Item, Warehouse, Customer } from '../types';
import { getItems, getWarehouses, getCustomers, addTransaction } from '../storage';
import { sendOutboundEmail } from '../services/email';

interface SelectedItem {
    itemId: string;
    quantity: number;
}

export default function OutboundRequestPage() {
    const navigate = useNavigate();
    const { accounts } = useMsal();
    const currentUser = accounts[0];

    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        warehouse: '',
        selectedItems: [] as SelectedItem[],
        customerId: '',
        customerName: '', // For display
        remarks: '',
    });

    // Customer Search Modal State
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [itemsData, warehousesData, customersData] = await Promise.all([
                getItems(),
                getWarehouses(),
                getCustomers()
            ]);
            setItems(itemsData);
            setWarehouses(warehousesData);
            setCustomers(customersData);
        } catch (err: any) {
            setError(err.message || '데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        !formData.warehouse || (item.warehouse || '비트본사') === formData.warehouse
    );

    const selectedCustomer = customers.find(c => c.id === formData.customerId);

    const handleCustomerSelect = (customer: Customer) => {
        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            customerName: customer.name
        }));
        setIsCustomerModalOpen(false);
    };

    const handleAddItem = () => {
        if (formData.selectedItems.length >= 3) {
            alert('최대 3개의 품목만 선택할 수 있습니다.');
            return;
        }
        setFormData(prev => ({
            ...prev,
            selectedItems: [...prev.selectedItems, { itemId: '', quantity: 1 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            selectedItems: prev.selectedItems.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index: number, field: 'itemId' | 'quantity', value: string | number) => {
        setFormData(prev => ({
            ...prev,
            selectedItems: prev.selectedItems.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.warehouse || formData.selectedItems.length === 0 || !formData.customerId) {
            alert('창고, 품목, 출고처를 모두 선택해주세요.');
            return;
        }

        // 모든 품목이 선택되고 수량이 입력되었는지 확인
        for (const selectedItem of formData.selectedItems) {
            if (!selectedItem.itemId || selectedItem.quantity <= 0) {
                alert('모든 품목을 선택하고 수량을 입력해주세요.');
                return;
            }
        }

        const selectedWarehouse = warehouses.find(w => w.name === formData.warehouse);
        const selectedCustomer = customers.find(c => c.id === formData.customerId);

        if (!selectedWarehouse || !selectedCustomer) {
            alert('데이터 오류가 발생했습니다.');
            return;
        }

        // 재고 확인 및 품목 정보 수집
        const itemsToProcess: Array<{ item: Item; quantity: number }> = [];
        for (const selectedItem of formData.selectedItems) {
            const item = items.find(i => i.id === selectedItem.itemId);
            if (!item) {
                alert('품목 정보를 찾을 수 없습니다.');
                return;
            }
            if (item.quantity < selectedItem.quantity) {
                alert(`${item.name}의 재고가 부족합니다. (현재고: ${item.quantity})`);
                return;
            }
            itemsToProcess.push({ item, quantity: selectedItem.quantity });
        }

        if (!selectedWarehouse.email) {
            alert('선택한 창고의 담당자 이메일 정보가 없습니다.');
            return;
        }

        if (!confirm('출고 신청을 하시겠습니까?')) return;

        setLoading(true);
        try {
            // 1. Send Email with multiple items
            await sendOutboundEmail({
                warehouseName: selectedWarehouse.name,
                managerEmail: selectedWarehouse.email,
                items: itemsToProcess.map(({ item, quantity }) => ({
                    name: item.name,
                    quantity
                })),
                customerName: selectedCustomer.name,
                customerAddress: selectedCustomer.address,
                customerContact: selectedCustomer.contact,
                requesterName: currentUser?.name || 'Unknown User',
                remarks: formData.remarks
            });

            // 2. Record Transaction for each item
            for (const { item, quantity } of itemsToProcess) {
                await addTransaction({
                    itemId: item.id,
                    itemName: item.name,
                    type: 'OUT',
                    quantity: quantity,
                    date: new Date().toISOString().split('T')[0],
                    target: selectedCustomer.name,
                    warehouse: selectedWarehouse.name,
                    remarks: `[출고신청] ${formData.remarks}`,
                });
            }

            alert('출고 신청이 완료되었습니다.');
            navigate('/inventory');
        } catch (err: any) {
            console.error(err);
            setError(err.message || '출고 신청 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        c.douzoneNumber.includes(customerSearchTerm)
    );

    return (
        <Layout title="출고 신청" showBackButton={true}>
            <div className="max-w-4xl mx-auto">
                {loading && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-700 font-semibold">처리 중...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex justify-between items-center">
                        <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i> {error}</span>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                            <i className="ri-close-line"></i>
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Warehouse Selection */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">출고 창고</label>
                            <select
                                required
                                value={formData.warehouse}
                                onChange={(e) => setFormData({ ...formData, warehouse: e.target.value, selectedItems: [] })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option value="">창고를 선택하세요</option>
                                {warehouses.map((wh) => (
                                    <option key={wh.id} value={wh.name}>
                                        {wh.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selected Items */}
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <label className="block text-sm font-bold text-gray-700">
                                    품목 목록 ({formData.selectedItems.length}/3)
                                </label>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    disabled={!formData.warehouse || formData.selectedItems.length >= 3}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                                >
                                    <i className="ri-add-line"></i>
                                    품목 추가
                                </button>
                            </div>

                            {formData.selectedItems.length === 0 ? (
                                <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400 font-medium">
                                    품목을 추가해주세요
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.selectedItems.map((selectedItem, index) => (
                                        <div key={index} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                            <div className="flex gap-4 items-start">
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">품목</label>
                                                        <select
                                                            required
                                                            value={selectedItem.itemId}
                                                            onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">품목을 선택하세요</option>
                                                            {filteredItems
                                                                .filter(item => !formData.selectedItems.some((si, i) => i !== index && si.itemId === item.id))
                                                                .map((item) => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.name} ({item.partNumber}) - 재고: {item.quantity}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">수량</label>
                                                        <input
                                                            type="number"
                                                            required
                                                            min="1"
                                                            value={selectedItem.quantity}
                                                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="mt-7 p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition"
                                                    title="품목 제거"
                                                >
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Customer Selection */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">출고처</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    readOnly
                                    value={formData.customerName}
                                    placeholder="출고처를 선택하세요"
                                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none cursor-pointer"
                                    onClick={() => setIsCustomerModalOpen(true)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsCustomerModalOpen(true)}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md"
                                >
                                    <i className="ri-search-line mr-2"></i>
                                    검색
                                </button>
                            </div>
                            {selectedCustomer && (
                                <div className="mt-4 p-5 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                                    <div className="flex gap-4">
                                        <div className="w-20 text-gray-500 font-bold">주소</div>
                                        <div className="text-gray-800">{selectedCustomer.address}</div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-20 text-gray-500 font-bold">연락처</div>
                                        <div className="text-gray-800">{selectedCustomer.contact}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Remarks */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">비고</label>
                            <textarea
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                placeholder="요청 사항이나 특이 사항을 입력하세요"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.01] flex justify-center items-center gap-2 text-lg"
                        >
                            <i className="ri-send-plane-fill"></i>
                            출고 신청 완료
                        </button>
                    </form>
                </div>
            </div>

            {/* Customer Search Modal */}
            {isCustomerModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800">출고처 검색</h3>
                            <button
                                onClick={() => setIsCustomerModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="relative">
                                <i className="ri-search-line absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                <input
                                    type="text"
                                    placeholder="출고처명 또는 더존번호로 검색..."
                                    value={customerSearchTerm}
                                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 border rounded-xl border-gray-100">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">더존번호</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">출고처명</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">연락처</th>
                                        <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase">선택</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-12 text-center text-gray-400">
                                                검색 결과가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCustomers.map((customer) => (
                                            <tr key={customer.id} className="hover:bg-blue-50 transition">
                                                <td className="px-5 py-3 text-gray-600 font-mono text-sm">{customer.douzoneNumber}</td>
                                                <td className="px-5 py-3 text-gray-900 font-bold">{customer.name}</td>
                                                <td className="px-5 py-3 text-gray-600">{customer.contact}</td>
                                                <td className="px-5 py-3 text-right">
                                                    <button
                                                        onClick={() => handleCustomerSelect(customer)}
                                                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-sm px-4 py-1.5 rounded-lg transition"
                                                    >
                                                        선택
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
