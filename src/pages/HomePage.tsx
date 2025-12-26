import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useState, useEffect } from 'react';

export default function HomePage() {
    const navigate = useNavigate();
    const { instance } = useMsal();
    const [alertShown, setAlertShown] = useState(false);

    useEffect(() => {
        if (!alertShown) {
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

            // 데이터 로드 시간을 고려하여 약간의 지연 후 실행하거나, 실제로는 데이터 로드 후 실행해야 함.
            // 여기서는 localStorage를 사용하므로 즉시 실행 가능.
            checkContractExpiry();
        }
    }, [alertShown]);

    const handleLogout = () => {
        instance.logoutPopup().catch(e => {
            console.error(e);
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <nav className="bg-black/30 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-2xl font-bold text-white">BIT 관리 시스템</h1>
                        <button
                            onClick={handleLogout}
                            className="text-white hover:text-red-400 transition"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid md:grid-cols-3 gap-6">
                    {/* 관리자 페이지 카드 */}
                    <div
                        onClick={() => navigate('/admin')}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer transform transition hover:scale-105 hover:bg-white/15 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-blue-500 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white">관리자 페이지</h2>
                        </div>
                        <p className="text-gray-300 text-lg">품목 추가, 수정, 삭제 관리</p>
                        <p className="text-gray-400 text-sm mt-2">품명, 제품그룹, 품번, 수량, 가격, 비고</p>
                    </div>

                    {/* 자재 관리 페이지 카드 */}
                    <div
                        onClick={() => navigate('/inventory')}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer transform transition hover:scale-105 hover:bg-white/15 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-green-500 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white">자재 관리</h2>
                        </div>
                        <p className="text-gray-300 text-lg">입출고 관리 및 재고 현황</p>
                        <p className="text-gray-400 text-sm mt-2">입고, 출고, 재고 검색, 인쇄</p>
                    </div>

                    {/* 출고 신청 페이지 카드 */}
                    <div
                        onClick={() => navigate('/outbound-request')}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer transform transition hover:scale-105 hover:bg-white/15 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-pink-500 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white">출고 신청</h2>
                        </div>
                        <p className="text-gray-300 text-lg">창고 담당자에게 출고 요청</p>
                        <p className="text-gray-400 text-sm mt-2">출고 신청, 이메일 발송, 거래 기록</p>
                    </div>

                    {/* 임대 관리 페이지 카드 */}
                    <div
                        onClick={() => navigate('/rental')}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer transform transition hover:scale-105 hover:bg-white/15 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-purple-500 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white">임대 관리</h2>
                        </div>
                        <p className="text-gray-300 text-lg">임대 현황 및 계약 관리</p>
                        <p className="text-gray-400 text-sm mt-2">임대 현황, 계약 만료 알림, 엑셀 관리</p>
                    </div>

                    {/* IP 자산 관리 페이지 카드 */}
                    <div
                        onClick={() => navigate('/ip-management')}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer transform transition hover:scale-105 hover:bg-white/15 shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-cyan-500 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white">IP 자산 관리</h2>
                        </div>
                        <p className="text-gray-300 text-lg">IP 대역 및 사용 현황 관리</p>
                        <p className="text-gray-400 text-sm mt-2">IP 할당, 사용자 검색, 대역 관리</p>
                    </div>
                </div>
            </div>


        </div>
    );
}


