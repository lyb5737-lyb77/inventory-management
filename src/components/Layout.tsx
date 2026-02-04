import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';

interface LayoutProps {
    children: ReactNode;
    title?: string;
    showBackButton?: boolean;
    maxWidth?: string;
}

export default function Layout({ children, title = "BIT 관리 시스템", showBackButton = false, maxWidth = "max-w-[1400px]" }: LayoutProps) {
    const navigate = useNavigate();
    const { instance } = useMsal();


    const handleLogout = () => {
        instance.logoutPopup().catch(e => {
            console.error(e);
        });
    };

    // Determine sub-title or context based on path if needed
    // For now, simplicity.

    return (
        <div className="min-h-screen text-gray-900 pb-12">
            <div className={`${maxWidth} mx-auto px-6 py-12 flex flex-col gap-6 transition-all duration-300`}>
                {/* Header Section */}
                <header className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-600/30">
                            <i className="ri-building-4-line"></i>
                        </div>
                        <div>
                            <h1 className="text-[28px] font-bold text-gray-800 leading-tight">
                                {title}
                                <span className="block text-base text-gray-500 font-normal mt-1">
                                    BIT Management System
                                </span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {showBackButton && (
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 font-semibold hover:bg-gray-50 hover:text-gray-900 transition-all font-['NotoSansHans']"
                            >
                                <i className="ri-arrow-left-line"></i>
                                <span>홈으로</span>
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 font-semibold hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all font-['NotoSansHans']"
                        >
                            <i className="ri-logout-box-r-line"></i>
                            <span>로그아웃</span>
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main>
                    {children}
                </main>
            </div>
        </div>
    );
}
