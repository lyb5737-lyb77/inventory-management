import { useState, useEffect } from 'react';
import { MailSettings, getMailSettings, saveMailSettings, DEFAULT_MAIL_SETTINGS } from '../services/settings';
import { sendTestEmail } from '../services/email';

export default function MailSettingsPanel() {
    const [form, setForm] = useState<MailSettings>(DEFAULT_MAIL_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const cfg = await getMailSettings(true);
            setForm(cfg);
        } catch (err: any) {
            setError(err.message || '설정 조회 실패');
        } finally {
            setLoading(false);
        }
    };

    const update = (patch: Partial<MailSettings>) => setForm(prev => ({ ...prev, ...patch }));

    const handleSave = async () => {
        if (!form.serviceId || !form.templateId || !form.publicKey) {
            alert('Service ID, Template ID, Public Key는 필수입니다.');
            return;
        }
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            await saveMailSettings(form);
            setNotice('메일 설정이 저장되었습니다. 이후 모든 메일 발송에 적용됩니다.');
        } catch (err: any) {
            setError(err.message || '저장 실패 (AppSettings 리스트가 생성되어 있는지 확인하세요)');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!testEmail) {
            alert('테스트 메일을 받을 이메일 주소를 입력하세요.');
            return;
        }
        setTesting(true);
        setError(null);
        setNotice(null);
        try {
            // 저장 여부와 무관하게 현재 폼 값으로 테스트
            await sendTestEmail(testEmail, form);
            setNotice(`테스트 메일을 ${testEmail} 으로 발송했습니다. 수신함을 확인하세요.`);
        } catch (err: any) {
            setError(err.message || '테스트 발송 실패');
        } finally {
            setTesting(false);
        }
    };

    const inputCls = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">메일 발송 설정</h2>
                <button onClick={load} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-semibold transition" title="새로고침">
                    <i className="ri-refresh-line"></i>
                </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 flex items-start gap-2">
                <i className="ri-information-line text-lg mt-0.5"></i>
                <div>
                    이 앱은 백엔드가 없는 브라우저 앱이라 SMTP 직접 발송이 불가능하여 <b>EmailJS</b>로 발송합니다.
                    아래 값은 <a href="https://dashboard.emailjs.com" target="_blank" rel="noreferrer" className="underline font-semibold">EmailJS 대시보드</a>에서 확인할 수 있습니다.
                    설정은 SharePoint <code className="bg-white px-1 rounded">AppSettings</code> 리스트에 저장되어 모든 사용자에게 공유됩니다.
                </div>
            </div>

            {loading && <div className="py-8 text-center text-gray-400"><i className="ri-loader-4-line animate-spin mr-2"></i>설정을 불러오는 중...</div>}

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex justify-between items-center">
                    <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i> {error}</span>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><i className="ri-close-line"></i></button>
                </div>
            )}
            {notice && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 flex justify-between items-center">
                    <span className="flex items-center gap-2"><i className="ri-checkbox-circle-line"></i> {notice}</span>
                    <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800"><i className="ri-close-line"></i></button>
                </div>
            )}

            {!loading && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.enabled} onChange={(e) => update({ enabled: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="font-bold text-gray-700">메일 발송 사용</span>
                        <span className="text-xs text-gray-400">(끄면 출고신청 등에서 메일을 보내지 않습니다)</span>
                    </label>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">EmailJS Service ID *</label>
                        <input type="text" value={form.serviceId} onChange={(e) => update({ serviceId: e.target.value })} className={inputCls} placeholder="service_xxxxxxx" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">EmailJS Template ID *</label>
                        <input type="text" value={form.templateId} onChange={(e) => update({ templateId: e.target.value })} className={inputCls} placeholder="template_xxxxxxx" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">EmailJS Public Key *</label>
                        <input type="text" value={form.publicKey} onChange={(e) => update({ publicKey: e.target.value })} className={inputCls} placeholder="공개 키" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">발신자 표시명</label>
                            <input type="text" value={form.fromName} onChange={(e) => update({ fromName: e.target.value })} className={inputCls} placeholder="BIT 관리 시스템" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">참조(CC) 이메일 <span className="text-gray-400 font-normal">(선택)</span></label>
                            <input type="text" value={form.ccEmail} onChange={(e) => update({ ccEmail: e.target.value })} className={inputCls} placeholder="cc@bit.kr" />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button onClick={handleSave} disabled={saving}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition flex justify-center items-center gap-2">
                            <i className="ri-save-line"></i>{saving ? '저장 중...' : '설정 저장'}
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-5">
                        <label className="block text-xs font-bold text-gray-500 mb-1">테스트 메일 발송</label>
                        <div className="flex gap-2">
                            <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className={inputCls} placeholder="받을 이메일 주소" />
                            <button onClick={handleTest} disabled={testing}
                                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl font-bold transition whitespace-nowrap flex items-center gap-2">
                                <i className="ri-send-plane-line"></i>{testing ? '발송 중...' : '테스트'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">현재 입력된 설정값(저장 전 포함)으로 발송합니다.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
