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
                <div className="bg-white rounded-[2rem] p-7 shadow-xl border border-gray-100/60 mb-8 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] opacity-50 pointer-events-none"></div>

                    {/* Status Badge */}
                    <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-100 relative z-10">
                        <div>
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${getStatusColor(equipment.status)} shadow-sm`}>
                                <div className={`w-2.5 h-2.5 rounded-full ${equipment.status === '정상' ? 'bg-green-500' : equipment.status === '수리중' ? 'bg-yellow-500' : 'bg-red-500'} shadow-sm animate-pulse`}></div>
                                {equipment.status}
                            </span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">사용자</span>
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                <i className="ri-user-smile-fill text-indigo-400"></i>
                                <span className="font-extrabold text-gray-800">{equipment.userName || '미배정'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Info Grid */}
                    <div className="grid grid-cols-1 gap-y-7 relative z-10">
                        <InfoItem icon="ri-price-tag-3-fill" iconColor="text-blue-500" label="관리번호" value={equipment.managementNumber || '미부여'} />
                        <InfoItem icon="ri-barcode-box-line" iconColor="text-gray-600" label="고유(시리얼)번호" value={equipment.serialNumber || '확인불가'} />
                        <InfoItem icon="ri-macbook-line" iconColor="text-purple-500" label="제품그룹" value={equipment.group || '-'} />

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <InfoItem icon="ri-calendar-event-fill" iconColor="text-orange-400" label="구입일자" value={equipment.purchaseDate || '-'} />
                            <InfoItem icon="ri-store-2-fill" iconColor="text-teal-500" label="구입처" value={equipment.vendor || '-'} />
                        </div>

                        {equipment.remarks && (
                            <div className="mt-4 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                                <p className="text-xs text-indigo-800/60 font-bold mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                    <i className="ri-sticky-note-fill text-indigo-400"></i> 특이사항 메모
                                </p>
                                <p className="text-gray-700 text-sm leading-relaxed font-medium">{equipment.remarks}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 수정 버튼 (관리자 전용 진입점) */}
                <button
                    onClick={() => navigate('/equipment', { state: { openEditModalFor: equipment.id } })}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                    <div className="flex items-center gap-2 relative z-10 text-lg">
                        <i className="ri-edit-box-line"></i> 이 장비 정보 수정하기
                    </div>
                </button>
            </main>
        </div>
    );
}

function InfoItem({ icon, iconColor, label, value }: { icon: string, iconColor: string, label: string, value: string }) {
    return (
        <div className="flex border-b border-gray-50 pb-3 last:border-0 last:pb-0">
            <div className={`w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-xl shrink-0 mr-4 ${iconColor} shadow-sm border border-gray-100`}>
                <i className={icon}></i>
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-[11px] text-gray-400 font-bold mb-0.5 uppercase tracking-wider">{label}</p>
                <p className="text-gray-800 font-extrabold text-[15px] truncate">{value}</p>
            </div>
        </div>
    );
}
