import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Item, Transaction, Warehouse } from '../types';
import { getItems, addTransaction, getTransactionsByDateRange, getWarehouses } from '../storage';
import * as XLSX from 'xlsx';

export default function InventoryPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('전체');
    const [activeTab, setActiveTab] = useState<'stock' | 'in' | 'out' | 'search'>('stock');

    // 입고 폼
    const [inboundForm, setInboundForm] = useState({
        warehouse: '',
        itemId: '',
        quantity: 0,
        date: new Date().toISOString().split('T')[0],
        remarks: '',
    });

    // 출고 폼
    const [outboundForm, setOutboundForm] = useState({
        warehouse: '',
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
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
            startDate: formatDate(today),
            endDate: formatDate(lastDay),
        };
    });

    const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
    const [searchType, setSearchType] = useState<'all' | 'item' | 'customer' | 'warehouse'>('all');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [searchResults, setSearchResults] = useState<Transaction[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [itemsData, warehousesData] = await Promise.all([getItems(), getWarehouses()]);
        // 수량이 있는 품목이 위로 오도록 정렬하거나 그대로 둠
        setItems(itemsData);
        setWarehouses(warehousesData);
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
            warehouse: inboundForm.warehouse,
            remarks: inboundForm.remarks,
        });

        setInboundForm({
            warehouse: '',
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
            alert('재고가 부족하여 마이너스 재고가 발생합니다.');
        }

        await addTransaction({
            itemId: outboundForm.itemId,
            itemName: item.name,
            type: 'OUT',
            quantity: outboundForm.quantity,
            date: outboundForm.date,
            target: outboundForm.target,
            warehouse: outboundForm.warehouse,
            remarks: outboundForm.remarks,
        });

        setOutboundForm({
            warehouse: '',
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
        let results = await getTransactionsByDateRange(searchForm.startDate, searchForm.endDate);

        // 날짜 내림차순 정렬 (최신순)
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 검색어 필터링
        if (searchType !== 'all' && searchKeyword) {
            const keyword = searchKeyword.toLowerCase();
            results = results.filter(t => {
                if (searchType === 'item') {
                    return t.itemName.toLowerCase().includes(keyword);
                } else if (searchType === 'customer') {
                    // target(출고처)이 있는 경우에만 검색
                    return t.target && t.target.toLowerCase().includes(keyword);
                } else if (searchType === 'warehouse') {
                    return t.warehouse && t.warehouse.toLowerCase().includes(keyword);
                }
                return true;
            });
        }

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

    const handleDownloadStockExcel = () => {
        const stockData = items
            .filter(item => selectedWarehouse === '전체' || (item.warehouse || '비트본사') === selectedWarehouse)
            .filter(item => item.quantity !== 0)
            .map(item => ({
                '품명': item.name,
                '제품그룹': item.group,
                '창고': item.warehouse || '비트본사',
                '품번': item.partNumber,
                '현재고': item.quantity,
                '가격': item.price
            }));

        const ws = XLSX.utils.json_to_sheet(stockData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "현재고현황");
        XLSX.writeFile(wb, `현재고현황_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadHistoryExcel = () => {
        const historyData = searchResults.map(t => ({
            '날짜': t.date,
            '품명': t.itemName,
            '구분': t.type === 'IN' ? '입고' : '출고',
            '수량': t.quantity,
            '출고처': t.target || '-',
            '비고': t.remarks
        }));

        const ws = XLSX.utils.json_to_sheet(historyData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "입출고조회");
        XLSX.writeFile(wb, `입출고내역_${searchForm.startDate}_${searchForm.endDate}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Layout title="자재 관리" showBackButton={true}>
            <div className="flex justify-end mb-4 print:hidden">
                <button
                    onClick={handlePrint}
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg font-bold"
                >
                    <i className="ri-printer-line"></i>
                    인쇄
                </button>
            </div>

            {/* 탭 메뉴 */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 pb-1 print:hidden">
                {[
                    { id: 'stock', label: '현재고 현황' },
                    { id: 'in', label: '입고' },
                    { id: 'out', label: '출고' },
                    { id: 'search', label: '입출고조회' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-3 rounded-t-lg font-bold transition-all ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-md translate-y-[1px]'
                            : 'bg-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 현재고 현황 */}
            {activeTab === 'stock' && (
                <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                    <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center print:bg-white print:border-none">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-gray-800">현재고 현황</h2>
                            <button
                                onClick={handleDownloadStockExcel}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition shadow flex items-center gap-1 print:hidden"
                            >
                                <i className="ri-file-excel-2-line"></i>
                                엑셀 다운로드
                            </button>
                        </div>
                        <select
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="bg-white border border-gray-300 rounded-lg text-gray-700 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
                        >
                            <option value="전체">전체 창고</option>
                            {warehouses.map((wh) => (
                                <option key={wh.id} value={wh.name}>
                                    {wh.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">품명</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">제품그룹</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">창고</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">품번</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">현재고</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">가격</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                            등록된 품목이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    items
                                        .filter(item => selectedWarehouse === '전체' || (item.warehouse || '비트본사') === selectedWarehouse)
                                        .filter(item => item.quantity !== 0)
                                        .map((item) => (
                                            <tr key={item.id} className="hover:bg-blue-50 transition">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{item.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.group}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.warehouse || '비트본사'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{item.partNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`font-bold px-2 py-1 rounded-full text-sm ${item.quantity > 10 ? 'bg-green-100 text-green-800' : item.quantity > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">₩{item.price.toLocaleString()}</td>
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
                <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-200 max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">입고 처리</h2>
                    <form onSubmit={handleInbound} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">창고 선택</label>
                                <select
                                    required
                                    value={inboundForm.warehouse}
                                    onChange={(e) => setInboundForm({ ...inboundForm, warehouse: e.target.value, itemId: '' })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                >
                                    <option value="">창고를 선택하세요</option>
                                    {warehouses.map((wh) => (
                                        <option key={wh.id} value={wh.name}>
                                            {wh.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">입고 날짜</label>
                                <input
                                    type="date"
                                    required
                                    value={inboundForm.date}
                                    onChange={(e) => setInboundForm({ ...inboundForm, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">품명 선택</label>
                            <select
                                required
                                value={inboundForm.itemId}
                                onChange={(e) => setInboundForm({ ...inboundForm, itemId: e.target.value })}
                                disabled={!inboundForm.warehouse}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 transition-all"
                            >
                                <option value="">선택하세요</option>
                                {items
                                    .filter(item => (item.warehouse || '비트본사') === inboundForm.warehouse)
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.partNumber})
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">입고 수량</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={inboundForm.quantity}
                                onChange={(e) => setInboundForm({ ...inboundForm, quantity: Number(e.target.value) })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">비고</label>
                            <textarea
                                value={inboundForm.remarks}
                                onChange={(e) => setInboundForm({ ...inboundForm, remarks: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.02]"
                        >
                            <i className="ri-download-line mr-2"></i>
                            입고 처리
                        </button>
                    </form>
                </div>
            )}

            {/* 출고 */}
            {activeTab === 'out' && (
                <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-200 max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">출고 처리</h2>
                    <form onSubmit={handleOutbound} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">창고 선택</label>
                                <select
                                    required
                                    value={outboundForm.warehouse}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, warehouse: e.target.value, itemId: '' })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                >
                                    <option value="">창고를 선택하세요</option>
                                    {warehouses.map((wh) => (
                                        <option key={wh.id} value={wh.name}>
                                            {wh.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">출고 날짜</label>
                                <input
                                    type="date"
                                    required
                                    value={outboundForm.date}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">품명 선택</label>
                            <select
                                required
                                value={outboundForm.itemId}
                                onChange={(e) => setOutboundForm({ ...outboundForm, itemId: e.target.value })}
                                disabled={!outboundForm.warehouse}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-all"
                            >
                                <option value="">선택하세요</option>
                                {items
                                    .filter(item => (item.warehouse || '비트본사') === outboundForm.warehouse)
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.partNumber}) - 재고: {item.quantity}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">출고 수량</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={outboundForm.quantity}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, quantity: Number(e.target.value) })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">출고처</label>
                                <input
                                    type="text"
                                    required
                                    value={outboundForm.target}
                                    onChange={(e) => setOutboundForm({ ...outboundForm, target: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">비고</label>
                            <textarea
                                value={outboundForm.remarks}
                                onChange={(e) => setOutboundForm({ ...outboundForm, remarks: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.02]"
                        >
                            <i className="ri-upload-line mr-2"></i>
                            출고 처리
                        </button>
                    </form>
                </div>
            )}

            {/* 재고 검색 */}
            {activeTab === 'search' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-800 mb-6">입출고조회</h2>

                        {/* 기간 선택 라디오 버튼 */}
                        <div className="flex gap-6 mb-6">
                            {[1, 3, 6, 12].map((months) => (
                                <label key={months} className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="radio"
                                            name="searchPeriod"
                                            className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-full checked:border-blue-600 checked:border-4 transition-all"
                                            checked={selectedPeriod === months}
                                            onChange={() => handlePeriodSelect(months)}
                                        />
                                    </div>
                                    <span className={`text-sm font-bold transition-colors ${selectedPeriod === months ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-800'
                                        }`}>
                                        {months === 12 ? '1년' : `${months}개월`}
                                    </span>
                                </label>
                            ))}
                        </div>

                        <form onSubmit={handleSearch} className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">시작 날짜</label>
                                    <input
                                        type="date"
                                        required
                                        value={searchForm.startDate}
                                        onChange={(e) => handleDateChange('startDate', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">종료 날짜</label>
                                    <input
                                        type="date"
                                        required
                                        value={searchForm.endDate}
                                        onChange={(e) => handleDateChange('endDate', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* 조회 유형 필터 */}
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">조회 유형</label>
                                    <select
                                        value={searchType}
                                        onChange={(e) => {
                                            setSearchType(e.target.value as 'all' | 'item' | 'customer');
                                            setSearchKeyword('');
                                        }}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">전체</option>
                                        <option value="item">품목</option>
                                        <option value="customer">더존번호(출고처)</option>
                                        <option value="warehouse">창고</option>
                                    </select>
                                </div>
                                {searchType !== 'all' && (
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">
                                            {searchType === 'item' ? '품목명' : searchType === 'customer' ? '출고처명' : '창고 선택'}
                                        </label>
                                        {searchType === 'warehouse' ? (
                                            <select
                                                value={searchKeyword}
                                                onChange={(e) => setSearchKeyword(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">전체 창고</option>
                                                {warehouses.map((wh) => (
                                                    <option key={wh.id} value={wh.name}>
                                                        {wh.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={searchKeyword}
                                                onChange={(e) => setSearchKeyword(e.target.value)}
                                                placeholder={searchType === 'item' ? '품목명으로 검색' : '출고처명으로 검색'}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        )}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md transition-all flex-shrink-0"
                                >
                                    <i className="ri-search-line mr-2"></i>
                                    조회
                                </button>
                            </div>
                        </form>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                            <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-800">검색 결과 ({searchResults.length}건)</h3>
                                <button
                                    onClick={handleDownloadHistoryExcel}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm transition shadow flex items-center gap-1 print:hidden"
                                >
                                    <i className="ri-file-excel-2-line"></i>
                                    엑셀 다운로드
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">날짜</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">품명</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">구분</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">수량</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">출고처</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">비고</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {searchResults.map((transaction) => (
                                            <tr key={transaction.id} className="hover:bg-blue-50 transition">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{transaction.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{transaction.itemName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${transaction.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {transaction.type === 'IN' ? '입고' : '출고'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-semibold">{transaction.quantity}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{transaction.target || '-'}</td>
                                                <td className="px-6 py-4 text-gray-500">{transaction.remarks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}
