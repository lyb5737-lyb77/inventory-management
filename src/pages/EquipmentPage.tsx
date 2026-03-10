import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { Equipment, ProductGroup, EquipmentLog } from '../types';
import { getEquipments, addEquipment, updateEquipment, deleteEquipment, getProductGroups, getEquipmentLogs, addEquipmentLog } from '../storage';
import { QRCodeCanvas } from 'qrcode.react';
import { format } from 'date-fns';
import * as xlsx from 'xlsx';

export default function EquipmentPage() {
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 모달 제어
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);

    const initialFormState = {
        name: '',
        group: '',
        managementNumber: '',
        serialNumber: '',
        userName: '',
        purchaseDate: '',
        price: '',
        vendor: '',
        status: '정상',
        remarks: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // QR & 로그 모달 제어
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [detailTab, setDetailTab] = useState<'info' | 'qr' | 'logs'>('info');

    // 이력 데이터 상태
    const [logs, setLogs] = useState<EquipmentLog[]>([]);

    const location = useLocation();

    useEffect(() => {
        loadInitialData();
    }, []);

    // 타 페이지에서 전달된 수정 요청(openEditModalFor) 감지 및 모달 자동 실행
    useEffect(() => {
        if (equipments.length > 0 && location.state && location.state.openEditModalFor) {
            const targetId = location.state.openEditModalFor;
            const targetEq = equipments.find(eq => eq.id === targetId);

            if (targetEq && !isModalOpen) {
                setEditingItem(targetEq);
                setFormData({
                    name: targetEq.name,
                    group: targetEq.group,
                    managementNumber: targetEq.managementNumber,
                    serialNumber: targetEq.serialNumber,
                    userName: targetEq.userName,
                    purchaseDate: targetEq.purchaseDate,
                    price: targetEq.price,
                    vendor: targetEq.vendor,
                    status: targetEq.status,
                    remarks: targetEq.remarks
                });
                setIsModalOpen(true);

                // 모달을 한 번 띄운 후에는 state를 지워서 무한반복 방지
                window.history.replaceState({}, document.title);
            }
        }
    }, [equipments, location.state, isModalOpen]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [eqData, pgData] = await Promise.all([getEquipments(), getProductGroups()]);
            // 최신순 정렬 (단순 id 기반이나, Sharepoint ID 기준 대략 역순)
            setEquipments(eqData.reverse());
            setProductGroups(pgData);
        } catch (err: any) {
            setError(err.message || '데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    // 검색 로직
    const filteredEquipments = equipments.filter(eq => {
        const term = searchTerm.toLowerCase();
        return (
            eq.name.toLowerCase().includes(term) ||
            eq.group.toLowerCase().includes(term) ||
            eq.userName.toLowerCase().includes(term) ||
            eq.managementNumber.toLowerCase().includes(term) ||
            eq.serialNumber.toLowerCase().includes(term)
        );
    });

    // 엑셀 일괄 등록 로직
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const wb = xlsx.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = xlsx.utils.sheet_to_json(ws) as any[];

                let successCount = 0;
                let failCount = 0;

                for (const row of data) {
                    try {
                        // 엑셀 컬럼명 매핑
                        await addEquipment({
                            name: row['장비명'] || row['Title'] || '',
                            group: row['제품그룹'] || row['Group'] || '',
                            managementNumber: row['관리번호'] || row['ManagementNumber'] || String(row['M/N'] || ''),
                            serialNumber: row['고유번호'] || row['SerialNumber'] || String(row['S/N'] || ''),
                            userName: row['사용자'] || row['User'] || '',
                            purchaseDate: row['구입일자'] || row['구입일'] || row['PurchaseDate'] || '',
                            price: String(row['가격'] || row['Price'] || ''),
                            vendor: row['구입처'] || row['Vendor'] || '',
                            status: row['상태'] || row['Status'] || '정상',
                            remarks: row['비고'] || row['메모'] || row['Remarks'] || ''
                        });
                        successCount++;
                    } catch (err) {
                        console.error('Row upload error:', err);
                        failCount++;
                    }
                }

                alert(`엑셀 등록 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
                await loadInitialData();
            };
            reader.readAsBinaryString(file);
        } catch (err: any) {
            setError('엑셀 파일 분석 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    // 폼 제출
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingItem) {
                // 수정 로직 (기존 값과 비교하여 이력 생성)
                const changes = [];
                if (editingItem.status !== formData.status) {
                    changes.push({
                        type: '상태 변경',
                        old: editingItem.status,
                        new: formData.status
                    });
                }
                if (editingItem.userName !== formData.userName) {
                    changes.push({
                        type: '사용자 변경',
                        old: editingItem.userName || '미배정',
                        new: formData.userName || '미배정'
                    });
                }

                await updateEquipment(editingItem.id, formData);

                // 로그 기록 저장
                const changeDate = new Date().toISOString();
                for (const change of changes) {
                    await addEquipmentLog({
                        equipmentId: editingItem.id,
                        changeType: change.type,
                        changeDate: changeDate,
                        oldValue: change.old,
                        newValue: change.new,
                        remarks: '관리자 수정'
                    });
                }
            } else {
                // 추가 로직
                await addEquipment(formData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData(initialFormState);
            await loadInitialData();
        } catch (err: any) {
            setError(err.message || '저장 실패');
        } finally {
            setLoading(false);
        }
    };

    // 삭제
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('이 장비를 정말 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.')) return;
        setLoading(true);
        try {
            await deleteEquipment(id);
            await loadInitialData();
        } catch (err: any) {
            setError(err.message || '삭제 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (eq: Equipment, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingItem(eq);
        setFormData({
            name: eq.name,
            group: eq.group,
            managementNumber: eq.managementNumber,
            serialNumber: eq.serialNumber,
            userName: eq.userName,
            purchaseDate: eq.purchaseDate,
            price: eq.price,
            vendor: eq.vendor,
            status: eq.status,
            remarks: eq.remarks
        });
        setIsModalOpen(true);
    };

    const handleOpenDetail = async (eq: Equipment) => {
        setSelectedEquipment(eq);
        setDetailTab('info');
        setIsDetailModalOpen(true);

        // 이력 내역 불러오기
        try {
            const historyLogs = await getEquipmentLogs(eq.id);
            setLogs(historyLogs.reverse());
        } catch (e) {
            console.error('Failed to load logs', e);
            setLogs([]);
        }
    };

    // 엑셀 다운로드 (현재 검색된 목록 기반)
    const handleDownloadExcel = () => {
        if (filteredEquipments.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const exportData = filteredEquipments.map((eq) => ({
            '상태': eq.status,
            '장비명': eq.name,
            '제품그룹': eq.group,
            '사용자': eq.userName,
            '고유번호(S/N)': eq.serialNumber,
            '관리번호(M/N)': eq.managementNumber,
            '구입일자': eq.purchaseDate,
            '가격': eq.price,
            '구입처': eq.vendor,
            '메모/비고': eq.remarks,
            '시스템ID': eq.id
        }));

        const ws = xlsx.utils.json_to_sheet(exportData);
        // 열 너비 자동 조정 보정값
        ws['!cols'] = [
            { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
            { wch: 20 }, { wch: 40 }, { wch: 10 }
        ];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "장비목록");

        const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
        xlsx.writeFile(wb, `장비관리목록_${timestamp}.xlsx`);
    };

    // 엑셀 업로드용 양식(템플릿) 다운로드
    const handleDownloadTemplate = () => {
        const templateData = [
            {
                '장비명': '예) MacBook M3 Pro',
                '제품그룹': '예) 노트북',
                '관리번호': '예) BIT-A-001',
                '고유번호': '예) C02Xxxx',
                '사용자': '예) 홍길동',
                '구입일자': '예) 2024-03-10',
                '가격': '예) 2500000',
                '구입처': '예) 애플스토어',
                '상태': '정상/수리중/폐기 중 택1 (빈칸은 정상)',
                '비고': '기타 특이사항'
            }
        ];

        const ws = xlsx.utils.json_to_sheet(templateData);
        ws['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 35 }, { wch: 30 }
        ];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "장비업로드양식");

        xlsx.writeFile(wb, `장비일괄업로드_양식.xlsx`);
    };

    const formatDate = (isoString: string) => {
        try {
            return format(new Date(isoString), 'yyyy-MM-dd HH:mm');
        } catch (e) {
            return isoString;
        }
    };

    return (
        <Layout title="장비 관리" showBackButton={true}>
            {/* 로딩 표시 */}
            {loading && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
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

            {/* 헤더 및 컨트롤 영역 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="품명, 그룹, 사용자, 고유/관리번호 검색"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto flex-wrap md:flex-nowrap pb-2 md:pb-0 justify-end">
                    <button
                        onClick={handleDownloadExcel}
                        className="bg-white border text-sm border-gray-200 text-gray-700 hover:bg-gray-50 flex-shrink-0 py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2"
                        title="현재 검색된 목록 다운로드"
                    >
                        <i className="ri-download-2-line"></i> 목록 다운로드
                    </button>

                    <div className="flex gap-2 bg-green-50 rounded-xl p-1 border border-green-100">
                        <button
                            onClick={handleDownloadTemplate}
                            className="bg-white text-green-700 text-sm hover:bg-green-100 font-semibold flex-shrink-0 py-1.5 px-3 rounded-lg shadow-sm transition-all flex items-center gap-1"
                            title="엑셀 업로드 양식 파일 받기"
                        >
                            <i className="ri-file-download-line"></i> 양식 다운
                        </button>
                        <label className="bg-green-600 hover:bg-green-700 text-white font-semibold flex-shrink-0 py-1.5 px-4 rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer">
                            <i className="ri-file-excel-2-line"></i> 일괄 등록
                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>

                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setFormData(initialFormState);
                            setIsModalOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex-shrink-0 py-2.5 px-5 rounded-xl shadow-lg transition-all flex items-center gap-2"
                    >
                        <i className="ri-add-line"></i> 수동 등록
                    </button>
                </div>
            </div>

            {/* 메인 리스트 컨테이너 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">상태</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">장비명</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제품그룹</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">사용자</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">고유/관리번호</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">구입일자</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredEquipments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <i className="ri-macbook-line text-4xl text-gray-300 mb-2"></i>
                                            <p>등록된 장비 데이터가 없습니다.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredEquipments.map((eq) => (
                                    <tr key={eq.id} className="hover:bg-indigo-50/50 transition-colors group cursor-pointer" onClick={() => handleOpenDetail(eq)}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                                ${eq.status === '정상' ? 'bg-green-100 text-green-800' :
                                                    eq.status === '수리중' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                {eq.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900">{eq.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {eq.group || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                    {eq.userName ? eq.userName.charAt(0) : '?'}
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{eq.userName || '미배정'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs text-gray-500">S/N: <span className="text-gray-900">{eq.serialNumber || '-'}</span></div>
                                            <div className="text-xs text-gray-500 mt-1">M/N: <span className="text-gray-900">{eq.managementNumber || '-'}</span></div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {eq.purchaseDate || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleEdit(eq, e)}
                                                className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white inline-flex items-center justify-center mr-2 transition-colors"
                                            >
                                                <i className="ri-edit-line"></i>
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(eq.id, e)}
                                                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white inline-flex items-center justify-center transition-colors"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 등록/수정 폼 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center z-10 rounded-t-3xl">
                            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
                                    <i className="ri-macbook-line"></i>
                                </div>
                                {editingItem ? '장비 정보 수정' : '새 장비 등록'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">장비명 <span className="text-red-500">*</span></label>
                                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                        placeholder="예: MacBook Pro 14 (M3)" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">제품그룹</label>
                                    <select value={formData.group} onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                                        <option value="">미지정</option>
                                        {productGroups.map((group) => (
                                            <option key={group.id} value={group.name}>{group.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">현재 상태 <span className="text-red-500">*</span></label>
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold">
                                        <option value="정상" className="text-green-600 font-bold">● 정상 사용중</option>
                                        <option value="수리중" className="text-yellow-600 font-bold">● 수리/점검중</option>
                                        <option value="폐기" className="text-red-600 font-bold">● 폐기 처리</option>
                                    </select>
                                </div>

                                {/* Tracking Info */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">관리번호</label>
                                    <input type="text" value={formData.managementNumber} onChange={(e) => setFormData({ ...formData, managementNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        placeholder="사내 관리 자산번호" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">고유(시리얼)번호</label>
                                    <input type="text" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        placeholder="제조사 S/N" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1"><i className="ri-user-line text-indigo-500"></i> 사용자</label>
                                    <input type="text" value={formData.userName} onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                        className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
                                        placeholder="배정된 직원 이름" />
                                </div>

                                {/* Purchase Info */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">구입일자</label>
                                    <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">구입처</label>
                                    <input type="text" value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">구입가격 (₩)</label>
                                    <input type="text" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                                        placeholder="예: 2,500,000" />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">비고 / 메모</label>
                                    <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                                        placeholder="특이사항이나 보증기간 등을 자유롭게 적어주세요." />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-100 mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl shadow-sm transition-all border border-gray-200 text-lg">
                                    취소
                                </button>
                                <button type="submit"
                                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-lg">
                                    <i className="ri-save-3-line"></i> {editingItem ? '수정 내용 저장' : '장비 등록 완료'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 상세정보, QR코드, 이력관리 모달 */}
            {isDetailModalOpen && selectedEquipment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="bg-indigo-600 px-6 py-5 rounded-t-3xl text-white flex justify-between items-center relative overflow-hidden shrink-0">
                            <div className="absolute -right-10 leading-none -top-10 text-[10rem] opacity-10">
                                <i className="ri-macbook-line"></i>
                            </div>
                            <div className="relative z-10">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mb-2 bg-white/20 backdrop-blur-sm`}>
                                    S/N: {selectedEquipment.serialNumber || '미상'}
                                </span>
                                <h3 className="text-2xl font-bold">{selectedEquipment.name}</h3>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="text-white/80 hover:text-white w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center relative z-10 transition-colors">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 shrink-0">
                            <button
                                onClick={() => setDetailTab('info')}
                                className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-1.5 ${detailTab === 'info' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                <i className="ri-information-line"></i> 기본 정보
                            </button>
                            <button
                                onClick={() => setDetailTab('logs')}
                                className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-1.5 ${detailTab === 'logs' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                <i className="ri-history-line"></i> 이력 관리 (Log)
                            </button>
                            <button
                                onClick={() => setDetailTab('qr')}
                                className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-1.5 ${detailTab === 'qr' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                <i className="ri-qr-code-line"></i> QR 코드
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50 rounded-b-3xl">
                            {detailTab === 'info' && (
                                <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                                    <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">현재 상태</p>
                                        <p className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${selectedEquipment.status === '정상' ? 'bg-green-500' : selectedEquipment.status === '수리중' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                            {selectedEquipment.status}
                                        </p>
                                    </div>
                                    <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-16 h-full bg-indigo-50 flex items-center justify-center">
                                            <i className="ri-user-3-fill text-2xl text-indigo-200"></i>
                                        </div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">현재 사용자</p>
                                        <p className="font-bold text-indigo-600 text-lg relative z-10">{selectedEquipment.userName || '미배정'}</p>
                                    </div>
                                    <div className="col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium mb-1">제품그룹</p>
                                            <p className="font-semibold text-gray-800">{selectedEquipment.group || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium mb-1">관리번호</p>
                                            <p className="font-semibold text-gray-800">{selectedEquipment.managementNumber || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium mb-1">구입일</p>
                                            <p className="font-semibold text-gray-800">{selectedEquipment.purchaseDate || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium mb-1">가격</p>
                                            <p className="font-semibold text-gray-800">{selectedEquipment.price ? `₩${selectedEquipment.price}` : '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium mb-1">구입처</p>
                                            <p className="font-semibold text-gray-800">{selectedEquipment.vendor || '-'}</p>
                                        </div>
                                        <div className="col-span-2 pt-4 border-t border-gray-100 mt-2">
                                            <p className="text-xs text-gray-500 font-medium mb-2">메모/특이사항</p>
                                            <p className="text-gray-700 bg-gray-50 p-4 rounded-xl leading-relaxed whitespace-pre-wrap">{selectedEquipment.remarks || '등록된 메모가 없습니다.'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {detailTab === 'qr' && (
                                <div className="flex flex-col items-center justify-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm h-full relative">
                                    <h4 className="text-2xl font-bold text-gray-800 mb-2">장비 식별 QR 코드</h4>
                                    <p className="text-gray-500 mb-10 text-sm">모바일 기기로 스캔하여 해당 장비의 뷰어 페이지로 바로 이동합니다.</p>

                                    <div className="p-8 bg-white border border-gray-200 rounded-[2.5rem] shadow-xl mb-8 relative">
                                        {/* Corner markers for design */}
                                        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-indigo-500"></div>
                                        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-indigo-500"></div>
                                        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-indigo-500"></div>
                                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-indigo-500"></div>

                                        <QRCodeCanvas
                                            value={
                                                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                                    ? `https://lyb5737-lyb77.github.io/inventory-management/#/equipment/viewer/${selectedEquipment.id}`
                                                    : `${window.location.origin}${import.meta.env.BASE_URL}#/equipment/viewer/${selectedEquipment.id}`
                                            }
                                            size={240}
                                            level="H"
                                            includeMargin={false}
                                            fgColor="#1e1e2f"
                                            imageSettings={{
                                                src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='none' d='M0 0h24v24H0z'/%3E%3Cpath d='M4 5v14h16V5H4zM3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm11.793 6.793l2.828 2.828-2.828 2.828-1.414-1.414L14.586 13H8v-2h6.586l-1.207-1.207 1.414-1.414z' fill='rgba(79,70,229,1)'/%3E%3C/svg%3E",
                                                x: undefined, y: undefined, height: 48, width: 48, excavate: true,
                                            }}
                                        />
                                    </div>

                                    <p className="text-sm text-indigo-600 font-semibold bg-indigo-50 px-5 py-2.5 rounded-full border border-indigo-100 flex items-center gap-2">
                                        <i className="ri-link"></i>
                                        {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                            ? 'https://lyb5737-lyb77.github.io/...'
                                            : `/equipment/viewer/${selectedEquipment.id.slice(0, 8)}...`
                                        }
                                    </p>
                                </div>
                            )}

                            {detailTab === 'logs' && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                                    <h4 className="font-bold text-gray-800 mb-6 text-lg">장비 이력 내역</h4>

                                    {logs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 text-3xl mb-4">
                                                <i className="ri-history-line"></i>
                                            </div>
                                            <p className="text-gray-500 font-medium">아직 기록된 변경 이력이 없습니다.</p>
                                            <p className="text-xs text-gray-400 mt-1">상태나 사용자를 변경하면 이곳에 로그가 기록됩니다.</p>
                                        </div>
                                    ) : (
                                        <div className="relative border-l-2 border-gray-100 ml-3 md:ml-6 space-y-8 pb-4">
                                            {logs.map((log, idx) => (
                                                <div key={log.id || idx} className="relative pl-6 md:pl-8">
                                                    <span className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-white border-4 border-indigo-400"></span>

                                                    <div className="mb-1 flex items-center justify-between">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700">
                                                            {log.changeType}
                                                        </span>
                                                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                                            <i className="ri-time-line"></i> {formatDate(log.changeDate)}
                                                        </span>
                                                    </div>

                                                    <div className="bg-gray-50 p-4 rounded-xl mt-2 border border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex-1 text-sm text-gray-500 truncate line-through decoration-red-300">
                                                                {log.oldValue || '-'}
                                                            </span>
                                                            <i className="ri-arrow-right-line text-gray-300"></i>
                                                            <span className="flex-1 text-sm font-bold text-gray-800 truncate">
                                                                {log.newValue}
                                                            </span>
                                                        </div>
                                                        {log.remarks && (
                                                            <div className="mt-3 text-xs text-gray-500 bg-white p-2.5 rounded-lg border border-gray-200/60">
                                                                <span className="font-semibold text-gray-600">메모:</span> {log.remarks}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* 시작 노드 (등록일 상징) */}
                                            <div className="relative pl-6 md:pl-8 pt-4">
                                                <span className="absolute -left-[11px] top-5 w-5 h-5 rounded-full bg-gray-200 border-4 border-white shadow-sm ring-1 ring-gray-200"></span>
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600">
                                                    장비 최초 등록
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
