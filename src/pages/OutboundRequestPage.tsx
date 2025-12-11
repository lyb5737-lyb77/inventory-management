import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
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
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
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
                        <h1 className="text-2xl font-bold text-white">출고 신청</h1>
                        <div className="w-20"></div>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

                {error && (
                    <div className="mb-6 bg-red-500/20 border border-red-500 rounded-lg p-4 flex justify-between items-center">
                        <span className="text-white">{error}</span>
                        <button onClick={() => setError(null)} className="text-white hover:text-gray-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Warehouse Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">출고 창고</label>
                            <select
                                required
                                value={formData.warehouse}
                                onChange={(e) => setFormData({ ...formData, warehouse: e.target.value, selectedItems: [] })}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="" className="bg-gray-800">창고를 선택하세요</option>
                                {warehouses.map((wh) => (
                                    <option key={wh.id} value={wh.name} className="bg-gray-800">
                                        {wh.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selected Items */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-300">
                                    품목 목록 ({formData.selectedItems.length}/3)
                                </label>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    disabled={!formData.warehouse || formData.selectedItems.length >= 3}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    품목 추가
                                </button>
                            </div>

                            {formData.selectedItems.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center text-gray-400">
                                    품목을 추가해주세요
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {formData.selectedItems.map((selectedItem, index) => (
                                        <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                            <div className="flex gap-3 items-start">
                                                <div className="flex-1 space-y-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">품목</label>
                                                        <select
                                                            required
                                                            value={selectedItem.itemId}
                                                            onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        >
                                                            <option value="" className="bg-gray-800">품목을 선택하세요</option>
                                                            {filteredItems
                                                                .filter(item => !formData.selectedItems.some((si, i) => i !== index && si.itemId === item.id))
                                                                .map((item) => (
                                                                    <option key={item.id} value={item.id} className="bg-gray-800">
                                                                        {item.name} ({item.partNumber}) - 재고: {item.quantity}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">수량</label>
                                                        <input
                                                            type="number"
                                                            required
                                                            min="1"
                                                            value={selectedItem.quantity}
                                                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="mt-6 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition"
                                                    title="품목 제거"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Customer Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">출고처</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={formData.customerName}
                                    placeholder="출고처를 선택하세요"
                                    className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none cursor-pointer"
                                    onClick={() => setIsCustomerModalOpen(true)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsCustomerModalOpen(true)}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                                >
                                    검색
                                </button>
                            </div>
                            {selectedCustomer && (
                                <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10 space-y-2">
                                    <div className="flex gap-4">
                                        <div className="w-20 text-gray-400 font-medium">주소</div>
                                        <div className="text-white">{selectedCustomer.address}</div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-20 text-gray-400 font-medium">연락처</div>
                                        <div className="text-white">{selectedCustomer.contact}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Remarks */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">비고</label>
                            <textarea
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="요청 사항이나 특이 사항을 입력하세요"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.02]"
                        >
                            출고 신청 완료
                        </button>
                    </form>
                </div>
            </div>

            {/* Customer Search Modal */}
            {isCustomerModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-white/20 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-white">출고처 검색</h3>
                            <button
                                onClick={() => setIsCustomerModalOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="출고처명 또는 더존번호로 검색..."
                                value={customerSearchTerm}
                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-black/30 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">더존번호</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">출고처명</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">연락처</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">선택</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {filteredCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                                검색 결과가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCustomers.map((customer) => (
                                            <tr key={customer.id} className="hover:bg-white/5 transition">
                                                <td className="px-4 py-3 text-gray-300">{customer.douzoneNumber}</td>
                                                <td className="px-4 py-3 text-white font-medium">{customer.name}</td>
                                                <td className="px-4 py-3 text-gray-300">{customer.contact}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleCustomerSelect(customer)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition"
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
        </div>
    );
}
