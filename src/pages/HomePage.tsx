import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function HomePage() {
    const navigate = useNavigate();
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

            checkContractExpiry();
        }
    }, [alertShown]);

    const cards = [
        {
            title: "관리자 페이지",
            desc: "품목 추가, 수정, 삭제 관리",
            subDesc: "품명, 제품그룹, 품번, 수량, 가격, 비고",
            icon: "ri-admin-line",
            colorClass: "from-blue-500 to-blue-600",
            path: "/admin"
        },
        {
            title: "자재 관리",
            desc: "입출고 관리 및 재고 현황",
            subDesc: "입고, 출고, 재고 검색, 인쇄",
            icon: "ri-archive-line",
            colorClass: "from-green-500 to-green-600",
            path: "/inventory"
        },
        {
            title: "출고 신청",
            desc: "창고 담당자에게 출고 요청",
            subDesc: "출고 신청, 이메일 발송, 거래 기록",
            icon: "ri-truck-line",
            colorClass: "from-pink-500 to-pink-600",
            path: "/outbound-request"
        },
        {
            title: "임대 관리",
            desc: "임대 현황 및 계약 관리",
            subDesc: "임대 현황, 계약 만료 알림, 엑셀 관리",
            icon: "ri-building-2-line",
            colorClass: "from-purple-500 to-purple-600",
            path: "/rental"
        },
        {
            title: "IP 자산 관리",
            desc: "IP 대역 및 사용 현황 관리",
            subDesc: "IP 할당, 사용자 검색, 대역 관리",
            icon: "ri-computer-line",
            colorClass: "from-cyan-500 to-cyan-600",
            path: "/ip-management"
        },
        {
            title: "장비 관리",
            desc: "업무용 장비 및 이력 관리",
            subDesc: "장비 정보, 사용 이력, QR 코드",
            icon: "ri-macbook-line",
            colorClass: "from-indigo-500 to-indigo-600",
            path: "/equipment"
        }
    ];

    return (
        <Layout>
            <div className="grid md:grid-cols-3 gap-6">
                {cards.map((card, index) => (
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
