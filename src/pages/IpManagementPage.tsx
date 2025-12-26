import React, { useState, useEffect } from 'react';
import { IpRange, IpDetail } from '../types';
import { getIpRanges, getIpDetails, addIpRange, deleteIpRange, updateIpDetail, generateIpListInRange } from '../storage';
import { readIpInventoryExcel } from '../services/excelService';

// UI Helper: Status Badge
const StatusBadge = ({ status }: { status: string }) => {
    if (status === '사용중') {
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">사용중</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">사용가능</span>;
};

export default function IpManagementPage() {
    // Data State
    const [ranges, setRanges] = useState<IpRange[]>([]);
    const [details, setDetails] = useState<IpDetail[]>([]);
    const [loading, setLoading] = useState(false);

    // UI State
    const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editingDetail, setEditingDetail] = useState<Partial<IpDetail> | null>(null);

    // Range Form State
    const [newRange, setNewRange] = useState<Partial<IpRange>>({
        device: 'A',
        title: '',
        startIp: '',
        endIp: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedRanges, fetchedDetails] = await Promise.all([
                getIpRanges(),
                getIpDetails()
            ]);
            setRanges(fetchedRanges);
            setDetails(fetchedDetails);
        } catch (error) {
            console.error(error);
            alert('데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    // --- Logic ---

    // Group Ranges by Device
    const rangesByDevice = ranges.reduce((acc, range) => {
        if (!acc[range.device]) acc[range.device] = [];
        acc[range.device].push(range);
        return acc;
    }, {} as Record<string, IpRange[]>);

    // Get IPs for the selected range (merged with details)
    const getDisplayIps = () => {
        if (!selectedRangeId) return [];
        const range = ranges.find(r => r.id === selectedRangeId);
        if (!range) return [];

        const generatedIps = generateIpListInRange(range.startIp, range.endIp);

        return generatedIps.map(ip => {
            const detail = details.find(d => d.ipAddress === ip && d.rangeId === range.id);
            return {
                ipAddress: ip,
                rangeId: range.id,
                department: detail?.department || '',
                user: detail?.user || '',
                usage: detail?.usage || '',
                status: detail?.status || '사용가능',
                detailId: detail?.id // Exists if saved in DB
            };
        });
    };

    // Search Logic
    const getSearchResults = () => {
        if (!searchTerm) return [];
        const lowerTerm = searchTerm.toLowerCase();

        // 1. Search in Details (Used IPs)
        const matchedDetails = details.filter(d =>
            d.ipAddress.includes(lowerTerm) ||
            d.user.toLowerCase().includes(lowerTerm) ||
            d.department.toLowerCase().includes(lowerTerm)
        );

        // 2. Search Result Format
        return matchedDetails.map(d => {
            const range = ranges.find(r => r.id === d.rangeId);
            return {
                ...d,
                rangeName: range?.title || 'Unknown Range'
            };
        });
    };

    // --- Handlers ---

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        if (!confirm('엑셀 파일을 업로드하여 IP 정보를 일괄 업데이트하시겠습니까?')) {
            e.target.value = ''; // Reset file input
            return;
        }

        setLoading(true);
        try {
            const excelItems = await readIpInventoryExcel(e.target.files[0]);

            let updatedCount = 0;
            const updates: Promise<void>[] = [];

            console.log(`Parsed ${excelItems.length} items from Excel.`);

            for (const item of excelItems) {
                const ipToLong = (ip: string) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
                const ipVal = ipToLong(item.ipAddress);

                const targetRange = ranges.find(r => {
                    const start = ipToLong(r.startIp);
                    const end = ipToLong(r.endIp);
                    return ipVal >= start && ipVal <= end;
                });

                if (targetRange) {
                    const existingDetail = details.find(d => d.ipAddress === item.ipAddress && d.rangeId === targetRange.id);

                    updates.push(updateIpDetail({
                        id: existingDetail?.id,
                        rangeId: targetRange.id,
                        ipAddress: item.ipAddress,
                        department: item.department,
                        user: item.user,
                        usage: item.usage,
                        status: '사용중'
                    } as any));
                    updatedCount++;
                }
            }

            await Promise.all(updates);
            alert(`${updatedCount}개의 IP 정보가 성공적으로 업데이트되었습니다.`);
            await loadData();

        } catch (error) {
            console.error(error);
            alert('엑셀 업로드 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset
        }
    };

    const handleRangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addIpRange(newRange as any);
            await loadData();
            setIsRangeModalOpen(false);
            setNewRange({ device: 'A', title: '', startIp: '', endIp: '' });
        } catch (error) {
            alert('대역 추가 실패');
        }
    };

    const handleDeleteRange = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 이 대역을 삭제하시겠습니까? 연결된 IP 정보는 유지될 수 있습니다.')) return;
        try {
            await deleteIpRange(id);
            if (selectedRangeId === id) setSelectedRangeId(null);
            await loadData();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleDetailClick = (ipInfo: any) => {
        setEditingDetail({
            id: ipInfo.detailId,
            rangeId: ipInfo.rangeId,
            ipAddress: ipInfo.ipAddress,
            department: ipInfo.department,
            user: ipInfo.user,
            usage: ipInfo.usage,
            status: ipInfo.status,
        });
        setIsDetailModalOpen(true);
    };

    const handleDetailSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDetail) return;

        try {
            const status = (editingDetail.user || editingDetail.department || editingDetail.usage) ? '사용중' : '사용가능';
            await updateIpDetail({ ...editingDetail, status } as any);
            await loadData();
            setIsDetailModalOpen(false);
            setEditingDetail(null);
        } catch (error) {
            alert('저장 실패');
        }
    };

    const handleDetailDelete = async () => {
        if (!editingDetail?.id) return; // Not saved yet, nothing to delete
        if (!confirm('이 IP의 할당 정보를 삭제하고 초기화하시겠습니까?')) return;

        try {
            // Update with empty values to "reset" it (or delete if API supported delete by ID)
            // Here we just update to empty/available
            await updateIpDetail({
                id: editingDetail.id,
                rangeId: editingDetail.rangeId!,
                ipAddress: editingDetail.ipAddress!,
                department: '',
                user: '',
                usage: '',
                status: '사용가능'
            });
            await loadData();
            setIsDetailModalOpen(false);
        } catch (error) {
            alert('삭제 실패');
        }
    };


    // --- Render ---

    const displayIps = getDisplayIps();
    const searchResults = getSearchResults();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
            {loading && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {/* Header */}
            <div className="bg-black/20 backdrop-blur-md border-b border-white/10 p-4 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.history.back()}
                            className="text-white/70 hover:text-white transition"
                        >
                            ←
                        </button>
                        <h1 className="text-xl font-bold text-white">IP 자산 관리 System</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 max-w-7xl mx-auto w-full p-4 flex gap-6 overflow-hidden">

                {/* Desktop Sidebar (Left) */}
                <div className="hidden md:flex flex-col w-64 bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h2 className="text-white font-semibold">네트워크 장비</h2>
                        <div className="flex gap-1">
                            {/* Excel Upload Button */}
                            <label className="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded transition cursor-pointer" title="엑셀 일괄 등록">
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                                엑셀⚡
                            </label>
                            <button
                                onClick={() => setIsRangeModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded transition"
                                title="대역 추가"
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        {['A', 'B', 'C'].map(device => (
                            <div key={device}>
                                <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase mb-1">
                                    Equipment {device}
                                </div>
                                <div className="space-y-1">
                                    {rangesByDevice[device]?.map(range => (
                                        <div
                                            key={range.id}
                                            onClick={() => setSelectedRangeId(range.id)}
                                            className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${selectedRangeId === range.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                                        >
                                            <div className="truncate">
                                                <div className="text-sm font-medium truncate">{range.title}</div>
                                                <div className="text-xs opacity-70 truncate">{range.startIp}~</div>
                                            </div>
                                            {selectedRangeId === range.id && (
                                                <button
                                                    onClick={(e) => handleDeleteRange(range.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white"
                                                    title="대역 삭제"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {(!rangesByDevice[device] || rangesByDevice[device].length === 0) && (
                                        <div className="text-xs text-gray-500 px-3">등록된 대역 없음</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl min-h-[500px]">

                    {/* Mobile: Search & Select */}
                    <div className="md:hidden p-4 border-b border-white/10 space-y-4">
                        <input
                            type="text"
                            placeholder="IP, 사용자, 부서 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {/* Mobile Range Selector if not searching */}
                        {!searchTerm && (
                            <select
                                value={selectedRangeId || ''}
                                onChange={(e) => setSelectedRangeId(e.target.value)}
                                className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2.5 text-white"
                            >
                                <option value="">대역 선택...</option>
                                {ranges.map(r => (
                                    <option key={r.id} value={r.id}>
                                        [{r.device}] {r.title} ({r.startIp})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Desktop: Toolbar */}
                    <div className="hidden md:flex p-4 border-b border-white/10 justify-between items-center bg-white/5">
                        <h2 className="text-white font-bold text-lg">
                            {selectedRangeId
                                ? ranges.find(r => r.id === selectedRangeId)?.title
                                : '대역을 선택하거나 검색하세요'}
                        </h2>
                        <div className="w-64">
                            <input
                                type="text"
                                placeholder="빠른 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Case 1: Search Results */}
                        {searchTerm ? (
                            <div className="space-y-2">
                                <h3 className="text-gray-400 text-sm mb-2">검색 결과 ({searchResults.length})</h3>
                                {searchResults.map(result => (
                                    <div
                                        key={result.id}
                                        onClick={() => handleDetailClick(result)}
                                        className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-lg flex justify-between items-center cursor-pointer"
                                    >
                                        <div>
                                            <div className="text-blue-300 font-mono font-bold">{result.ipAddress}</div>
                                            <div className="text-gray-400 text-xs">[{result.rangeName}] {result.department} {result.user}</div>
                                        </div>
                                        <StatusBadge status={result.status} />
                                    </div>
                                ))}
                            </div>
                        ) : selectedRangeId ? (
                            /* Case 2: Grid View */
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {displayIps.map((ipInfo) => (
                                    <div
                                        key={ipInfo.ipAddress}
                                        onClick={() => handleDetailClick(ipInfo)}
                                        className={`
                                            relative p-3 rounded-lg border cursor-pointer transition group
                                            ${ipInfo.status === '사용중'
                                                ? 'bg-blue-900/20 border-blue-500/30 hover:bg-blue-900/40'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-sm font-mono font-bold ${ipInfo.status === '사용중' ? 'text-blue-300' : 'text-gray-400'}`}>
                                                {ipInfo.ipAddress.split('.').slice(3).join('.')} <span className="text-[10px] opacity-50">.{ipInfo.ipAddress.split('.').slice(2, 3)}</span>
                                            </span>
                                            <div className={`w-2 h-2 rounded-full ${ipInfo.status === '사용중' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                                        </div>

                                        <div className="space-y-0.5 min-h-[40px]">
                                            {ipInfo.status === '사용중' ? (
                                                <>
                                                    <div className="text-xs text-white truncate font-medium">{ipInfo.user}</div>
                                                    <div className="text-[10px] text-gray-400 truncate">{ipInfo.department}</div>
                                                </>
                                            ) : (
                                                <div className="text-[10px] text-gray-600 text-center py-2">Available</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Case 3: Empty State */
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <p>좌측 메뉴에서 대역을 선택해주세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Add Range */}
            {isRangeModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-xl w-full max-w-md border border-white/20 shadow-2xl overflow-hidden">
                        <div className="bg-slate-900/50 p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-white font-bold">IP 대역 추가</h3>
                            <button onClick={() => setIsRangeModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleRangeSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">장비 선택</label>
                                <div className="flex gap-2">
                                    {['A', 'B', 'C'].map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setNewRange({ ...newRange, device: d })}
                                            className={`flex-1 py-2 rounded border transition ${newRange.device === d ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                                        >
                                            Network {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">대역 이름</label>
                                <input
                                    required
                                    className="w-full bg-black/20 border border-white/20 rounded p-2 text-white"
                                    value={newRange.title}
                                    onChange={e => setNewRange({ ...newRange, title: e.target.value })}
                                    placeholder="예: 1층 영업부"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">시작 IP</label>
                                    <input
                                        required
                                        className="w-full bg-black/20 border border-white/20 rounded p-2 text-white"
                                        value={newRange.startIp}
                                        onChange={e => setNewRange({ ...newRange, startIp: e.target.value })}
                                        placeholder="192.168.1.1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">종료 IP</label>
                                    <input
                                        required
                                        className="w-full bg-black/20 border border-white/20 rounded p-2 text-white"
                                        value={newRange.endIp}
                                        onChange={e => setNewRange({ ...newRange, endIp: e.target.value })}
                                        placeholder="192.168.1.254"
                                    />
                                </div>
                            </div>
                            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg mt-2">
                                추가하기
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Edit Detail */}
            {isDetailModalOpen && editingDetail && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 rounded-xl w-full max-w-sm border border-white/20 shadow-2xl overflow-hidden">
                        <div className="bg-slate-900/50 p-4 border-b border-white/10">
                            <h3 className="text-white font-bold text-lg">{editingDetail.ipAddress}</h3>
                            <p className="text-xs text-gray-500">상세 정보 수정</p>
                        </div>
                        <form onSubmit={handleDetailSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">사용 부서</label>
                                <input
                                    className="w-full bg-black/20 border border-white/20 rounded p-2 text-white"
                                    value={editingDetail.department}
                                    onChange={e => setEditingDetail({ ...editingDetail, department: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">사용자</label>
                                <input
                                    className="w-full bg-black/20 border border-white/20 rounded p-2 text-white"
                                    value={editingDetail.user}
                                    onChange={e => setEditingDetail({ ...editingDetail, user: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">용도</label>
                                <input
                                    className="w-full bg-black/20 border border-white/20 rounded p-2 text-white"
                                    value={editingDetail.usage}
                                    onChange={e => setEditingDetail({ ...editingDetail, usage: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                {editingDetail.id && (
                                    <button
                                        type="button"
                                        onClick={handleDetailDelete}
                                        className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/20"
                                    >
                                        초기화
                                    </button>
                                )}
                                <div className="flex-1 flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsDetailModalOpen(false)}
                                        className="px-4 py-2 text-gray-400 hover:text-white"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
