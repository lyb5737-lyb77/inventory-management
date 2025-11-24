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

                // SharePoint에 일괄 추가
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

            // 호실 선택시 면적 자동 설정
            if (name === 'ho') {
                const area = ROOM_AREA_MAP[value] || '';
                setCurrentRental({ ...currentRental, ho: value, area });
            } else if (name === 'deposit' || name === 'monthlyRent' || name === 'maintenanceFee' || name === 'parkingFee') {
                // 숫자 필드 처리
                setCurrentRental({ ...currentRental, [name]: Number(value) || 0 });
            } else {
                setCurrentRental({ ...currentRental, [name]: value });
            }
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">임대 관리</h1>
                <div className="space-x-4">
                    <button onClick={handleAdd} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">
                        신규 추가
                    </button>
                    <label className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded cursor-pointer">
                        엑셀 업로드
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <button onClick={handleExport} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                        엑셀 다운로드
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-yellow-50">
                        <tr>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">호실</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">임대인</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">연락처</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">e-mail</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">임대면적</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">계약기간</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">구분</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">임대형태</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">입금</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">보증금</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">월임대료</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">관리비</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">주차비</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">비고</th>
                            <th className="px-3 py-2 text-center text-xs font-bold border border-gray-300 text-gray-900">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {rentals.length === 0 ? (
                            <tr>
                                <td colSpan={15} className="px-6 py-8 text-center text-gray-500">
                                    등록된 임대 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            rentals.map((rental) => (
                                <tr key={rental.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-center border border-gray-300 text-gray-900">{rental.ho}</td>
                                    <td className="px-3 py-2 border border-gray-300 text-gray-900">{rental.tenantName}</td>
                                    <td className="px-3 py-2 border border-gray-300 text-gray-900">{rental.contact}</td>
                                    <td className="px-3 py-2 border border-gray-300 text-blue-600">{rental.email}</td>
                                    <td className="px-3 py-2 text-right border border-gray-300 text-gray-900">{rental.area}</td>
                                    <td className="px-3 py-2 text-center border border-gray-300 text-xs text-gray-900">
                                        {rental.contractStartDate}<br />~ {rental.contractEndDate}
                                    </td>
                                    <td className="px-3 py-2 text-center border border-gray-300 text-gray-900">{rental.type}</td>
                                    <td className="px-3 py-2 text-center border border-gray-300 text-gray-900">{rental.rentalType}</td>
                                    <td className="px-3 py-2 text-center border border-gray-300 text-gray-900">{rental.paymentDate}</td>
                                    <td className="px-3 py-2 text-right border border-gray-300 text-gray-900">{rental.deposit.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right border border-gray-300 text-gray-900">{rental.monthlyRent.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right border border-gray-300 text-gray-900">{rental.maintenanceFee.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right border border-gray-300 text-gray-900">{rental.parkingFee.toLocaleString()}</td>
                                    <td className="px-3 py-2 border border-gray-300 text-xs text-gray-900">{rental.remarks}</td>
                                    <td className="px-3 py-2 text-center border border-gray-300">
                                        <button
                                            onClick={() => handleEdit(rental)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                                        >
                                            수정
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && currentRental && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center overflow-y-auto z-50">
                    <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full my-8">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">{isEditMode ? '임대 정보 수정' : '임대 정보 추가'}</h2>
                        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">호실 *</label>
                                <select
                                    name="ho"
                                    value={currentRental.ho}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                                >
                                    <option value="">선택하세요</option>
                                    {AVAILABLE_ROOMS.map(room => (
                                        <option key={room} value={room}>{room}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">면적</label>
                                <input
                                    type="text"
                                    name="area"
                                    value={currentRental.area}
                                    readOnly
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">구분 *</label>
                                <select
                                    name="type"
                                    value={currentRental.type}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                                >
                                    <option value="">선택하세요</option>
                                    <option value="직원">직원</option>
                                    <option value="일반인">일반인</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">임대형태 *</label>
                                <select
                                    name="rentalType"
                                    value={currentRental.rentalType}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                                >
                                    <option value="">선택하세요</option>
                                    <option value="월세">월세</option>
                                    <option value="전세">전세</option>
                                    <option value="반전세">반전세</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">임대인(상호/성명) *</label>
                                <input
                                    type="text"
                                    name="tenantName"
                                    value={currentRental.tenantName}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">연락처</label>
                                <input
                                    type="text"
                                    name="contact"
                                    value={currentRental.contact}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={currentRental.email}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">계약시작일 *</label>
                                <input
                                    type="date"
                                    name="contractStartDate"
                                    value={currentRental.contractStartDate}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">계약종료일 *</label>
                                <input
                                    type="date"
                                    name="contractEndDate"
                                    value={currentRental.contractEndDate}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">입금날짜</label>
                                <input
                                    type="date"
                                    name="paymentDate"
                                    value={currentRental.paymentDate}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">보증금</label>
                                <input
                                    type="number"
                                    name="deposit"
                                    value={currentRental.deposit}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">월임대료</label>
                                <input
                                    type="number"
                                    name="monthlyRent"
                                    value={currentRental.monthlyRent}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">월관리비</label>
                                <input
                                    type="number"
                                    name="maintenanceFee"
                                    value={currentRental.maintenanceFee}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">주차비</label>
                                <input
                                    type="number"
                                    name="parkingFee"
                                    value={currentRental.parkingFee}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">비고</label>
                                <input
                                    type="text"
                                    name="remarks"
                                    value={currentRental.remarks}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                                />
                            </div>

                            <div className="col-span-2 flex justify-end space-x-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
