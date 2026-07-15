import { useState, useEffect, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import Layout from '../components/Layout';
import { Order, Item, Warehouse, Customer } from '../types';
import {
    getOrders, addOrder, updateOrder, deleteOrder,
    getItems, getWarehouses, getCustomers, addCustomer, addTransaction,
} from '../storage';
import { readBitmallOrderExcel, exportOrdersExcel, ParsedOrderRow } from '../services/excelService';
import { sendOutboundEmail } from '../services/email';

const HQ_NAME = '비트본사';

// 한 주문 행을 출고할 수 있는 창고 후보 (재고 품목이 존재하는 창고)
interface ShipLocation {
    warehouse: string;
    item: Item;
    label: string; // 본사출고 / 창고출고 / {창고명} 출고
}

interface PendingShip {
    order: Order;
    location: ShipLocation;
}

export default function OrderRegisterPage() {
    const { accounts } = useMsal();
    const currentUser = accounts[0];

    const [orders, setOrders] = useState<Order[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const [loading, setLoading] = useState(false);
    const [busyMsg, setBusyMsg] = useState<string>('처리 중...');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [mode, setMode] = useState<'upload' | 'manual'>('upload');
    const [statusFilter, setStatusFilter] = useState<'전체' | '미처리' | '출고완료'>('전체');
    const [search, setSearch] = useState('');
    const [exportMonth, setExportMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // 업로드 미리보기
    const [parsedRows, setParsedRows] = useState<ParsedOrderRow[]>([]);

    // 개별 입력 폼
    const emptyManual = {
        customerCode: '', customerName: '', partNumber: '', productName: '',
        quantity: 1, salesUnitPrice: 0, paymentType: '신용카드',
        email: '', contact: '', address: '',
    };
    const [manualForm, setManualForm] = useState(emptyManual);

    // 출고처 검색 모달 (개별 입력용)
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');

    // 출고신청 비고 모달
    const [pendingShip, setPendingShip] = useState<PendingShip | null>(null);
    const [shipRemarks, setShipRemarks] = useState('');

    // 거래처코드 입력(해결) 모달 — 코드가 없고 사업자번호로도 못 찾은 행
    const [resolveState, setResolveState] = useState<{
        prepared: ParsedOrderRow[];      // 코드/사업자번호 보완 완료된 전체 행
        unresolvedIdx: number[];         // 코드가 여전히 없는 행 인덱스
        existingCustomers: Customer[];
    } | null>(null);
    const [resolveInputs, setResolveInputs] = useState<Record<number, string>>({});

    // 품번 수정 모달 (잘못 등록된 주문의 품번 정정)
    const [correctingOrder, setCorrectingOrder] = useState<Order | null>(null);
    const [correctForm, setCorrectForm] = useState({ partNumber: '', productName: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setBusyMsg('데이터를 불러오는 중...');
        try {
            const [ordersData, itemsData, whData, custData] = await Promise.all([
                getOrders(), getItems(), getWarehouses(), getCustomers(),
            ]);
            // 최신순 정렬 (주문일자 desc, 그 다음 id desc)
            ordersData.sort((a, b) =>
                (b.orderDate || '').localeCompare(a.orderDate || '') ||
                Number(b.id) - Number(a.id)
            );
            setOrders(ordersData);
            setItems(itemsData);
            setWarehouses(whData);
            setCustomers(custData);
        } catch (err: any) {
            setError(err.message || '데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    // 거래처코드(더존번호)로 등록 여부 확인
    const findCustomerByCode = (code: string): Customer | undefined =>
        customers.find(c => c.douzoneNumber.trim() === code.trim());

    // 품번으로 출고 가능 창고 후보 계산
    const getShipLocations = (order: Order): ShipLocation[] => {
        const matched = items.filter(i => i.partNumber.trim() === order.partNumber.trim());
        const nonHqCount = matched.filter(i => (i.warehouse || HQ_NAME) !== HQ_NAME).length;
        return matched.map(i => {
            const wh = i.warehouse || HQ_NAME;
            let label: string;
            if (wh === HQ_NAME) label = '본사출고';
            else label = nonHqCount > 1 ? `${wh} 출고` : '창고출고';
            return { warehouse: wh, item: i, label };
        });
    };

    // ===== 엑셀 업로드 =====
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // 동일 파일 재업로드 허용
        if (!file) return;
        setError(null);
        setNotice(null);
        try {
            const rows = await readBitmallOrderExcel(file);
            if (rows.length === 0) {
                setError('엑셀에서 주문 데이터를 찾지 못했습니다. 양식을 확인해주세요.');
                return;
            }
            setParsedRows(rows);
        } catch (err: any) {
            setError('엑셀 파싱 실패: ' + (err.message || err));
        }
    };

    // 업로드 검증 → (필요 시) 거래처코드 입력 → 등록
    const handleRegisterParsed = async () => {
        if (parsedRows.length === 0) return;
        setError(null);
        setNotice(null);
        setLoading(true);
        setBusyMsg('검증 중...');

        try {
            const [itemsData, existingCustomers, allOrders] = await Promise.all([
                getItems(), getCustomers(), getOrders(),
            ]);

            // (4) 미등록 품번 검사
            const partSet = new Set(itemsData.map(i => i.partNumber.trim()).filter(Boolean));
            const unregistered = parsedRows.filter(r => !partSet.has(r.partNumber.trim()));

            // (3) 최근 10개 업로드 배치의 품번→품명 사전으로 불일치 검사
            const batchIds = Array.from(new Set(allOrders.map(o => o.uploadBatch).filter(Boolean))).sort();
            const recentBatches = new Set(batchIds.slice(-10));
            const histMap = new Map<string, Set<string>>();
            allOrders.forEach(o => {
                if (!recentBatches.has(o.uploadBatch)) return;
                const pn = o.partNumber.trim(); const nm = o.productName.trim();
                if (!pn || !nm) return;
                if (!histMap.has(pn)) histMap.set(pn, new Set());
                histMap.get(pn)!.add(nm);
            });
            const mismatches = parsedRows.filter(r => {
                const pn = r.partNumber.trim(); const nm = r.productName.trim();
                const hist = histMap.get(pn);
                return hist && hist.size > 0 && nm && !hist.has(nm);
            });

            // (3)(4) 하나라도 문제면 전체 중단
            if (unregistered.length > 0 || mismatches.length > 0) {
                let msg = '';
                if (unregistered.length > 0) {
                    msg += `❌ 미등록 품번 ${unregistered.length}건 — 오타이거나 제품 등록이 필요합니다:\n`
                        + unregistered.slice(0, 12).map(r => `· ${r.partNumber} (${r.productName})`).join('\n')
                        + (unregistered.length > 12 ? `\n…외 ${unregistered.length - 12}건` : '') + '\n\n';
                }
                if (mismatches.length > 0) {
                    msg += `❌ 품번-품명 불일치 ${mismatches.length}건 — 최근 주문과 품명이 다릅니다:\n`
                        + mismatches.slice(0, 12).map(r => `· ${r.partNumber}: '${r.productName}' ↔ 기존 '${Array.from(histMap.get(r.partNumber.trim())!).join(', ')}'`).join('\n')
                        + (mismatches.length > 12 ? `\n…외 ${mismatches.length - 12}건` : '') + '\n\n';
                }
                setError(msg + '수정 후 다시 업로드해주세요. (전체 중단)');
                setLoading(false);
                return;
            }

            // (1) 사업자번호로만 보완: 코드 없으면 사업자번호로 기존 출고처를 찾아 코드 채움,
            //     코드는 있는데 사업자번호가 비면 기존 출고처에서 사업자번호 보완
            const byCode = new Map(existingCustomers.filter(c => c.douzoneNumber.trim()).map(c => [c.douzoneNumber.trim(), c] as const));
            const byBiz = new Map(existingCustomers.filter(c => c.businessNumber.trim()).map(c => [c.businessNumber.trim(), c] as const));
            const prepared: ParsedOrderRow[] = parsedRows.map(r => {
                let code = r.customerCode.trim();
                let biz = (r.bizNumber || '').replace(/\D/g, ''); // 사업자번호는 숫자만으로 비교/저장
                if (!code && biz) {
                    const ex = byBiz.get(biz);
                    if (ex) code = ex.douzoneNumber.trim();
                }
                if (code && !biz) {
                    const ex = byCode.get(code);
                    if (ex && ex.businessNumber.trim()) biz = ex.businessNumber.trim();
                }
                return { ...r, customerCode: code, bizNumber: biz };
            });

            // (2) 여전히 코드가 없는 행 → 입력 모달
            const unresolvedIdx = prepared.map((r, i) => (r.customerCode ? -1 : i)).filter(i => i >= 0);
            if (unresolvedIdx.length > 0) {
                const inputs: Record<number, string> = {};
                unresolvedIdx.forEach(i => { inputs[i] = ''; });
                setResolveInputs(inputs);
                setResolveState({ prepared, unresolvedIdx, existingCustomers });
                setLoading(false);
                return;
            }

            // 모두 해결됨 → 확인 후 등록
            setLoading(false);
            if (!confirm(`검증 완료. ${prepared.length}건의 주문을 등록하시겠습니까?`)) return;
            await finalizeRegistration(prepared, existingCustomers);
        } catch (err: any) {
            setError(err.message || '검증 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    // 실제 거래처(신규) + 주문 등록. (5) 사업자번호·거래처코드 고유성 검증 포함.
    const finalizeRegistration = async (rows: ParsedOrderRow[], existingCustomers: Customer[]) => {
        setLoading(true);
        setBusyMsg('주문 등록 중...');
        setError(null);
        const batchId = `B${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
        const newlyRegistered: string[] = [];

        try {
            const byCode = new Map(existingCustomers.filter(c => c.douzoneNumber.trim()).map(c => [c.douzoneNumber.trim(), c] as const));
            const byBiz = new Map(existingCustomers.filter(c => c.businessNumber.trim()).map(c => [c.businessNumber.trim(), c] as const));
            const createdCodes = new Set<string>();
            const createdBiz = new Set<string>();

            setBusyMsg('거래처 확인 및 등록 중...');
            for (const r of rows) {
                const code = r.customerCode.trim();
                const biz = r.bizNumber.trim();
                if (!code) throw new Error('거래처코드가 없는 행이 있어 중단합니다.');

                const existing = byCode.get(code);
                if (existing || createdCodes.has(code)) {
                    // 기존/이미 처리된 거래처 — 사업자번호 상충 검사 (5)
                    if (existing && biz && existing.businessNumber.trim() && existing.businessNumber.trim() !== biz) {
                        throw new Error(`거래처코드 ${code}의 사업자번호가 기존(${existing.businessNumber})과 다릅니다: '${biz}'. 전체 중단.`);
                    }
                    continue;
                }
                // 신규 거래처 — (5) 사업자번호가 다른 거래처에 이미 있으면 중복 등록 불가
                if (biz && (byBiz.has(biz) || createdBiz.has(biz))) {
                    throw new Error(`사업자번호 '${biz}'는 이미 다른 거래처에 등록되어 있어 신규 등록할 수 없습니다. (거래처코드 ${code}) 전체 중단.`);
                }
                await addCustomer({
                    douzoneNumber: code,
                    name: r.customerName || code,
                    contact: r.contact,
                    email: r.email,
                    address: r.address,
                    businessNumber: biz,
                    representativeName: '',
                    mobilePhone: '',
                    remarks: '',
                });
                createdCodes.add(code);
                if (biz) createdBiz.add(biz);
                newlyRegistered.push(`${code} (${r.customerName})`);
            }

            setBusyMsg('주문 저장 중...');
            for (const r of rows) {
                await addOrder({
                    orderDate: r.orderDate,
                    customerCode: r.customerCode,
                    customerName: r.customerName,
                    bizNumber: r.bizNumber,
                    partNumber: r.partNumber,
                    productName: r.productName,
                    quantity: r.quantity,
                    salesUnitPrice: r.salesUnitPrice,
                    paymentType: r.paymentType,
                    email: r.email,
                    contact: r.contact,
                    address: r.address,
                    status: '미처리',
                    shippedWarehouse: '',
                    uploadBatch: batchId,
                    remarks: '',
                });
            }

            setParsedRows([]);
            setResolveState(null);
            await loadData();
            setNotice(
                `주문 ${rows.length}건 등록 완료.` +
                (newlyRegistered.length > 0
                    ? ` 신규 거래처 ${newlyRegistered.length}건 등록: ${newlyRegistered.join(', ')}`
                    : ' (신규 등록 거래처 없음)')
            );
        } catch (err: any) {
            setError(err.message || '주문 등록 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 거래처코드 입력 모달 제출: 하나라도 비면 전체 중단
    const submitResolve = async () => {
        if (!resolveState) return;
        const { prepared, unresolvedIdx, existingCustomers } = resolveState;
        for (const i of unresolvedIdx) {
            if (!(resolveInputs[i] || '').trim()) {
                alert('모든 거래처코드를 입력해야 합니다. 빈 값이 있어 전체 등록을 중단합니다.');
                return;
            }
        }
        const resolved = prepared.map((r, i) =>
            unresolvedIdx.includes(i) ? { ...r, customerCode: resolveInputs[i].trim() } : r,
        );
        setResolveState(null);
        await finalizeRegistration(resolved, existingCustomers);
    };

    const cancelResolve = () => {
        setResolveState(null);
        setError('거래처코드 입력이 취소되어 전체 등록을 중단했습니다.');
    };

    // ===== 개별 입력 =====
    const handleManualCustomerSelect = (c: Customer) => {
        setManualForm(prev => ({
            ...prev,
            customerCode: c.douzoneNumber,
            customerName: c.name,
            email: prev.email || c.email,
            contact: prev.contact || c.contact,
            address: prev.address || c.address,
        }));
        setIsCustomerModalOpen(false);
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualForm.customerCode || !manualForm.partNumber || manualForm.quantity <= 0) {
            alert('거래처, 품번, 수량은 필수입니다.');
            return;
        }
        setLoading(true);
        setBusyMsg('주문 등록 중...');
        setError(null);
        try {
            await addOrder({
                orderDate: new Date().toISOString().split('T')[0],
                customerCode: manualForm.customerCode,
                customerName: manualForm.customerName,
                bizNumber: '',
                partNumber: manualForm.partNumber,
                productName: manualForm.productName,
                quantity: manualForm.quantity,
                salesUnitPrice: manualForm.salesUnitPrice,
                paymentType: manualForm.paymentType,
                email: manualForm.email,
                contact: manualForm.contact,
                address: manualForm.address,
                status: '미처리',
                shippedWarehouse: '',
                uploadBatch: 'manual',
                remarks: '',
            });
            setManualForm(emptyManual);
            await loadData();
            setNotice('주문이 등록되었습니다.');
        } catch (err: any) {
            setError(err.message || '주문 등록 실패');
        } finally {
            setLoading(false);
        }
    };

    // ===== 출고 신청 =====
    const openShipModal = (order: Order, location: ShipLocation) => {
        setPendingShip({ order, location });
        setShipRemarks('');
    };

    const confirmShip = async () => {
        if (!pendingShip) return;
        const { order, location } = pendingShip;
        const { item, warehouse } = location;
        const isHq = warehouse === HQ_NAME;

        // 창고출고(원격)는 담당자 이메일 발송이 필요 → 창고 정보 확인
        let wh: Warehouse | undefined;
        if (!isHq) {
            wh = warehouses.find(w => w.name === warehouse);
            if (!wh) {
                alert(`창고 정보(${warehouse})를 찾을 수 없습니다. 관리자 페이지에서 창고를 등록해주세요.`);
                return;
            }
            if (!wh.email) {
                alert(`창고 "${warehouse}"의 담당자 이메일이 없습니다.`);
                return;
            }
        }
        if (item.quantity < order.quantity) {
            if (!confirm(
                `${item.name}의 현재고(${item.quantity})가 주문수량(${order.quantity})보다 부족합니다.\n` +
                `마이너스 재고로 출고를 진행하시겠습니까?`
            )) return;
        }

        setPendingShip(null);
        setLoading(true);
        setBusyMsg(isHq ? '본사 출고 처리 중...' : '출고 신청 처리 중...');
        setError(null);
        try {
            // 창고출고: 담당자에게 출고신청 이메일 발송 (본사출고는 사내 안내 팝업으로 대체, 이메일 없음)
            if (!isHq && wh) {
                await sendOutboundEmail({
                    warehouseName: wh.name,
                    managerEmail: wh.email,
                    items: [{ name: item.name, quantity: order.quantity }],
                    customerName: order.customerName,
                    customerAddress: order.address,
                    customerContact: order.contact,
                    requesterName: currentUser?.name || 'Unknown User',
                    remarks: shipRemarks,
                });
            }

            // OUT 거래기록 → 재고 차감 (본사/창고 공통)
            await addTransaction({
                itemId: item.id,
                itemName: item.name,
                type: 'OUT',
                quantity: order.quantity,
                date: new Date().toISOString().split('T')[0],
                target: order.customerName,
                warehouse: warehouse,
                remarks: `[비트몰주문]${isHq ? '(본사출고)' : ''} ${shipRemarks}`.trim(),
            });

            // 주문 상태 업데이트
            await updateOrder(order.id, { status: '출고완료', shippedWarehouse: warehouse });

            await loadData();
            setNotice(isHq
                ? `${order.customerName} / ${item.name} 본사 출고 처리 완료 (재고 반영)`
                : `${order.customerName} / ${item.name} 출고 신청이 완료되었습니다. (${warehouse})`);
        } catch (err: any) {
            setError(err.message || '출고 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportMonth = async () => {
        const count = orders.filter(o => (o.orderDate || '').startsWith(exportMonth)).length;
        if (count === 0) {
            alert(`${exportMonth} 주문 내역이 없습니다.`);
            return;
        }
        setLoading(true);
        setBusyMsg('엑셀 양식 생성 중...');
        setError(null);
        try {
            await exportOrdersExcel(orders, exportMonth, items);
        } catch (err: any) {
            setError(err.message || '엑셀 다운로드 실패');
        } finally {
            setLoading(false);
        }
    };

    // 품번 수정 모달 열기
    const openCorrectModal = (order: Order) => {
        setCorrectingOrder(order);
        setCorrectForm({ partNumber: order.partNumber, productName: order.productName });
        setError(null);
    };

    const handleCorrectPartNumberInput = (pn: string) => {
        const it = items.find(i => i.partNumber === pn);
        setCorrectForm(prev => ({ ...prev, partNumber: pn, productName: it ? it.name : prev.productName }));
    };

    // 품번 정정 저장. 미처리 건은 단순 정정, 출고완료 건은 재고까지 자동 보정
    // (잘못 나간 품목은 입고로 복원 + 올바른 품목을 동일 창고에서 재출고).
    const submitCorrectPartNumber = async () => {
        if (!correctingOrder) return;
        const newPart = correctForm.partNumber.trim();
        const newName = correctForm.productName.trim();
        if (!newPart) {
            alert('품번을 입력해주세요.');
            return;
        }
        if (newPart === correctingOrder.partNumber.trim() && newName === correctingOrder.productName.trim()) {
            alert('변경된 내용이 없습니다.');
            return;
        }

        const isShipped = correctingOrder.status === '출고완료';
        const wh = correctingOrder.shippedWarehouse || HQ_NAME;
        let newItem: Item | undefined;
        let oldItem: Item | undefined;

        if (isShipped) {
            newItem = items.find(i => i.partNumber.trim() === newPart && (i.warehouse || HQ_NAME) === wh);
            if (!newItem) {
                alert(`정정할 품번 "${newPart}"이(가) "${wh}" 창고의 품목에 없습니다.\n먼저 자재 관리에서 해당 품목을 등록한 후 다시 시도해주세요.`);
                return;
            }
            oldItem = items.find(i => i.partNumber.trim() === correctingOrder.partNumber.trim() && (i.warehouse || HQ_NAME) === wh);
            if (!confirm(
                `이미 출고완료된 주문입니다. 품번 정정 시 재고도 함께 보정됩니다.\n\n` +
                `· ${wh}: ${oldItem ? oldItem.name : correctingOrder.partNumber} 재고 ${correctingOrder.quantity} 입고 복원\n` +
                `· ${wh}: ${newItem.name} 재고 ${correctingOrder.quantity} 재출고\n\n` +
                `진행하시겠습니까?`
            )) return;
        } else {
            if (!confirm(`품번을 "${correctingOrder.partNumber}" → "${newPart}"(으)로 수정하시겠습니까?`)) return;
        }

        setLoading(true);
        setBusyMsg('품번 수정 처리 중...');
        setError(null);
        try {
            if (isShipped && newItem) {
                const today = new Date().toISOString().split('T')[0];
                if (oldItem) {
                    await addTransaction({
                        itemId: oldItem.id,
                        itemName: oldItem.name,
                        type: 'IN',
                        quantity: correctingOrder.quantity,
                        date: today,
                        warehouse: wh,
                        remarks: `[품번수정] 오류 출고 재고 복원 (${correctingOrder.partNumber} → ${newPart})`,
                    });
                }
                await addTransaction({
                    itemId: newItem.id,
                    itemName: newItem.name,
                    type: 'OUT',
                    quantity: correctingOrder.quantity,
                    date: today,
                    target: correctingOrder.customerName,
                    warehouse: wh,
                    remarks: `[품번수정] 정정 출고 (${correctingOrder.partNumber} → ${newPart})`,
                });
            }
            await updateOrder(correctingOrder.id, { partNumber: newPart, productName: newName });
            setCorrectingOrder(null);
            await loadData();
            setNotice(
                `품번을 "${correctingOrder.partNumber}" → "${newPart}"(으)로 수정했습니다.` +
                (isShipped ? ' 재고도 정정 반영되었습니다.' : '')
            );
        } catch (err: any) {
            setError(err.message || '품번 수정 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (order: Order) => {
        if (!confirm(`주문(${order.customerName} / ${order.productName})을 삭제하시겠습니까?`)) return;
        setLoading(true);
        setBusyMsg('삭제 중...');
        try {
            await deleteOrder(order.id);
            await loadData();
        } catch (err: any) {
            setError(err.message || '삭제 실패');
        } finally {
            setLoading(false);
        }
    };

    // 목록 필터링
    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase();
        return orders.filter(o => {
            if (statusFilter !== '전체' && o.status !== statusFilter) return false;
            if (!term) return true;
            return (
                o.customerName.toLowerCase().includes(term) ||
                o.customerCode.toLowerCase().includes(term) ||
                o.partNumber.toLowerCase().includes(term) ||
                o.productName.toLowerCase().includes(term)
            );
        });
    }, [orders, statusFilter, search]);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        c.douzoneNumber.includes(customerSearchTerm)
    );

    const krw = (n: number) => n.toLocaleString('ko-KR');

    return (
        <Layout title="주문 등록" showBackButton={true}>
            {loading && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-700 font-semibold">{busyMsg}</p>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex justify-between items-center">
                        <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i> {error}</span>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><i className="ri-close-line"></i></button>
                    </div>
                )}
                {notice && (
                    <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 flex justify-between items-start gap-3">
                        <span className="flex items-start gap-2"><i className="ri-checkbox-circle-line mt-0.5"></i> <span>{notice}</span></span>
                        <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800"><i className="ri-close-line"></i></button>
                    </div>
                )}

                {/* 입력 방식 탭 */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                    <div className="flex gap-2 mb-6 border-b border-gray-100 pb-4">
                        <button
                            onClick={() => setMode('upload')}
                            className={`px-5 py-2.5 rounded-xl font-bold transition ${mode === 'upload' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <i className="ri-file-excel-2-line mr-2"></i>엑셀 업로드
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-5 py-2.5 rounded-xl font-bold transition ${mode === 'manual' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <i className="ri-edit-line mr-2"></i>개별 입력
                        </button>
                    </div>

                    {mode === 'upload' ? (
                        <div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <label className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold cursor-pointer transition shadow-md flex items-center gap-2">
                                    <i className="ri-upload-2-line"></i>
                                    비트몰 자재출고 엑셀 선택
                                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                </label>
                                <span className="text-sm text-gray-500">
                                    "비트몰 자재출고 YYYY.MM.DD.xlsx" 양식 (출고일자=주문일자, 거래처코드=더존번호)
                                </span>
                            </div>

                            {parsedRows.length > 0 && (
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-gray-800">미리보기 ({parsedRows.length}건)</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => setParsedRows([])} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold transition">취소</button>
                                            <button onClick={handleRegisterParsed} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition shadow-sm">
                                                <i className="ri-save-line mr-1"></i>주문 등록 ({parsedRows.length})
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                                        <table className="min-w-full text-sm divide-y divide-gray-100">
                                            <thead className="bg-gray-50">
                                                <tr className="text-left text-xs font-bold text-gray-500 uppercase">
                                                    <th className="px-3 py-2">주문일자</th>
                                                    <th className="px-3 py-2">거래처코드</th>
                                                    <th className="px-3 py-2">거래처명</th>
                                                    <th className="px-3 py-2">등록</th>
                                                    <th className="px-3 py-2">품번</th>
                                                    <th className="px-3 py-2">품명</th>
                                                    <th className="px-3 py-2 text-right">수량</th>
                                                    <th className="px-3 py-2 text-right">매출단가</th>
                                                    <th className="px-3 py-2">결제</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {parsedRows.map((r, i) => {
                                                    const exists = !!findCustomerByCode(r.customerCode);
                                                    return (
                                                        <tr key={i} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 whitespace-nowrap">{r.orderDate}</td>
                                                            <td className="px-3 py-2 font-mono text-xs">{r.customerCode}</td>
                                                            <td className="px-3 py-2">{r.customerName}</td>
                                                            <td className="px-3 py-2">
                                                                {exists
                                                                    ? <span className="text-xs text-gray-400">등록됨</span>
                                                                    : <span className="text-xs font-bold text-orange-600">신규등록예정</span>}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono text-xs">{r.partNumber}</td>
                                                            <td className="px-3 py-2">{r.productName}</td>
                                                            <td className="px-3 py-2 text-right">{r.quantity}</td>
                                                            <td className="px-3 py-2 text-right">{krw(r.salesUnitPrice)}</td>
                                                            <td className="px-3 py-2 whitespace-nowrap">{r.paymentType}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleManualSubmit} className="grid md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">거래처코드(더존번호) *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text" readOnly value={manualForm.customerCode ? `${manualForm.customerCode} (${manualForm.customerName})` : ''}
                                        placeholder="출고처를 검색하세요" onClick={() => setIsCustomerModalOpen(true)}
                                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 cursor-pointer focus:outline-none"
                                    />
                                    <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition">
                                        <i className="ri-search-line"></i>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">품번 *</label>
                                <input list="part-numbers" type="text" value={manualForm.partNumber}
                                    onChange={(e) => {
                                        const pn = e.target.value;
                                        const it = items.find(i => i.partNumber === pn);
                                        setManualForm(prev => ({ ...prev, partNumber: pn, productName: it ? it.name : prev.productName }));
                                    }}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <datalist id="part-numbers">
                                    {items.map(i => <option key={i.id} value={i.partNumber}>{i.name}</option>)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">품명</label>
                                <input type="text" value={manualForm.productName} onChange={(e) => setManualForm({ ...manualForm, productName: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">수량 *</label>
                                <input type="number" min="1" value={manualForm.quantity} onChange={(e) => setManualForm({ ...manualForm, quantity: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">매출단가</label>
                                <input type="number" min="0" value={manualForm.salesUnitPrice} onChange={(e) => setManualForm({ ...manualForm, salesUnitPrice: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">결제구분</label>
                                <input type="text" value={manualForm.paymentType} onChange={(e) => setManualForm({ ...manualForm, paymentType: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">이메일</label>
                                <input type="email" value={manualForm.email} onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">연락처</label>
                                <input type="text" value={manualForm.contact} onChange={(e) => setManualForm({ ...manualForm, contact: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">주소(배송처)</label>
                                <input type="text" value={manualForm.address} onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="md:col-span-2">
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition flex justify-center items-center gap-2">
                                    <i className="ri-add-circle-line"></i>주문 등록
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* 주문 목록 */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                        <h3 className="text-xl font-bold text-gray-800">주문 내역 ({filteredOrders.length})</h3>
                        <div className="flex gap-2 items-center flex-wrap">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none">
                                <option value="전체">전체</option>
                                <option value="미처리">미처리</option>
                                <option value="출고완료">출고완료</option>
                            </select>
                            <div className="relative">
                                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input type="text" placeholder="거래처/품번/품명 검색" value={search} onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <button onClick={loadData} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-semibold transition" title="새로고침">
                                <i className="ri-refresh-line"></i>
                            </button>
                            <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1">
                                <input type="month" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)}
                                    className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                                <button onClick={handleExportMonth} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition shadow-sm flex items-center gap-1" title="해당 월 주문을 비트몰 양식으로 다운로드">
                                    <i className="ri-file-excel-2-line"></i>월 다운로드
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="min-w-full text-sm divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr className="text-left text-xs font-bold text-gray-500 uppercase">
                                    <th className="px-3 py-2">주문일자</th>
                                    <th className="px-3 py-2">거래처</th>
                                    <th className="px-3 py-2">품번/품명</th>
                                    <th className="px-3 py-2 text-right">수량</th>
                                    <th className="px-3 py-2">상태</th>
                                    <th className="px-3 py-2">출고 처리</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredOrders.length === 0 ? (
                                    <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-400">주문 내역이 없습니다.</td></tr>
                                ) : (
                                    filteredOrders.map(order => {
                                        const locations = getShipLocations(order);
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50 align-top">
                                                <td className="px-3 py-3 whitespace-nowrap">{order.orderDate}</td>
                                                <td className="px-3 py-3">
                                                    <div className="font-semibold text-gray-800">{order.customerName}</div>
                                                    <div className="text-xs text-gray-400 font-mono">{order.customerCode}</div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="font-mono text-xs text-gray-500">{order.partNumber}</div>
                                                    <div className="text-gray-800">{order.productName}</div>
                                                </td>
                                                <td className="px-3 py-3 text-right font-semibold">{order.quantity}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {order.status === '출고완료'
                                                        ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                                            <i className="ri-check-line"></i>출고완료{order.shippedWarehouse ? ` (${order.shippedWarehouse})` : ''}
                                                          </span>
                                                        : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">미처리</span>}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {order.status === '출고완료' ? (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    ) : locations.length === 0 ? (
                                                        <span className="text-xs text-red-400">재고품목 없음<br />(품번 미등록)</span>
                                                    ) : (
                                                        <div className="flex gap-2 flex-wrap">
                                                            {locations.map((loc, idx) => (
                                                                <button key={idx} onClick={() => openShipModal(order, loc)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition shadow-sm ${loc.warehouse === HQ_NAME ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                                                                    title={`${loc.item.name} / 현재고 ${loc.item.quantity}`}>
                                                                    <i className="ri-truck-line mr-1"></i>{loc.label}
                                                                    <span className="ml-1 opacity-80">(재고 {loc.item.quantity})</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <button onClick={() => openCorrectModal(order)} className="p-1.5 text-gray-400 hover:text-blue-600 transition" title="품번 수정">
                                                        <i className="ri-edit-2-line"></i>
                                                    </button>
                                                    <button onClick={() => handleDeleteOrder(order)} className="p-1.5 text-gray-300 hover:text-red-500 transition" title="삭제">
                                                        <i className="ri-delete-bin-line"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 출고처 검색 모달 */}
            {isCustomerModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-100">
                            <h3 className="text-2xl font-bold text-gray-800">출고처 검색</h3>
                            <button onClick={() => setIsCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600"><i className="ri-close-line text-2xl"></i></button>
                        </div>
                        <div className="mb-6 relative">
                            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input type="text" placeholder="출고처명 또는 더존번호로 검색..." value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} autoFocus
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0 border rounded-xl border-gray-100">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">더존번호</th>
                                        <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">출고처명</th>
                                        <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase">선택</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredCustomers.length === 0 ? (
                                        <tr><td colSpan={3} className="px-5 py-12 text-center text-gray-400">검색 결과가 없습니다.</td></tr>
                                    ) : (
                                        filteredCustomers.map(c => (
                                            <tr key={c.id} className="hover:bg-blue-50">
                                                <td className="px-5 py-3 text-gray-600 font-mono text-sm">{c.douzoneNumber}</td>
                                                <td className="px-5 py-3 text-gray-900 font-bold">{c.name}</td>
                                                <td className="px-5 py-3 text-right">
                                                    <button onClick={() => handleManualCustomerSelect(c)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-sm px-4 py-1.5 rounded-lg transition">선택</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 출고 모달: 본사출고는 사내 안내 팝업, 창고출고는 비고 입력 + 이메일 발송 */}
            {pendingShip && (pendingShip.location.warehouse === HQ_NAME ? (
                // 본사 출고 안내 팝업
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
                            <i className="ri-home-gear-line text-blue-600"></i>본사 출고
                        </h3>
                        <p className="text-sm text-gray-400 mb-5">아래 내역으로 본사 재고에서 출고하고 재고에 반영합니다.</p>
                        <div className="bg-gray-50 rounded-xl p-5 mb-5 text-sm space-y-2">
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">거래처명</span><span className="text-gray-800 font-semibold">{pendingShip.order.customerName}</span></div>
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">연락처</span><span className="text-gray-800">{pendingShip.order.contact || '-'}</span></div>
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">주소</span><span className="text-gray-800">{pendingShip.order.address || '-'}</span></div>
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">품명</span><span className="text-gray-800">{pendingShip.order.productName || pendingShip.location.item.name}</span></div>
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">품번</span><span className="text-gray-800 font-mono">{pendingShip.order.partNumber}</span></div>
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">수량</span><span className="text-gray-800">{pendingShip.order.quantity} <span className="text-gray-400">(현재고 {pendingShip.location.item.quantity})</span></span></div>
                            <div className="flex"><span className="w-20 shrink-0 text-gray-400">금일날짜</span><span className="text-gray-800">{new Date().toISOString().split('T')[0]}</span></div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
                            <p className="text-blue-700 font-bold text-lg">창고 출고바랍니다.</p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setPendingShip(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold transition">취소</button>
                            <button onClick={confirmShip} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md flex items-center gap-2">
                                <i className="ri-check-line"></i>출고 처리 (재고반영)
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // 창고 출고 신청 (비고 + 이메일)
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">출고 신청</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            <span className="font-semibold text-gray-700">{pendingShip.location.label}</span> — {pendingShip.location.warehouse}
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-1">
                            <div><span className="text-gray-400 mr-2">거래처</span>{pendingShip.order.customerName}</div>
                            <div><span className="text-gray-400 mr-2">품목</span>{pendingShip.location.item.name} ({pendingShip.order.partNumber})</div>
                            <div><span className="text-gray-400 mr-2">수량</span>{pendingShip.order.quantity} <span className="text-gray-400 ml-3 mr-2">현재고</span>{pendingShip.location.item.quantity}</div>
                        </div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">비고 (선택)</label>
                        <textarea value={shipRemarks} onChange={(e) => setShipRemarks(e.target.value)} rows={3} placeholder="출고 요청 시 전달할 비고를 입력하세요"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5" />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setPendingShip(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold transition">취소</button>
                            <button onClick={confirmShip} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md flex items-center gap-2">
                                <i className="ri-send-plane-fill"></i>출고 신청
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            {/* 거래처코드 입력(해결) 모달 — 코드 없고 사업자번호로도 못 찾은 행 */}
            {resolveState && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 border border-gray-100 max-h-[85vh] flex flex-col">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">거래처코드 입력</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            아래 {resolveState.unresolvedIdx.length}건은 거래처코드가 없고 사업자번호로도 기존 출고처를 찾지 못했습니다.
                            거래처코드를 입력하면 신규 출고처로 등록됩니다. <span className="text-red-500 font-semibold">하나라도 비우거나 취소하면 전체 등록이 중단됩니다.</span>
                        </p>
                        <div className="flex-1 overflow-y-auto min-h-0 border rounded-xl border-gray-100">
                            <table className="min-w-full text-sm divide-y divide-gray-100">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr className="text-left text-xs font-bold text-gray-500 uppercase">
                                        <th className="px-3 py-2">거래처명</th>
                                        <th className="px-3 py-2">사업자번호</th>
                                        <th className="px-3 py-2">주소</th>
                                        <th className="px-3 py-2">거래처코드 *</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {resolveState.unresolvedIdx.map(i => {
                                        const r = resolveState.prepared[i];
                                        return (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 font-semibold text-gray-800">{r.customerName || '(이름없음)'}</td>
                                                <td className="px-3 py-2 text-gray-500 font-mono text-xs">{r.bizNumber || '-'}</td>
                                                <td className="px-3 py-2 text-gray-500 text-xs max-w-[260px] truncate" title={r.address}>{r.address || '-'}</td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={resolveInputs[i] || ''}
                                                        onChange={(e) => setResolveInputs(prev => ({ ...prev, [i]: e.target.value }))}
                                                        placeholder="더존번호 입력"
                                                        className="w-40 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex gap-3 justify-end mt-6">
                            <button onClick={cancelResolve} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold transition">취소 (전체 중단)</button>
                            <button onClick={submitResolve} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md flex items-center gap-2">
                                <i className="ri-check-line"></i>입력 완료 · 등록
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 품번 수정 모달 */}
            {correctingOrder && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">품번 수정</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            {correctingOrder.customerName} · 수량 {correctingOrder.quantity}
                            {correctingOrder.status === '출고완료' && (
                                <span className="ml-2 text-orange-600 font-semibold">출고완료 건 — 재고도 함께 보정됩니다</span>
                            )}
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm">
                            <span className="text-gray-400 mr-2">기존 품번</span>
                            <span className="font-mono text-gray-700">{correctingOrder.partNumber}</span>
                            <span className="text-gray-400 mx-2">/</span>
                            <span className="text-gray-700">{correctingOrder.productName}</span>
                        </div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">정정할 품번</label>
                        <input
                            list="correct-part-numbers"
                            type="text"
                            value={correctForm.partNumber}
                            onChange={(e) => handleCorrectPartNumberInput(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                        />
                        <datalist id="correct-part-numbers">
                            {items.map(i => <option key={i.id} value={i.partNumber}>{i.name}</option>)}
                        </datalist>
                        <label className="block text-xs font-bold text-gray-500 mb-1">품명</label>
                        <input
                            type="text"
                            value={correctForm.productName}
                            onChange={(e) => setCorrectForm(prev => ({ ...prev, productName: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setCorrectingOrder(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold transition">취소</button>
                            <button onClick={submitCorrectPartNumber} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md flex items-center gap-2">
                                <i className="ri-check-line"></i>수정 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
