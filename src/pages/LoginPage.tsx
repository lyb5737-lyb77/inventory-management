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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full border border-gray-100 flex flex-col items-center">
                <div className="mb-8 flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform rotate-3">
                        <i className="ri-building-4-line text-4xl text-white"></i>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">BIT 관리 시스템</h1>
                    <p className="text-gray-500 font-medium">BIT Management System</p>
                </div>

                <div className="w-full space-y-6">
                    <button
                        onClick={handleLogin}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
                    >
                        <i className="ri-microsoft-fill text-xl"></i>
                        Microsoft 계정으로 로그인
                    </button>

                    <div className="text-center space-y-4">
                        <p className="text-sm text-gray-500">로그인 후 BIT 관리 시스템을 이용하실 수 있습니다.</p>
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                            <p className="text-orange-600 font-bold text-sm flex items-center justify-center gap-2">
                                <i className="ri-error-warning-fill"></i>
                                BIT.KR MS 계정만 로그인 가능합니다
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
