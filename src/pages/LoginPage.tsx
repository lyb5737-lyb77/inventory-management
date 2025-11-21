import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

export default function LoginPage() {
    const { instance } = useMsal();

    const handleLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">재고 관리 시스템</h1>
                    <p className="text-gray-300">Inventory Management System</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleLogin}
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                        </svg>
                        Microsoft 계정으로 로그인
                    </button>

                    <div className="text-center text-sm text-gray-300 mt-6">
                        <p>로그인 후 재고 관리 시스템을 이용하실 수 있습니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
