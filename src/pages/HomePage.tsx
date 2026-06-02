import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { MENUS } from '../constants/menus';
import { usePermission } from '../auth/usePermission';

export default function HomePage() {
    const navigate = useNavigate();
    const [alertShown, setAlertShown] = useState(false);
    const { canAccess, isReady, isLoading, hasError, isRegistered, role } = usePermission();

    useEffect(() => {
        if (!alertShown && isReady && canAccess('rental')) {
            const checkContractExpiry = () => {
                const rentals = JSON.parse(localStorage.getItem('rental_data') || '[]');
                const today = new Date();
                const threeMonthsLater = new Date();
                threeMonthsLater.setMonth(today.getMonth() + 3);

                const expiringContracts = rentals.filter((r: any) => {
                    if (!r.contractEndDate) return false;
                    const endDate = new Date(r.contractEndDate);
                    return endDate >= today && endDate <= threeMonthsLater;
                });

                if (expiringContracts.length > 0) {
                    const messages = expiringContracts.map((r: any) =>
                        `${r.dong}동 ${r.ho}호 (${r.tenantName}) - 만료일: ${r.contractEndDate}`
                    ).join('\n');
                    alert(`[계약 만료 임박 알림]\n\n다음 계약이 3개월 내 만료됩니다:\n\n${messages}`);
                }
                setAlertShown(true);
            };

            checkContractExpiry();
        }
    }, [alertShown, isReady, canAccess]);

    if (!isReady || isLoading) {
        return (
            <Layout>
                <div className="flex justify-center items-center py-32 text-gray-500">
                    <i className="ri-loader-4-line animate-spin text-2xl mr-3"></i>
                    권한 정보를 불러오는 중...
                </div>
            </Layout>
        );
    }

    const visibleCards = MENUS.filter(m => canAccess(m.key));

    return (
        <Layout>
            {hasError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                    <i className="ri-error-warning-line text-xl mt-0.5"></i>
                    <div>
                        <div className="font-bold mb-1">권한 정보를 불러오지 못했습니다</div>
                        <div>네트워크 상태를 확인하거나 시스템 관리자에게 문의해 주세요.</div>
                    </div>
                </div>
            )}

            {!hasError && !isRegistered && role === null && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm flex items-start gap-3">
                    <i className="ri-information-line text-xl mt-0.5"></i>
                    <div>
                        <div className="font-bold mb-1">접근 가능한 메뉴가 없습니다</div>
                        <div>시스템 관리자에게 메뉴 접근 권한을 요청해 주세요.</div>
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
                {visibleCards.map((card, index) => (
                    <div
                        key={index}
                        onClick={() => navigate(card.path)}
                        className="group bg-white rounded-[20px] p-[30px] border border-gray-100 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05),0_8px_10px_-6px_rgba(0,0,0,0.01)] relative overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:border-blue-200"
                    >
                        <div className={`absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r ${card.colorClass}`}></div>

                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.colorClass} flex items-center justify-center text-white text-2xl shadow-lg opacity-90 group-hover:opacity-100 transition-opacity`}>
                                <i className={card.icon}></i>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{card.title}</h2>
                        </div>
                        <p className="text-gray-600 text-lg mb-2 font-medium">{card.desc}</p>
                        <p className="text-gray-400 text-sm">{card.subDesc}</p>

                        <div className="absolute bottom-4 right-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                            <i className="ri-arrow-right-line text-2xl"></i>
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    );
}
