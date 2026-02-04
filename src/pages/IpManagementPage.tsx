import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { IpRange, IpDetail } from '../types';
import { getIpRanges, getIpDetails, addIpRange, deleteIpRange, updateIpDetail, generateIpListInRange } from '../storage';
import { readIpInventoryExcel } from '../services/excelService';

// UI Helper: Status Badge
const StatusBadge = ({ status }: { status: string }) => {
    if (status === '사용중') {
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">사용중</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">사용가능</span>;
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
        <Layout title="IP 자산 관리 System" showBackButton={true}>
            {loading && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-full shadow-lg">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            )}

            <div className="flex gap-6 h-[calc(100vh-140px)]">

                {/* Desktop Sidebar (Left) */}
                <div className="hidden md:flex flex-col w-72 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-shrink-0">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="text-gray-800 font-bold">네트워크 장비</h2>
                        <div className="flex gap-2">
                            {/* Excel Upload Button */}
                            <label className="bg-green-100 hover:bg-green-200 text-green-700 text-xs font-bold px-2 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1" title="엑셀 일괄 등록">
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                                <i className="ri-file-excel-2-line"></i> 엑셀
                            </label>
                            <button
                                onClick={() => setIsRangeModalOpen(true)}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold px-2 py-1.5 rounded-lg transition flex items-center gap-1"
                                title="대역 추가"
                            >
                                <i className="ri-add-line"></i> 추가
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-6">
                        {['A', 'B', 'C'].map(device => (
                            <div key={device}>
                                <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                    {device} 장비
                                </div>
                                <div className="space-y-1">
                                    {rangesByDevice[device]?.map(range => (
                                        <div
                                            key={range.id}
                                            onClick={() => setSelectedRangeId(range.id)}
                                            className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${selectedRangeId === range.id
                                                ? 'bg-blue-600 text-white shadow-md transform translate-x-1'
                                                : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="truncate min-w-0">
                                                <div className="text-sm font-bold truncate">{range.title}</div>
                                                <div className={`text-xs truncate ${selectedRangeId === range.id ? 'text-blue-200' : 'text-gray-400'}`}>{range.startIp}~</div>
                                            </div>
                                            {selectedRangeId === range.id && (
                                                <button
                                                    onClick={(e) => handleDeleteRange(range.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white transition-opacity px-1"
                                                    title="대역 삭제"
                                                >
                                                    <i className="ri-close-line"></i>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {(!rangesByDevice[device] || rangesByDevice[device].length === 0) && (
                                        <div className="text-xs text-gray-400 px-3 py-1 italic">등록된 대역 없음</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                    {/* Mobile: Search & Select */}
                    <div className="md:hidden p-4 border-b border-gray-100 space-y-3 bg-gray-50">
                        <input
                            type="text"
                            placeholder="IP, 사용자, 부서 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {/* Mobile Range Selector if not searching */}
                        {!searchTerm && (
                            <select
                                value={selectedRangeId || ''}
                                onChange={(e) => setSelectedRangeId(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div className="hidden md:flex p-4 border-b border-gray-100 justify-between items-center bg-gray-50/50">
                        <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2">
                            {selectedRangeId ? (
                                <>
                                    <i className="ri-network-line text-blue-600"></i>
                                    {ranges.find(r => r.id === selectedRangeId)?.title}
                                </>
                            ) : (
                                <span className="text-gray-500">대역을 선택하거나 검색하세요</span>
                            )}
                        </h2>
                        <div className="w-72 relative">
                            <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                            <input
                                type="text"
                                placeholder="빠른 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                        {/* Case 1: Search Results */}
                        {searchTerm ? (
                            <div className="space-y-3">
                                <h3 className="text-gray-500 text-sm font-bold mb-3">검색 결과 ({searchResults.length})</h3>
                                {searchResults.map(result => (
                                    <div
                                        key={result.id}
                                        onClick={() => handleDetailClick(result)}
                                        className="bg-white hover:bg-blue-50 border border-gray-200 p-4 rounded-xl flex justify-between items-center cursor-pointer shadow-sm transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                                <i className="ri-mac-line"></i>
                                            </div>
                                            <div>
                                                <div className="text-blue-600 font-mono font-bold text-lg">{result.ipAddress}</div>
                                                <div className="text-gray-500 text-sm flex items-center gap-2">
                                                    <span className="font-semibold text-gray-700">[{result.rangeName}]</span>
                                                    <span>{result.department}</span>
                                                    <span>{result.user}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <StatusBadge status={result.status} />
                                    </div>
                                ))}
                            </div>
                        ) : selectedRangeId ? (
                            /* Case 2: Grid View */
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {displayIps.map((ipInfo) => (
                                    <div
                                        key={ipInfo.ipAddress}
                                        onClick={() => handleDetailClick(ipInfo)}
                                        className={`
                                            relative p-4 rounded-xl border cursor-pointer transition-all group shadow-sm hover:shadow-md
                                            ${ipInfo.status === '사용중'
                                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700'
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'}
                                        `}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <span className={`text-base font-mono font-bold ${ipInfo.status === '사용중' ? 'text-white' : 'text-gray-800'}`}>
                                                ...{ipInfo.ipAddress.split('.').pop()}
                                            </span>
                                            <div className={`w-2.5 h-2.5 rounded-full ${ipInfo.status === '사용중' ? 'bg-green-400 border border-green-300' : 'bg-gray-300'}`}></div>
                                        </div>

                                        <div className="space-y-1 min-h-[36px]">
                                            {ipInfo.status === '사용중' ? (
                                                <>
                                                    <div className="text-sm font-bold truncate opacity-95">{ipInfo.user}</div>
                                                    <div className="text-xs truncate opacity-75">{ipInfo.department}</div>
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <span className="text-gray-400 text-xs">Available</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Hover Tooltip for Full IP */}
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                            {ipInfo.ipAddress}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Case 3: Empty State */
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <i className="ri-network-line text-4xl text-gray-300"></i>
                                </div>
                                <p className="text-lg font-medium text-gray-500">좌측 메뉴에서 대역을 선택해주세요.</p>
                                <p className="text-sm text-gray-400 mt-2">등록된 대역이 없다면 추가 버튼을 눌러 등록하세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Add Range */}
            {isRangeModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md border border-gray-100 shadow-2xl overflow-hidden">
                        <div className="bg-gray-50 p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-gray-800 font-bold text-lg">IP 대역 추가</h3>
                            <button onClick={() => setIsRangeModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                                <i className="ri-close-line text-xl"></i>
                            </button>
                        </div>
                        <form onSubmit={handleRangeSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">장비 선택</label>
                                <div className="flex gap-2">
                                    {['A', 'B', 'C'].map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setNewRange({ ...newRange, device: d })}
                                            className={`flex-1 py-2.5 rounded-lg border transition font-bold ${newRange.device === d
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            Network {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">대역 이름</label>
                                <input
                                    required
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newRange.title}
                                    onChange={e => setNewRange({ ...newRange, title: e.target.value })}
                                    placeholder="예: 1층 영업부"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">시작 IP</label>
                                    <input
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                        value={newRange.startIp}
                                        onChange={e => setNewRange({ ...newRange, startIp: e.target.value })}
                                        placeholder="192.168.1.1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">종료 IP</label>
                                    <input
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                        value={newRange.endIp}
                                        onChange={e => setNewRange({ ...newRange, endIp: e.target.value })}
                                        placeholder="192.168.1.254"
                                    />
                                </div>
                            </div>
                            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 transition">
                                대역 추가하기
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Edit Detail */}
            {isDetailModalOpen && editingDetail && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-sm border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-blue-600 p-6 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-white text-3xl mb-3">
                                <i className="ri-mac-line"></i>
                            </div>
                            <h3 className="text-white font-bold text-2xl font-mono">{editingDetail.ipAddress}</h3>
                            <p className="text-blue-100 text-sm mt-1">IP 상세 정보 수정</p>
                        </div>
                        <form onSubmit={handleDetailSave} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">사용 부서</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editingDetail.department}
                                    onChange={e => setEditingDetail({ ...editingDetail, department: e.target.value })}
                                    placeholder="부서명 입력"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">사용자</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editingDetail.user}
                                    onChange={e => setEditingDetail({ ...editingDetail, user: e.target.value })}
                                    placeholder="사용자명 입력"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">용도</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editingDetail.usage}
                                    onChange={e => setEditingDetail({ ...editingDetail, usage: e.target.value })}
                                    placeholder="PC, 프린터, 서버 등"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                                {editingDetail.id && (
                                    <button
                                        type="button"
                                        onClick={handleDetailDelete}
                                        className="px-4 py-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold transition flex-shrink-0"
                                    >
                                        초기화
                                    </button>
                                )}
                                <div className="flex-1 flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsDetailModalOpen(false)}
                                        className="px-5 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold custom-shadow transition"
                                    >
                                        저장하기
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
