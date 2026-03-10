import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Equipment } from '../types';
import { getEquipments } from '../storage';

export default function EquipmentViewerPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [equipment, setEquipment] = useState<Equipment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEquipment = async () => {
            if (!id) {
                setError('잘못된 접근입니다. 장비 ID가 없습니다.');
                setLoading(false);
                return;
            }

            try {
                const equipments = await getEquipments();
                const found = equipments.find(eq => eq.id === id);

                if (found) {
                    setEquipment(found);
                } else {
                    setError('해당 장비를 찾을 수 없습니다.');
                }
            } catch (err: any) {
                setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchEquipment();
    }, [id]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case '정상': return 'bg-green-100 text-green-700 border-green-200';
            case '수리중': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case '폐기': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-semibold animate-pulse">장비 정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error || !equipment) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                    <i className="ri-error-warning-fill"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">조회 실패</h2>
                <p className="text-gray-500 mb-8 max-w-sm">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg transition-all"
                >
                    홈으로 이동
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Mobile Header */}
            <header className="bg-indigo-600 text-white p-6 rounded-b-[2.5rem] shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>

                <div className="flex items-center gap-4 relative z-10 mb-2">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl shadow-inner">
                        <i className="ri-macbook-line"></i>
                    </div>
                    <div>
                        <h1 className="text-lg font-medium text-indigo-100 mb-0.5">장비 상세 정보</h1>
                        <p className="text-2xl font-bold leading-tight">{equipment.name}</p>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <main className="px-5 -mt-6 relative z-20">
                <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100/50">

                    {/* Status Badge */}
                    <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100">
                        <div>
                            <p className="text-sm text-gray-400 font-medium mb-1">상태 (Status)</p>
                            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-bold border ${getStatusColor(equipment.status)} shadow-sm`}>
                                <div className={`w-2 h-2 rounded-full ${equipment.status === '정상' ? 'bg-green-500' : equipment.status === '수리중' ? 'bg-yellow-500' : 'bg-red-500'} shadow-sm`}></div>
                                {equipment.status}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-400 font-medium mb-1">사용자 (User)</p>
                            <div className="flex items-center justify-end gap-2">
                                <i className="ri-user-smile-line text-indigo-500 text-lg"></i>
                                <span className="font-bold text-gray-800 text-lg">{equipment.userName || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Info Grid */}
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                        <div className="col-span-2">
                            <InfoItem icon="ri-price-tag-3-line" label="관리번호" value={equipment.managementNumber || '미부여'} />
                        </div>
                        <div className="col-span-2">
                            <InfoItem icon="ri-barcode-line" label="고유(시리얼)번호" value={equipment.serialNumber || '확인불가'} />
                        </div>
                        <div className="col-span-2">
                            <InfoItem icon="ri-folder-open-line" label="제품그룹" value={equipment.group || '-'} />
                        </div>
                        <div>
                            <InfoItem icon="ri-calendar-event-line" label="구입일자" value={equipment.purchaseDate || '-'} />
                        </div>
                        <div>
                            <InfoItem icon="ri-store-2-line" label="구입처" value={equipment.vendor || '-'} />
                        </div>

                        {equipment.remarks && (
                            <div className="col-span-2 mt-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                                <p className="text-sm text-indigo-800/60 font-medium mb-1 flex items-center gap-1">
                                    <i className="ri-sticky-note-line"></i> 특이사항 메모
                                </p>
                                <p className="text-gray-700 text-sm leading-relaxed">{equipment.remarks}</p>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => navigate('/equipment')}
                    className="w-full mt-6 bg-white border border-gray-200 text-gray-700 font-bold py-4 rounded-2xl shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                    <i className="ri-list-check"></i> 전체 관리 목록으로
                </button>
            </main>
        </div>
    );
}

function InfoItem({ icon, label, value }: { icon: string, label: string, value: string }) {
    return (
        <div>
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
                <i className={`${icon} opacity-70`}></i> {label}
            </p>
            <p className="text-gray-800 font-semibold break-all">{value}</p>
        </div>
    );
}
