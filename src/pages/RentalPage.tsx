import React, { useState, useEffect } from 'react';
import { Rental } from '../types';
import { readRentalExcel, exportRentalExcel } from '../services/excelService';
import { getRentals, addRental, updateRental } from '../storage';
import { AVAILABLE_ROOMS, ROOM_AREA_MAP } from '../constants/roomData';

export default function RentalPage() {
    const [rentals, setRentals] = useState<Rental[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRental, setCurrentRental] = useState<Rental | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        loadRentals();
    }, []);

    const loadRentals = async () => {
        const loadedRentals = await getRentals();
        setRentals(loadedRentals);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                console.log('파일 읽기 시작...');
                const data = await readRentalExcel(e.target.files[0]);
                console.log('Excel 데이터:', data);

                for (const rental of data) {
                    console.log('저장 중:', rental);
                    await addRental(rental);
                }

                await loadRentals();
                alert('데이터를 성공적으로 불러왔습니다.');
            } catch (error: any) {
                console.error('Excel 업로드 오류:', error);
                console.error('오류 상세:', error.message, error.stack);
                alert(`파일을 읽는 중 오류가 발생했습니다: ${error.message || error}`);
            }
        }
    };

    const handleExport = () => {
        exportRentalExcel(rentals);
    };

    const handleAdd = () => {
        setCurrentRental({
            id: '',
            type: '',
            ho: '',
            area: '',
            tenantName: '',
            contact: '',
            email: '',
            rentalType: '',
            deposit: 0,
            monthlyRent: 0,
            maintenanceFee: 0,
            parkingFee: 0,
            paymentDate: '',
            contractStartDate: '',
            contractEndDate: '',
            remarks: '',
        });
        setIsEditMode(false);
        setIsModalOpen(true);
    };

    const handleEdit = (rental: Rental) => {
        setCurrentRental(rental);
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (currentRental) {
            try {
                console.log('저장 시작:', currentRental);
                if (isEditMode) {
                    await updateRental(currentRental.id, currentRental);
                    console.log('수정 완료');
                } else {
                    await addRental(currentRental);
                    console.log('추가 완료');
                }
                await loadRentals();
                setIsModalOpen(false);
                setCurrentRental(null);
                alert('저장되었습니다.');
            } catch (error: any) {
                console.error('저장 중 오류:', error);
                console.error('오류 상세:', error.message, error.stack);
                alert(`저장 중 오류가 발생했습니다: ${error.message || error}`);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (currentRental) {
            const { name, value } = e.target;

            if (name === 'ho') {
                const area = ROOM_AREA_MAP[value] || '';
                setCurrentRental({ ...currentRental, ho: value, area });
            } else if (name === 'deposit' || name === 'monthlyRent' || name === 'maintenanceFee' || name === 'parkingFee') {
                setCurrentRental({ ...currentRental, [name]: Number(value) || 0 });
            } else {
                setCurrentRental({ ...currentRental, [name]: value });
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">임대 관리</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAdd}
                            className="bg-blue-500/80 hover:bg-blue-600 backdrop-blur-sm text-white px-6 py-2.5 rounded-lg transition shadow-lg hover:shadow-blue-500/50"
                        >
                            + 신규 추가
                        </button>
                        <label className="bg-emerald-500/80 hover:bg-emerald-600 backdrop-blur-sm text-white px-6 py-2.5 rounded-lg cursor-pointer transition shadow-lg hover:shadow-emerald-500/50">
                            📁 엑셀 업로드
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                        </label>
                        <button
                            onClick={handleExport}
                            className="bg-purple-500/80 hover:bg-purple-600 backdrop-blur-sm text-white px-6 py-2.5 rounded-lg transition shadow-lg hover:shadow-purple-500/50"
                        >
                            💾 엑셀 다운로드
                        </button>
                    </div>
                </div>

                {/* Table Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gradient-to-r from-blue-600/50 to-purple-600/50">
                                <tr>
                                    <th className="w-20 px-3 py-3 text-center text-sm font-bold text-white border-r border-white/10">호실</th>
                                    <th className="w-24 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">임대인</th>
                                    <th className="w-36 px-3 py-3 text-center text-sm font-bold text-white border-r border-white/10">연락처</th>
                                    <th className="w-32 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">e-mail</th>
                                    <th className="w-20 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">임대면적</th>
                                    <th className="w-40 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">계약기간</th>
                                    <th className="w-28 px-3 py-3 text-center text-sm font-bold text-white border-r border-white/10">구분</th>
                                    <th className="w-28 px-3 py-3 text-center text-sm font-bold text-white border-r border-white/10">임대형태</th>
                                    <th className="w-24 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">입금</th>
                                    <th className="w-28 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">보증금</th>
                                    <th className="w-28 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">월임대료</th>
                                    <th className="w-24 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">관리비</th>
                                    <th className="w-24 px-2 py-3 text-center text-sm font-bold text-white border-r border-white/10">주차비</th>
                                    <th className="w-40 px-3 py-3 text-center text-sm font-bold text-white border-r border-white/10">비고</th>
                                    <th className="w-20 px-3 py-3 text-center text-sm font-bold text-white">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {rentals.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="px-6 py-12 text-center text-gray-400 text-lg">
                                            등록된 임대 내역이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    rentals.map((rental, index) => (
                                        <tr key={rental.id} className={`hover:bg-white/5 transition ${index % 2 === 0 ? 'bg-white/5' : ''}`}>
                                            <td className="px-3 py-3 text-center border-r border-white/5 text-gray-200 font-medium">{rental.ho}</td>
                                            <td className="px-2 py-3 border-r border-white/5 text-gray-200 truncate">{rental.tenantName}</td>
                                            <td className="px-3 py-3 border-r border-white/5 text-gray-300 text-sm">{rental.contact}</td>
                                            <td className="px-2 py-3 border-r border-white/5 text-blue-300 text-sm truncate">{rental.email}</td>
                                            <td className="px-2 py-3 text-right border-r border-white/5 text-gray-200">{rental.area}</td>
                                            <td className="px-2 py-3 text-center border-r border-white/5 text-gray-300 text-xs whitespace-nowrap">
                                                {rental.contractStartDate}<br />~ {rental.contractEndDate}
                                            </td>
                                            <td className="px-3 py-3 text-center border-r border-white/5">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${rental.type === '직원' ? 'bg-green-500/30 text-green-200' : 'bg-yellow-500/30 text-yellow-200'}`}>
                                                    {rental.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center border-r border-white/5 text-gray-200">{rental.rentalType}</td>
                                            <td className="px-2 py-3 text-center border-r border-white/5 text-gray-300 text-sm">{rental.paymentDate}</td>
                                            <td className="px-2 py-3 text-right border-r border-white/5 text-emerald-300 font-medium">{rental.deposit.toLocaleString()}</td>
                                            <td className="px-2 py-3 text-right border-r border-white/5 text-emerald-300 font-medium">{rental.monthlyRent.toLocaleString()}</td>
                                            <td className="px-2 py-3 text-right border-r border-white/5 text-gray-300">{rental.maintenanceFee.toLocaleString()}</td>
                                            <td className="px-2 py-3 text-right border-r border-white/5 text-gray-300">{rental.parkingFee.toLocaleString()}</td>
                                            <td className="px-3 py-3 border-r border-white/5 text-gray-400 text-xs">{rental.remarks}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleEdit(rental)}
                                                    className="text-blue-400 hover:text-blue-300 font-medium text-sm transition"
                                                >
                                                    ✏️ 수정
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && currentRental && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center overflow-y-auto z-50 p-4">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full border border-white/20">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 rounded-t-2xl">
                            <h2 className="text-2xl font-bold text-white">{isEditMode ? '📝 임대 정보 수정' : '➕ 임대 정보 추가'}</h2>
                        </div>

                        <form onSubmit={handleSave} className="p-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">호실 *</label>
                                    <select
                                        name="ho"
                                        value={currentRental.ho}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                        <option value="" className="bg-slate-800">선택하세요</option>
                                        {AVAILABLE_ROOMS.map(room => (
                                            <option key={room} value={room} className="bg-slate-800">{room}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">면적</label>
                                    <input
                                        type="text"
                                        name="area"
                                        value={currentRental.area}
                                        readOnly
                                        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">구분 *</label>
                                    <select
                                        name="type"
                                        value={currentRental.type}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                        <option value="" className="bg-slate-800">선택하세요</option>
                                        <option value="직원" className="bg-slate-800">직원</option>
                                        <option value="일반인" className="bg-slate-800">일반인</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">임대형태 *</label>
                                    <select
                                        name="rentalType"
                                        value={currentRental.rentalType}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                        <option value="" className="bg-slate-800">선택하세요</option>
                                        <option value="월세" className="bg-slate-800">월세</option>
                                        <option value="전세" className="bg-slate-800">전세</option>
                                        <option value="반전세" className="bg-slate-800">반전세</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">임대인(상호/성명) *</label>
                                    <input
                                        type="text"
                                        name="tenantName"
                                        value={currentRental.tenantName}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">연락처</label>
                                    <input
                                        type="text"
                                        name="contact"
                                        value={currentRental.contact}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={currentRental.email}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">계약시작일 *</label>
                                    <input
                                        type="date"
                                        name="contractStartDate"
                                        value={currentRental.contractStartDate}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">계약종료일 *</label>
                                    <input
                                        type="date"
                                        name="contractEndDate"
                                        value={currentRental.contractEndDate}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">입금날짜</label>
                                    <input
                                        type="date"
                                        name="paymentDate"
                                        value={currentRental.paymentDate}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">보증금</label>
                                    <input
                                        type="number"
                                        name="deposit"
                                        value={currentRental.deposit}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">월임대료</label>
                                    <input
                                        type="number"
                                        name="monthlyRent"
                                        value={currentRental.monthlyRent}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">월관리비</label>
                                    <input
                                        type="number"
                                        name="maintenanceFee"
                                        value={currentRental.maintenanceFee}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">주차비</label>
                                    <input
                                        type="number"
                                        name="parkingFee"
                                        value={currentRental.parkingFee}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">비고</label>
                                    <input
                                        type="text"
                                        name="remarks"
                                        value={currentRental.remarks}
                                        onChange={handleChange}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg transition border border-white/20"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg transition shadow-lg hover:shadow-blue-500/50"
                                >
                                    💾 저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
