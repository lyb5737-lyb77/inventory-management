import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Item, Transaction } from '../types';
import { getItems, addTransaction, getTransactionsByDateRange } from '../storage';

export default function InventoryPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Item[]>([]);
    const [activeTab, setActiveTab] = useState<'stock' | 'in' | 'out' | 'search'>('stock');

    // 입고 폼
    const [inboundForm, setInboundForm] = useState({
        itemId: '',
        quantity: 0,
        date: new Date().toISOString().split('T')[0],
        remarks: '',
    });

    // 출고 폼
    const [outboundForm, setOutboundForm] = useState({
        itemId: '',
        quantity: 0,
        target: '',
        date: new Date().toISOString().split('T')[0],
        remarks: '',
    });

    // 날짜 포맷팅 헬퍼
    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 검색 폼
    const [searchForm, setSearchForm] = useState(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
            startDate: formatDate(firstDay),
            endDate: formatDate(lastDay),
        };
    });

    const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

    const [searchResults, setSearchResults] = useState<Transaction[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const itemsData = await getItems();
        setItems(itemsData);
    };

    const handleInbound = async (e: React.FormEvent) => {
        e.preventDefault();
        const item = items.find(i => i.id === inboundForm.itemId);
        if (!item) return;

        await addTransaction({
            itemId: inboundForm.itemId,
            itemName: item.name,
            type: 'IN',
            quantity: inboundForm.quantity,
            date: inboundForm.date,
            remarks: inboundForm.remarks,
        });

        setInboundForm({
            itemId: '',
            quantity: 0,
            date: new Date().toISOString().split('T')[0],
            remarks: '',
        });
        await loadData();
        alert('입고 처리되었습니다.');
    };

    const handleOutbound = async (e: React.FormEvent) => {
        e.preventDefault();
        const item = items.find(i => i.id === outboundForm.itemId);
        if (!item) return;

        if (item.quantity < outboundForm.quantity) {
            alert('재고가 부족합니다.');
            return;
        }

        await addTransaction({
            itemId: outboundForm.itemId,
            itemName: item.name,
            type: 'OUT',
            quantity: outboundForm.quantity,
            date: outboundForm.date,
            target: outboundForm.target,
            remarks: outboundForm.remarks,
        });

        setOutboundForm({
            itemId: '',
            quantity: 0,
            target: '',
            date: new Date().toISOString().split('T')[0],
            remarks: '',
        });
        await loadData();
        alert('출고 처리되었습니다.');
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const results = await getTransactionsByDateRange(searchForm.startDate, searchForm.endDate);
        setSearchResults(results);
    };

    const handlePeriodSelect = (months: number) => {
        const today = new Date();
        const endDate = formatDate(today);
        const startDate = new Date(today);
        startDate.setMonth(today.getMonth() - months);

        setSearchForm({
            startDate: formatDate(startDate),
            endDate: endDate
        });
        setSelectedPeriod(months);
    };

    const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
        setSearchForm(prev => ({ ...prev, [field]: value }));
        setSelectedPeriod(null); // 수동 변경 시 라디오 버튼 선택 해제
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-blue-900">
            {/* 네비게이션 */}
            <nav className="bg-black/30 backdrop-blur-md border-b border-white/10 print:hidden">
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
                        <h1 className="text-2xl font-bold text-white">자재 관리</h1>
                        <button
                            onClick={handlePrint}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            인쇄
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* 탭 메뉴 */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-1 mb-6 flex gap-1 print:hidden border border-white/20">
                    <button
                        onClick={() => setActiveTab('stock')}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${activeTab === 'stock'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        현재고 현황
                    </button>
                    <button
                        onClick={() => setActiveTab('in')}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${activeTab === 'in'
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                            : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        입고
                    </button>
                    <button
                        onClick={() => setActiveTab('out')}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${activeTab === 'out'
                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                            : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        출고
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${activeTab === 'search'
                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                            : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        재고 검색
                    </button>
                </div>

                {/* 현재고 현황 */}
                {activeTab === 'stock' && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                        <div className="p-6 bg-black/30 border-b border-white/10">
                            <h2 className="text-2xl font-bold text-white">현재고 현황</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/20">
                                <thead className="bg-black/20">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">품명</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">제품그룹</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">품번</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">현재고</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">가격</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                등록된 품목이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/5 transition">
                                                <td className="px-6 py-4 whitespace-nowrap text-white font-medium">{item.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.group}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">{item.partNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`font-bold ${item.quantity > 10 ? 'text-green-400' : item.quantity > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">₩{item.price.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 입고 */}
                {activeTab === 'in' && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-6">입고 처리</h2>
                        <form onSubmit={handleInbound} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">품명 선택</label>
                                <select
                                    required
                                    value={inboundForm.itemId}
                                    onChange={(e) => setInboundForm({ ...inboundForm, itemId: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">선택하세요</option>
                                    {items.map((item) => (
                                        <option key={item.id} value={item.id} className="bg-gray-800">
                                            {item.name} ({item.partNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">입고 수량</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={inboundForm.quantity}
                                    onChange={(e) => setInboundForm({ ...inboundForm, quantity: Number(e.target.value) })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">입고 날짜</label>
                                <input
                                    type="date"
                                    required
                                    value={inboundForm.date}
                                    onChange={(e) => setInboundForm({ ...inboundForm, date: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">비고</label>
                                <textarea
                                    value={inboundForm.remarks}
                                    onChange={(e) => setInboundForm({ ...inboundForm, remarks: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg transform transition hover:scale-105"
                            >
                                입고 처리
                            </button>
                        </form>
                    </div>
                )}

                {/* 출고 */}
                {activeTab === 'out' && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-6">출고 처리</h2>
                        <form onSubmit={handleOutbound} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">품명 선택</label>
                                <select
                                    required
                                    value={outboundForm.itemId}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, itemId: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    <option value="">선택하세요</option>
                                    {items.map((item) => (
                                        <option key={item.id} value={item.id} className="bg-gray-800">
                                            {item.name} ({item.partNumber}) - 재고: {item.quantity}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">출고 수량</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={outboundForm.quantity}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, quantity: Number(e.target.value) })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">출고처</label>
                                <input
                                    type="text"
                                    required
                                    value={outboundForm.target}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, target: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">출고 날짜</label>
                                <input
                                    type="date"
                                    required
                                    value={outboundForm.date}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, date: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">비고</label>
                                <textarea
                                    value={outboundForm.remarks}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, remarks: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg transform transition hover:scale-105"
                            >
                                출고 처리
                            </button>
                        </form>
                    </div>
                )}

                {/* 재고 검색 */}
                {activeTab === 'search' && (
                    <div className="space-y-6">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-6">날짜별 재고 검색</h2>

                            {/* 기간 선택 라디오 버튼 */}
                            <div className="flex gap-6 mb-6">
                                {[1, 3, 6, 12].map((months) => (
                                    <label key={months} className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name="searchPeriod"
                                                className="peer appearance-none w-5 h-5 border-2 border-gray-400 rounded-full checked:border-purple-500 checked:border-4 transition-all"
                                                checked={selectedPeriod === months}
                                                onChange={() => handlePeriodSelect(months)}
                                            />
                                        </div>
                                        <span className={`text-sm font-medium transition-colors ${selectedPeriod === months ? 'text-purple-400' : 'text-gray-300 group-hover:text-white'
                                            }`}>
                                            {months === 12 ? '1년' : `${months}개월`}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <form onSubmit={handleSearch} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">시작 날짜</label>
                                    <input
                                        type="date"
                                        required
                                        value={searchForm.startDate}
                                        onChange={(e) => handleDateChange('startDate', e.target.value)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">종료 날짜</label>
                                    <input
                                        type="date"
                                        required
                                        value={searchForm.endDate}
                                        onChange={(e) => handleDateChange('endDate', e.target.value)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg"
                                >
                                    검색
                                </button>
                            </form>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                                <div className="p-6 bg-black/30 border-b border-white/10">
                                    <h3 className="text-xl font-bold text-white">검색 결과 ({searchResults.length}건)</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-white/20">
                                        <thead className="bg-black/20">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">날짜</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">품명</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">구분</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">수량</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">출고처</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">비고</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {searchResults.map((transaction) => (
                                                <tr key={transaction.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{transaction.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-white">{transaction.itemName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${transaction.type === 'IN' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {transaction.type === 'IN' ? '입고' : '출고'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{transaction.quantity}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{transaction.target || '-'}</td>
                                                    <td className="px-6 py-4 text-gray-300">{transaction.remarks}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
