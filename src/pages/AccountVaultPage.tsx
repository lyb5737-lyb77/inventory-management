// 업무 사이트 계정(ID·비밀번호) 보관·공유 페이지 — 비밀번호는 암호문으로 저장하고 볼 때만 복호화
import { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import { SiteAccount } from '../types';
import {
    getSiteAccounts, addSiteAccount, updateSiteAccount, deleteSiteAccount,
    getVaultKeyValue, createVaultKeyValue,
} from '../storage';
import { VAULT_KEY_VERSION, generateVaultKeyValue, encryptText, decryptText } from '../services/vaultCrypto';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../auth/usePermission';
import { todayKst } from '../utils/date';

const CATEGORIES = ['관공서', 'IT서비스', '거래처', '솔루션', '라이센스', '내부시스템', '기타'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REVEAL_MS = 30_000;
const DUE_SOON_DAYS = 14;

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url.trim());

const dayNumber = (ymd: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000 : null;
};

// 비밀번호 변경일 + 변경 주기까지 남은 일수 (계산할 수 없으면 null)
const daysUntilRotation = (a: SiteAccount): number | null => {
    const changed = dayNumber(a.passwordChangedAt);
    const today = dayNumber(todayKst());
    if (changed === null || today === null || a.rotationDays <= 0) return null;
    return changed + a.rotationDays - today;
};

interface FormState {
    title: string;
    category: string;
    description: string;
    url: string;
    loginId: string;
    password: string;
    secretNote: string;
    owner: string;
    viewers: string;
    rotationDays: number;
    status: '사용' | '중지';
}

const emptyForm = (owner: string): FormState => ({
    title: '', category: CATEGORIES[0], description: '', url: '', loginId: '',
    password: '', secretNote: '', owner, viewers: '', rotationDays: 90, status: '사용',
});

interface Revealed {
    password: string;
    note: string;
}

export default function AccountVaultPage() {
    const { email } = useAuth();
    const { canAccess, isReady, role } = usePermission();
    const isAdmin = role === 'ADMIN';
    const allowed = isReady && canAccess('account-vault');

    const [accounts, setAccounts] = useState<SiteAccount[]>([]);
    const [keyValue, setKeyValue] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [category, setCategory] = useState('전체');
    const [search, setSearch] = useState('');
    const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
    const timers = useRef<number[]>([]);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<SiteAccount | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm(email));
    const [originalPassword, setOriginalPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [list, key] = await Promise.all([getSiteAccounts(), getVaultKeyValue(VAULT_KEY_VERSION)]);
            setAccounts(list.sort((a, b) => a.title.localeCompare(b.title, 'ko')));
            setKeyValue(key);
        } catch (err: any) {
            setError(`${err.message || '조회 실패'} — SharePoint에 SiteAccounts·SiteAccountKeys 리스트가 있고 접근 권한이 있는지 확인하세요.`);
        } finally {
            setLoading(false);
            setLoaded(true);
        }
    };

    useEffect(() => {
        if (allowed) load();
    }, [allowed]);

    // 다른 탭으로 전환하면 보이던 비밀번호를 즉시 가리고, 페이지를 떠나면 타이머를 정리
    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden) setRevealed({});
        };
        document.addEventListener('visibilitychange', onVisibility);
        const pending = timers.current;
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            pending.forEach(clearTimeout);
        };
    }, []);

    const visible = useMemo(
        () => accounts.filter(a => isAdmin || a.owner === email || a.viewers.includes(email)),
        [accounts, isAdmin, email],
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return visible.filter(a => {
            if (category !== '전체' && a.category !== category) return false;
            if (!term) return true;
            return [a.title, a.category, a.url, a.description, a.loginId].some(v => v.toLowerCase().includes(term));
        });
    }, [visible, category, search]);

    const canEdit = (a: SiteAccount) => isAdmin || a.owner === email;

    const decrypt = (payload: string): Promise<string> => {
        if (!keyValue) return Promise.reject(new Error('암호화 키가 없습니다.'));
        return decryptText(keyValue, payload);
    };

    const showDecryptError = (err: any) =>
        setError(`비밀번호를 풀 수 없습니다. 키가 바뀌었거나 데이터가 손상되었습니다. (${err?.message || err})`);

    const hide = (id: string) =>
        setRevealed(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });

    const handleReveal = async (a: SiteAccount) => {
        if (revealed[a.id]) {
            hide(a.id);
            return;
        }
        try {
            const [password, note] = await Promise.all([decrypt(a.passwordEnc), decrypt(a.secretNoteEnc)]);
            setRevealed(prev => ({ ...prev, [a.id]: { password, note } }));
            timers.current.push(window.setTimeout(() => hide(a.id), REVEAL_MS));
        } catch (err) {
            showDecryptError(err);
        }
    };

    const handleCopy = async (a: SiteAccount) => {
        try {
            await navigator.clipboard.writeText(await decrypt(a.passwordEnc));
            setNotice(`"${a.title}" 비밀번호를 복사했습니다. 30초 후 클립보드를 비웁니다.`);
            timers.current.push(window.setTimeout(() => {
                // 창에 포커스가 없으면 브라우저가 클립보드 쓰기를 막아 비우지 못할 수 있음
                navigator.clipboard.writeText('').catch(() => undefined);
            }, REVEAL_MS));
        } catch (err) {
            showDecryptError(err);
        }
    };

    const handleOpenSite = (url: string) => {
        if (isHttpUrl(url)) window.open(url.trim(), '_blank', 'noopener,noreferrer');
    };

    const openNew = () => {
        setEditing(null);
        setForm(emptyForm(email));
        setOriginalPassword('');
        setShowPassword(false);
        setIsFormOpen(true);
    };

    const openEdit = async (a: SiteAccount) => {
        try {
            const [password, secretNote] = await Promise.all([decrypt(a.passwordEnc), decrypt(a.secretNoteEnc)]);
            setEditing(a);
            setForm({
                title: a.title, category: a.category, description: a.description, url: a.url,
                loginId: a.loginId, password, secretNote, owner: a.owner, viewers: a.viewers.join(', '),
                rotationDays: a.rotationDays, status: a.status,
            });
            setOriginalPassword(password);
            setShowPassword(false);
            setIsFormOpen(true);
        } catch (err) {
            showDecryptError(err);
        }
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditing(null);
        setForm(emptyForm(email));
        setOriginalPassword('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyValue) return;

        const owner = form.owner.trim().toLowerCase();
        const viewers = Array.from(new Set(
            form.viewers.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean),
        ));
        const invalidEmails = [owner, ...viewers].filter(v => !EMAIL_REGEX.test(v));

        if (!form.title.trim() || !form.loginId.trim() || !form.password) {
            alert('서비스명, ID, 비밀번호는 필수입니다.');
            return;
        }
        if (form.url.trim() && !isHttpUrl(form.url)) {
            alert('접근 URL은 http:// 또는 https:// 로 시작해야 합니다.');
            return;
        }
        if (invalidEmails.length > 0) {
            alert(`이메일 형식이 올바르지 않습니다: ${invalidEmails.join(', ') || '(담당자 비어 있음)'}`);
            return;
        }

        const prev = editing;
        const passwordChanged = !prev || form.password !== originalPassword;
        setLoading(true);
        setError(null);
        try {
            const record: Omit<SiteAccount, 'id'> = {
                title: form.title.trim(),
                category: form.category,
                description: form.description.trim(),
                url: form.url.trim(),
                loginId: form.loginId.trim(),
                passwordEnc: passwordChanged || !prev ? await encryptText(keyValue, form.password) : prev.passwordEnc,
                secretNoteEnc: await encryptText(keyValue, form.secretNote.trim()),
                owner,
                viewers,
                rotationDays: Math.max(0, Math.floor(form.rotationDays) || 0),
                passwordChangedAt: passwordChanged || !prev ? todayKst() : prev.passwordChangedAt,
                status: form.status,
                updatedBy: email,
            };
            if (prev) await updateSiteAccount(prev.id, record);
            else await addSiteAccount(record);
            closeForm();
            await load();
            setNotice(prev ? `"${record.title}" 계정을 수정했습니다.` : `"${record.title}" 계정을 등록했습니다.`);
        } catch (err: any) {
            setError(err.message || '저장에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (a: SiteAccount) => {
        if (!confirm(`"${a.title}" 계정을 삭제하시겠습니까?\nSharePoint 휴지통으로 이동합니다.`)) return;
        setLoading(true);
        setError(null);
        try {
            await deleteSiteAccount(a.id);
            hide(a.id);
            await load();
            setNotice(`"${a.title}" 계정을 삭제했습니다.`);
        } catch (err: any) {
            setError(err.message || '삭제에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async () => {
        if (!confirm('암호화 키를 생성합니다.\n생성 후 SharePoint SiteAccountKeys 리스트의 KeyValue 값을 반드시 오프라인에 백업하세요.\n진행할까요?')) return;
        setLoading(true);
        setError(null);
        try {
            // 다른 관리자가 먼저 만들었을 수 있으므로 생성 직전에 다시 확인
            if (!(await getVaultKeyValue(VAULT_KEY_VERSION))) {
                await createVaultKeyValue(VAULT_KEY_VERSION, generateVaultKeyValue());
            }
            await load();
            setNotice('암호화 키를 생성했습니다. SiteAccountKeys 리스트의 KeyValue 값을 오프라인에 백업하세요.');
        } catch (err: any) {
            setError(err.message || '키 생성에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (!isReady) {
        return (
            <Layout title="업무 계정 관리" showBackButton={true}>
                <div className="py-32 text-center text-gray-500">권한 정보를 불러오는 중...</div>
            </Layout>
        );
    }

    if (!allowed) {
        return (
            <Layout title="업무 계정 관리" showBackButton={true}>
                <div className="py-32 text-center">
                    <i className="ri-lock-line text-5xl text-gray-300"></i>
                    <p className="mt-4 text-lg font-semibold text-gray-600">이 메뉴에 접근할 권한이 없습니다.</p>
                    <p className="mt-1 text-sm text-gray-400">관리자에게 "업무 계정 관리" 메뉴 권한을 요청하세요.</p>
                </div>
            </Layout>
        );
    }

    const ready = !!keyValue;
    const keyMissing = loaded && !error && !keyValue;

    return (
        <Layout title="업무 계정 관리" showBackButton={true}>
            {loading && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            <div className="space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex justify-between items-start gap-3">
                        <span className="flex items-start gap-2"><i className="ri-error-warning-line mt-0.5"></i>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><i className="ri-close-line"></i></button>
                    </div>
                )}
                {notice && (
                    <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 flex justify-between items-start gap-3">
                        <span className="flex items-start gap-2"><i className="ri-checkbox-circle-line mt-0.5"></i>{notice}</span>
                        <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800"><i className="ri-close-line"></i></button>
                    </div>
                )}

                {keyMissing && accounts.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex justify-between items-center gap-3 flex-wrap">
                        <span>
                            암호화 키가 아직 없습니다.{' '}
                            {isAdmin ? '키를 생성해야 계정을 등록할 수 있습니다.' : '관리자가 키를 먼저 생성해야 합니다.'}
                        </span>
                        {isAdmin && (
                            <button onClick={handleCreateKey} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold">
                                <i className="ri-key-2-line mr-1"></i>암호화 키 생성
                            </button>
                        )}
                    </div>
                )}
                {keyMissing && accounts.length > 0 && (
                    <div className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-4">
                        <b>계정은 있는데 암호화 키를 찾을 수 없습니다.</b> 새 키를 만들면 기존 비밀번호를 풀 수 없으므로,
                        백업해 둔 키 값을 SharePoint SiteAccountKeys 리스트에 Title "{VAULT_KEY_VERSION}"로 복구하세요.
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                        <div className="flex gap-1 flex-wrap">
                            {['전체', ...CATEGORIES].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCategory(c)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${category === c ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            <div className="relative">
                                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input
                                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="서비스명·URL·내용·ID 검색"
                                    className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                            <button onClick={load} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm" title="새로고침">
                                <i className="ri-refresh-line"></i>
                            </button>
                            <button
                                onClick={openNew} disabled={!ready}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold"
                            >
                                <i className="ri-add-line mr-1"></i>등록
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-3">
                        비밀번호는 암호문으로 저장되며, 볼 때만 풀리고 30초 후 자동으로 가려집니다.
                    </p>

                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="min-w-full text-sm divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr className="text-left text-xs font-bold text-gray-500">
                                    <th className="px-3 py-2">서비스</th>
                                    <th className="px-3 py-2">ID</th>
                                    <th className="px-3 py-2">비밀번호</th>
                                    <th className="px-3 py-2">변경 주기</th>
                                    <th className="px-3 py-2">담당자 / 공유</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-12 text-center text-gray-400">
                                            {loaded ? '표시할 계정이 없습니다.' : '불러오는 중...'}
                                        </td>
                                    </tr>
                                ) : filtered.map(a => {
                                    const days = daysUntilRotation(a);
                                    const shown = revealed[a.id];
                                    return (
                                        <tr key={a.id} className={`align-top ${a.status === '중지' ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}`}>
                                            <td className="px-3 py-3 max-w-[280px]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-800">{a.title}</span>
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold">{a.category}</span>
                                                    {a.status === '중지' && <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-500 text-[11px] font-bold">중지</span>}
                                                </div>
                                                {a.description && <div className="text-xs text-gray-500 mt-1 whitespace-pre-line">{a.description}</div>}
                                                {a.url && <div className="text-xs text-gray-400 mt-1 truncate" title={a.url}>{a.url}</div>}
                                            </td>
                                            <td className="px-3 py-3 font-mono text-gray-700">{a.loginId}</td>
                                            <td className="px-3 py-3 min-w-[200px]">
                                                <div className="font-mono text-gray-800 break-all">{shown ? shown.password : '●●●●●●●●'}</div>
                                                {shown?.note && (
                                                    <div className="text-xs text-gray-500 mt-1 whitespace-pre-line bg-gray-50 rounded p-1.5">{shown.note}</div>
                                                )}
                                                <div className="flex gap-1 mt-1.5">
                                                    <button onClick={() => handleReveal(a)} disabled={!ready}
                                                        className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-40">
                                                        {shown ? '숨기기' : '보기'}
                                                    </button>
                                                    <button onClick={() => handleCopy(a)} disabled={!ready}
                                                        className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-40">
                                                        복사
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                {days === null ? (
                                                    <span className="text-gray-400">-</span>
                                                ) : days < 0 ? (
                                                    <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">만료 ({-days}일 지남)</span>
                                                ) : days <= DUE_SOON_DAYS ? (
                                                    <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{days}일 남음</span>
                                                ) : (
                                                    <span className="text-xs text-gray-500">변경 {a.passwordChangedAt}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-xs text-gray-500">
                                                <div>{a.owner}</div>
                                                <div title={a.viewers.join('\n')}>공유 {a.viewers.length}명</div>
                                            </td>
                                            <td className="px-3 py-3 text-right whitespace-nowrap">
                                                {isHttpUrl(a.url) && (
                                                    <button onClick={() => handleOpenSite(a.url)} className="p-1.5 text-gray-400 hover:text-slate-700" title="사이트 열기">
                                                        <i className="ri-external-link-line"></i>
                                                    </button>
                                                )}
                                                {canEdit(a) && (
                                                    <>
                                                        <button onClick={() => openEdit(a)} disabled={!ready} className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-40" title="수정">
                                                            <i className="ri-edit-2-line"></i>
                                                        </button>
                                                        <button onClick={() => handleDelete(a)} className="p-1.5 text-gray-300 hover:text-red-500" title="삭제">
                                                            <i className="ri-delete-bin-line"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-800 mb-5">{editing ? '계정 수정' : '계정 등록'}</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">서비스명 *</label>
                                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">카테고리 *</label>
                                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">접근 URL</label>
                                <input type="text" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                                    placeholder="https://" className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">ID *</label>
                                <input type="text" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                                    autoComplete="off" className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">비밀번호 *</label>
                                <div className="flex gap-1">
                                    <input type={showPassword ? 'text' : 'password'} value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        autoComplete="new-password" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono" />
                                    <button type="button" onClick={() => setShowPassword(v => !v)}
                                        className="px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600" title={showPassword ? '가리기' : '보기'}>
                                        <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                                    </button>
                                </div>
                                {editing && <p className="text-[11px] text-gray-400 mt-1">바꾸면 변경일이 오늘로 갱신됩니다.</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">내용</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={2} placeholder="용도, 사용 부서 등" className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">보안 메모 (암호화 저장)</label>
                                <textarea value={form.secretNote} onChange={(e) => setForm({ ...form, secretNote: e.target.value })}
                                    rows={2} placeholder="2단계 인증 수신처, 보안 질문 답변 등" className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">담당자 이메일 *</label>
                                <input type="text" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">변경 주기(일)</label>
                                    <input type="number" min={0} value={form.rotationDays}
                                        onChange={(e) => setForm({ ...form, rotationDays: Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">상태</label>
                                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as '사용' | '중지' })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                                        <option value="사용">사용</option>
                                        <option value="중지">중지</option>
                                    </select>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">볼 수 있는 사용자 (이메일, 쉼표나 줄바꿈으로 구분)</label>
                                <textarea value={form.viewers} onChange={(e) => setForm({ ...form, viewers: e.target.value })}
                                    rows={2} placeholder="user1@bit.kr, user2@bit.kr" className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" />
                                <p className="text-[11px] text-gray-400 mt-1">담당자와 관리자는 항상 볼 수 있습니다. 0일로 두면 변경 주기 알림을 쓰지 않습니다.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-6">
                            <button type="button" onClick={closeForm} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold">취소</button>
                            <button type="submit" className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold">
                                {editing ? '수정 저장' : '등록'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Layout>
    );
}
