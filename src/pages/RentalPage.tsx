import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
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
        <Layout title="임대 관리" showBackButton={true} maxWidth="max-w-[1800px]">
            <div className="flex justify-end gap-3 mb-6">
                <button
                    onClick={handleAdd}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 font-bold"
                >
                    <i className="ri-add-line"></i> 신규 추가
                </button>
                <label className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl cursor-pointer transition shadow-md flex items-center gap-2 font-bold">
                    <i className="ri-file-excel-2-line"></i> 엑셀 업로드
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                    onClick={handleExport}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 font-bold"
                >
                    <i className="ri-download-line"></i> 엑셀 다운로드
                </button>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="w-[80px] px-3 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">호실</th>
                                <th className="w-[120px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">임대인</th>
                                <th className="w-[130px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">연락처</th>
                                <th className="w-[180px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">e-mail</th>
                                <th className="w-[80px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">임대면적</th>
                                <th className="w-[200px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">계약기간</th>
                                <th className="w-[80px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">구분</th>
                                <th className="w-[80px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">임대형태</th>
                                <th className="w-[60px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">입금</th>
                                <th className="w-[100px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">보증금</th>
                                <th className="w-[100px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">월임대료</th>
                                <th className="w-[100px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">관리비</th>
                                <th className="w-[100px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">주차비</th>
                                <th className="min-w-[150px] px-2 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">비고</th>
                                <th className="w-[80px] px-3 py-4 text-center text-sm font-bold text-gray-600 whitespace-nowrap">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {rentals.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="px-6 py-12 text-center text-gray-400 text-lg">
                                        등록된 임대 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                rentals.map((rental, index) => (
                                    <tr key={rental.id} className={`hover:bg-blue-50 transition ${index % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                                        <td className="px-3 py-3 text-center text-gray-900 font-bold">{rental.ho}</td>
                                        <td className="px-2 py-3 text-center text-gray-700 font-semibold truncate max-w-[120px]" title={rental.tenantName}>{rental.tenantName}</td>
                                        <td className="px-2 py-3 text-center text-gray-600 text-sm whitespace-nowrap">{rental.contact}</td>
                                        <td className="px-2 py-3 text-center text-blue-600 text-sm truncate max-w-[180px]" title={rental.email}>{rental.email}</td>
                                        <td className="px-2 py-3 text-center text-gray-600">{rental.area}</td>
                                        <td className="px-2 py-3 text-center text-gray-500 text-xs whitespace-nowrap">
                                            {rental.contractStartDate} ~ {rental.contractEndDate}
                                        </td>
                                        <td className="px-2 py-3 text-center whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${rental.type === '직원' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {rental.type}
                                            </span>
                                        </td>
                                        <td className="px-2 py-3 text-center text-gray-700 whitespace-nowrap">{rental.rentalType}</td>
                                        <td className="px-2 py-3 text-center text-gray-600 text-sm">{rental.paymentDate}</td>
                                        <td className="px-2 py-3 text-right text-gray-900 font-medium">{rental.deposit.toLocaleString()}</td>
                                        <td className="px-2 py-3 text-right text-gray-900 font-medium">{rental.monthlyRent.toLocaleString()}</td>
                                        <td className="px-2 py-3 text-right text-gray-600">{rental.maintenanceFee.toLocaleString()}</td>
                                        <td className="px-2 py-3 text-right text-gray-600">{rental.parkingFee.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-gray-500 text-xs truncate max-w-[200px]" title={rental.remarks}>{rental.remarks}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleEdit(rental)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-lg transition p-2 rounded-full hover:bg-blue-100"
                                                title="수정"
                                            >
                                                <i className="ri-edit-line"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && currentRental && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center overflow-y-auto z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-gray-100">
                        <div className="px-8 py-6 border-b border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? '임대 정보 수정' : '임대 정보 추가'}</h2>
                        </div>

                        <form onSubmit={handleSave} className="p-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">호실 *</label>
                                    <select
                                        name="ho"
                                        value={currentRental.ho}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택하세요</option>
                                        {AVAILABLE_ROOMS.map(room => (
                                            <option key={room} value={room}>{room}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">면적</label>
                                    <input
                                        type="text"
                                        name="area"
                                        value={currentRental.area}
                                        readOnly
                                        className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-500 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">구분 *</label>
                                    <select
                                        name="type"
                                        value={currentRental.type}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택하세요</option>
                                        <option value="직원">직원</option>
                                        <option value="일반인">일반인</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">임대형태 *</label>
                                    <select
                                        name="rentalType"
                                        value={currentRental.rentalType}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택하세요</option>
                                        <option value="월세">월세</option>
                                        <option value="전세">전세</option>
                                        <option value="반전세">반전세</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">임대인(상호/성명) *</label>
                                    <input
                                        type="text"
                                        name="tenantName"
                                        value={currentRental.tenantName}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">연락처</label>
                                    <input
                                        type="text"
                                        name="contact"
                                        value={currentRental.contact}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={currentRental.email}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">계약시작일 *</label>
                                    <input
                                        type="date"
                                        name="contractStartDate"
                                        value={currentRental.contractStartDate}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">계약종료일 *</label>
                                    <input
                                        type="date"
                                        name="contractEndDate"
                                        value={currentRental.contractEndDate}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">입금날짜</label>
                                    <input
                                        type="date"
                                        name="paymentDate"
                                        value={currentRental.paymentDate}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">보증금</label>
                                    <input
                                        type="number"
                                        name="deposit"
                                        value={currentRental.deposit}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">월임대료</label>
                                    <input
                                        type="number"
                                        name="monthlyRent"
                                        value={currentRental.monthlyRent}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">월관리비</label>
                                    <input
                                        type="number"
                                        name="maintenanceFee"
                                        value={currentRental.maintenanceFee}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">주차비</label>
                                    <input
                                        type="number"
                                        name="parkingFee"
                                        value={currentRental.parkingFee}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">비고</label>
                                    <input
                                        type="text"
                                        name="remarks"
                                        value={currentRental.remarks}
                                        onChange={handleChange}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-2.5 rounded-xl transition border border-gray-200"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-md"
                                >
                                    저장 완료
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
