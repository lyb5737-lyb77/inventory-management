import { useState, useEffect, useMemo } from 'react';
import { MENUS, ASSIGNABLE_MENU_KEYS, MenuKey } from '../constants/menus';
import { useAuth } from '../auth/AuthContext';
import { BOOTSTRAP_ADMINS, Role } from '../auth/constants';
import {
    UserPermissionRecord,
    UserPermissionInput,
    fetchAllUserPermissions,
    createUserPermission,
    updateUserPermission,
    deleteUserPermission,
} from '../auth/permissionService';

const ASSIGNABLE_MENUS = MENUS.filter(m => ASSIGNABLE_MENU_KEYS.includes(m.key));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
    email: string;
    displayName: string;
    role: Role;
    allowedMenus: Set<MenuKey>;
    isActive: boolean;
    remarks: string;
}

const emptyForm = (): FormState => ({
    email: '',
    displayName: '',
    role: 'USER',
    allowedMenus: new Set<MenuKey>(),
    isActive: true,
    remarks: '',
});

export default function PermissionAdminPanel() {
    const { email: myEmail, role: myRole, refresh } = useAuth();

    const [records, setRecords] = useState<UserPermissionRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());

    const isBootstrapAdmin = (email: string): boolean =>
        BOOTSTRAP_ADMINS.map(e => e.toLowerCase()).includes(email.toLowerCase());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAllUserPermissions();
            setRecords(data);
        } catch (err: any) {
            setError(err?.message || '권한 목록 조회 실패');
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return records;
        return records.filter(
            r => r.email.includes(q) || r.displayName.toLowerCase().includes(q),
        );
    }, [records, search]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm());
        setIsModalOpen(true);
    };

    const openEdit = (rec: UserPermissionRecord) => {
        setEditingId(rec.spItemId);
        setForm({
            email: rec.email,
            displayName: rec.displayName,
            role: rec.role,
            allowedMenus: new Set<MenuKey>(rec.allowedMenus),
            isActive: rec.isActive,
            remarks: rec.remarks,
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setForm(emptyForm());
    };

    const toggleMenu = (key: MenuKey) => {
        setForm(prev => {
            const next = new Set(prev.allowedMenus);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return { ...prev, allowedMenus: next };
        });
    };

    const validateForm = (): string | null => {
        const email = form.email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(email)) return '올바른 이메일 형식이 아닙니다.';
        if (!form.displayName.trim()) return '이름을 입력해주세요.';

        if (!editingId) {
            const dup = records.find(r => r.email === email);
            if (dup) return '이미 등록된 이메일입니다.';
        }

        const targetIsMyself = email === myEmail;
        if (targetIsMyself) {
            if (form.role !== 'ADMIN') {
                return '본인의 역할을 ADMIN에서 강등할 수 없습니다.';
            }
            if (!form.isActive) {
                return '본인 계정을 비활성화할 수 없습니다.';
            }
        }

        if (isBootstrapAdmin(email) && form.role !== 'ADMIN') {
            return '시스템 관리자(부트스트랩 계정)는 USER로 강등할 수 없습니다.';
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        const normalizedEmail = form.email.trim().toLowerCase();
        const input: UserPermissionInput = {
            email: normalizedEmail,
            displayName: form.displayName.trim(),
            role: form.role,
            allowedMenus: form.role === 'ADMIN'
                ? []
                : Array.from(form.allowedMenus),
            isActive: form.isActive,
            remarks: form.remarks.trim(),
        };

        setLoading(true);
        setError(null);
        try {
            if (editingId) {
                await updateUserPermission(editingId, input);
            } else {
                await createUserPermission(input);
            }
            closeModal();
            await loadData();
            if (normalizedEmail === myEmail) {
                await refresh();
            }
        } catch (err: any) {
            setError(err?.message || '저장 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (rec: UserPermissionRecord) => {
        if (rec.email === myEmail) {
            alert('본인 계정은 삭제할 수 없습니다.');
            return;
        }
        if (isBootstrapAdmin(rec.email)) {
            alert('시스템 관리자(부트스트랩 계정)는 삭제할 수 없습니다.');
            return;
        }
        if (!confirm(`${rec.displayName || rec.email} 사용자의 권한을 삭제하시겠습니까?`)) return;

        setLoading(true);
        setError(null);
        try {
            await deleteUserPermission(rec.spItemId);
            await loadData();
        } catch (err: any) {
            setError(err?.message || '삭제 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (rec: UserPermissionRecord) => {
        if (rec.email === myEmail) {
            alert('본인 계정의 활성 상태는 변경할 수 없습니다.');
            return;
        }
        const next = !rec.isActive;
        setLoading(true);
        setError(null);
        try {
            await updateUserPermission(rec.spItemId, {
                email: rec.email,
                displayName: rec.displayName,
                role: rec.role,
                allowedMenus: rec.role === 'ADMIN' ? [] : rec.allowedMenus,
                isActive: next,
                remarks: rec.remarks,
            });
            await loadData();
        } catch (err: any) {
            setError(err?.message || '상태 변경 실패');
        } finally {
            setLoading(false);
        }
    };

    if (myRole !== 'ADMIN') {
        return (
            <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm flex items-start gap-3">
                <i className="ri-lock-line text-xl mt-0.5"></i>
                <div>
                    <div className="font-bold mb-1">권한 관리는 ADMIN만 접근 가능합니다</div>
                    <div>다른 탭을 이용해 주세요.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">사용자별 메뉴 접근 권한</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        ADMIN은 모든 메뉴 접근. USER는 체크된 메뉴만 표시. 변경은 사용자 새로고침 또는 최대 5분 후 반영.
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="이메일/이름 검색..."
                        className="flex-1 md:w-64 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                    />
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg whitespace-nowrap"
                    >
                        <i className="ri-user-add-line"></i>
                        새 사용자
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <i className="ri-error-warning-line text-lg mt-0.5"></i>
                    <span>{error}</span>
                </div>
            )}

            {loading && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                    처리 중...
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 text-left">
                            <th className="px-4 py-3 font-semibold">이메일</th>
                            <th className="px-4 py-3 font-semibold">이름</th>
                            <th className="px-4 py-3 font-semibold">역할</th>
                            <th className="px-4 py-3 font-semibold">허용 메뉴</th>
                            <th className="px-4 py-3 font-semibold text-center">활성</th>
                            <th className="px-4 py-3 font-semibold text-right">작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                                    {records.length === 0
                                        ? 'UserPermissions 리스트가 비어있습니다. "새 사용자"로 추가하세요.'
                                        : '검색 결과가 없습니다.'}
                                </td>
                            </tr>
                        )}
                        {filtered.map(rec => {
                            const isMe = rec.email === myEmail;
                            const isBootstrap = isBootstrapAdmin(rec.email);
                            return (
                                <tr key={rec.spItemId} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-gray-800">
                                        {rec.email}
                                        {isMe && (
                                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">본인</span>
                                        )}
                                        {isBootstrap && (
                                            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">시스템 관리자</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{rec.displayName || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs font-bold rounded ${rec.role === 'ADMIN' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {rec.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {rec.role === 'ADMIN' ? (
                                            <span className="text-gray-400 italic">전체</span>
                                        ) : rec.allowedMenus.length === 0 ? (
                                            <span className="text-gray-400 italic">없음</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {rec.allowedMenus.map(key => {
                                                    const m = MENUS.find(x => x.key === key);
                                                    return (
                                                        <span key={key} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                                            {m?.title || key}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleToggleActive(rec)}
                                            disabled={isMe}
                                            className={`px-3 py-1 text-xs font-bold rounded ${rec.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'} ${isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {rec.isActive ? '활성' : '비활성'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openEdit(rec)}
                                                className="px-3 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rec)}
                                                disabled={isMe || isBootstrap}
                                                className={`px-3 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded ${(isMe || isBootstrap) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">
                                    {editingId ? '권한 수정' : '새 사용자 권한 추가'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <i className="ri-close-line text-2xl"></i>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        이메일 *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        disabled={!!editingId}
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="user@bit.kr"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                    />
                                    {editingId && (
                                        <p className="text-xs text-gray-400 mt-1">수정 시 이메일은 변경할 수 없습니다.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        이름 *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={form.displayName}
                                        onChange={e => setForm({ ...form, displayName: e.target.value })}
                                        placeholder="홍길동"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        역할
                                    </label>
                                    <select
                                        value={form.role}
                                        onChange={e => setForm({ ...form, role: e.target.value as Role })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    >
                                        <option value="USER">USER (지정 메뉴만 접근)</option>
                                        <option value="ADMIN">ADMIN (전체 + 권한관리)</option>
                                    </select>
                                </div>

                                {form.role === 'USER' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            허용 메뉴
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {ASSIGNABLE_MENUS.map(m => (
                                                <label
                                                    key={m.key}
                                                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={form.allowedMenus.has(m.key)}
                                                        onChange={() => toggleMenu(m.key)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm">{m.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={form.isActive}
                                            onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                            className="rounded"
                                        />
                                        <span className="text-sm font-semibold text-gray-700">활성 상태</span>
                                        <span className="text-xs text-gray-400">(비활성 시 모든 메뉴 차단)</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                                        메모 (선택)
                                    </label>
                                    <input
                                        type="text"
                                        value={form.remarks}
                                        onChange={e => setForm({ ...form, remarks: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                                >
                                    {loading ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
