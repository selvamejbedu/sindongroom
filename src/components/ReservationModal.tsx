import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Repeat,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  AlternativeSlot,
  AppUser,
  ConflictItem,
  PeriodInfo,
  Reservation,
  ROOM_COLOR_PALETTE,
  SpecialRoom,
} from '../types';
import {
  addDays,
  evaluateReservationConflicts,
  expandReservationDates,
  formatKoreanDate,
  formatPeriodLabel,
  formatPeriodRangeLabel,
  getPeriodsInRange,
  getTodayStr,
  PERIOD_ORDER,
  validateReservationOnServer,
} from '../utils/dateAndConflict';
import {
  cancelReservationAtomic,
  createReservationsAtomic,
  updateReservationAtomic,
} from '../services/firestoreService';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'detail' | 'edit';
  initialDate?: string;
  initialPeriod?: number;
  initialRoomId?: string;
  initialRecurrence?: 'none' | 'daily' | 'weekly' | 'period_weekday';
  selectedReservation?: Reservation | null;
  rooms: SpecialRoom[];
  reservations: Reservation[];
  periods: PeriodInfo[];
  currentUser?: AppUser | null;
  onSuccessMessage: (msg: string) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  initialDate,
  initialPeriod,
  initialRoomId,
  initialRecurrence = 'none',
  selectedReservation,
  rooms,
  reservations,
  periods,
  currentUser,
  onSuccessMessage,
}) => {
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const [viewMode, setViewMode] = useState<'create' | 'detail' | 'edit'>(initialMode);

  const [roomId, setRoomId] = useState<string>('');
  const [teacherName, setTeacherName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getTodayStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [startPeriod, setStartPeriod] = useState<number>(1);
  const [endPeriod, setEndPeriod] = useState<number>(1);
  const [recurrenceType, setRecurrenceType] = useState<
    'none' | 'daily' | 'weekly' | 'period_weekday'
  >('none');
  const [weeklyCount, setWeeklyCount] = useState<number>(4);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1]);
  const [classLabel, setClassLabel] = useState<string>('5학년 2반');
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setViewMode(initialMode);
    setErrorText('');
    setShowCancelConfirm(false);

    if ((initialMode === 'detail' || initialMode === 'edit') && selectedReservation) {
      setTeacherName(selectedReservation.userName || '');
      setRoomId(selectedReservation.roomId);
      setStartDate(selectedReservation.date);
      setEndDate(selectedReservation.date);
      setStartPeriod(selectedReservation.startPeriod);
      setEndPeriod(selectedReservation.endPeriod);
      setRecurrenceType('none');
      setClassLabel(selectedReservation.classLabel || '5학년 2반');
    } else {
      const defaultRoom =
        activeRooms.find((r) => r.id === initialRoomId)?.id || activeRooms[0]?.id || '';
      const d = initialDate || getTodayStr();
      const p = initialPeriod || 2;
      // Do not auto-populate user ID or email to protect privacy
      let defaultName = '';
      const savedTeacherName = localStorage.getItem('sindong_teacher_name');
      const emailPrefix = currentUser?.email ? currentUser.email.split('@')[0].toLowerCase() : '';
      if (savedTeacherName && savedTeacherName.trim()) {
        const savedClean = savedTeacherName.trim();
        if (
          !savedClean.includes('@') &&
          savedClean.toLowerCase() !== emailPrefix &&
          !savedClean.includes('admin_') &&
          savedClean !== 'admin'
        ) {
          defaultName = savedClean;
        }
      } else if (
        currentUser?.displayName &&
        !currentUser.displayName.includes('@') &&
        currentUser.displayName.toLowerCase() !== emailPrefix &&
        currentUser.displayName !== '신동초 선생님' &&
        currentUser.displayName !== '신동초 교직원'
      ) {
        defaultName = currentUser.displayName;
      }
      setTeacherName(defaultName);
      setRoomId(defaultRoom);
      setStartDate(d);
      setEndDate(d);
      setStartPeriod(p);
      setEndPeriod(p);
      setRecurrenceType(initialRecurrence);
      setWeeklyCount(4);
      const startDow = new Date(d).getDay();
      setSelectedWeekdays(startDow >= 1 && startDow <= 5 ? [startDow] : [1]);
      setClassLabel(localStorage.getItem('sindong_class_label') || '5학년 2반');
    }
  }, [
    isOpen,
    initialMode,
    selectedReservation,
    initialDate,
    initialPeriod,
    initialRoomId,
    initialRecurrence,
    activeRooms,
    currentUser,
  ]);

  const targetDates = useMemo(() => {
    if (viewMode === 'edit') return [startDate];
    return expandReservationDates(
      startDate,
      endDate,
      recurrenceType,
      weeklyCount,
      selectedWeekdays
    );
  }, [viewMode, startDate, endDate, recurrenceType, weeklyCount, selectedWeekdays]);

  const effectiveEndPeriod = useMemo(() => {
    const sIdx = PERIOD_ORDER.indexOf(startPeriod as (typeof PERIOD_ORDER)[number]);
    const eIdx = PERIOD_ORDER.indexOf(endPeriod as (typeof PERIOD_ORDER)[number]);
    if (sIdx === -1 || eIdx === -1) return endPeriod;
    return eIdx >= sIdx ? endPeriod : startPeriod;
  }, [startPeriod, endPeriod]);

  const validation = useMemo(() => {
    if (!roomId || targetDates.length === 0) {
      return { valid: false, conflicts: [] as ConflictItem[], alternatives: [] as AlternativeSlot[] };
    }
    return evaluateReservationConflicts({
      roomId,
      dates: targetDates,
      startPeriod,
      endPeriod: effectiveEndPeriod,
      excludeReservationId: viewMode === 'edit' && selectedReservation ? selectedReservation.id : '',
      rooms,
      reservations,
      periods,
    });
  }, [roomId, targetDates, startPeriod, effectiveEndPeriod, viewMode, selectedReservation, rooms, reservations, periods]);

  if (!isOpen) return null;

  const selectedRoomObj = rooms.find((r) => r.id === roomId);

  const handleApplyAlternative = (alt: AlternativeSlot) => {
    setRoomId(alt.roomId);
    setStartDate(alt.date);
    setEndDate(alt.date);
    setStartPeriod(alt.startPeriod);
    setEndPeriod(alt.endPeriod);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (!selectedRoomObj) {
      setErrorText('특별실을 선택해 주세요.');
      return;
    }

    if (!classLabel.trim()) {
      setErrorText('학급 및 예약 대상을 입력해 주세요.');
      return;
    }

    try {
      localStorage.setItem('sindong_class_label', classLabel.trim());
    } catch {}

    const finalEndPeriod = effectiveEndPeriod;
    setSubmitting(true);

    try {
      const serverCheck = await validateReservationOnServer({
        roomId,
        dates: targetDates,
        startPeriod,
        endPeriod: finalEndPeriod,
        excludeReservationId:
          viewMode === 'edit' && selectedReservation ? selectedReservation.id : '',
        rooms,
        reservations,
      });

      if (!serverCheck.valid) {
        const firstConflict = serverCheck.conflicts[0];
        setErrorText(
          `예약 충돌: ${firstConflict.date} ${formatPeriodLabel(firstConflict.period, periods)} (${firstConflict.reason})`
        );
        setSubmitting(false);
        return;
      }

      const finalClassLabel = classLabel.trim();

      if (viewMode === 'edit' && selectedReservation) {
        await updateReservationAtomic({
          existing: selectedReservation,
          room: selectedRoomObj,
          date: startDate,
          startPeriod,
          endPeriod: finalEndPeriod,
          userName: teacherName.trim() || selectedReservation.userName || '교직원',
          grade: 0,
          classNum: 0,
          classLabel: finalClassLabel,
        });
        onSuccessMessage(`${selectedRoomObj.name} 예약이 수정되었습니다.`);
        onClose();
      } else {
        const selectedDayNames = selectedWeekdays
          .slice()
          .sort((a, b) => a - b)
          .map((w) => ['일', '월', '화', '수', '목', '금', '토'][w])
          .join(', ');

        const recSummary =
          recurrenceType === 'period_weekday'
            ? `기간 반복 (${targetDates.length}회 · ${startDate} ~ ${endDate} · ${selectedDayNames})`
            : recurrenceType === 'weekly'
            ? `매주 반복 (${targetDates.length}주 · ${targetDates[0]} ~ ${
                targetDates[targetDates.length - 1]
              })`
            : targetDates.length > 1
            ? `연속 일자 (${targetDates[0]} ~ ${targetDates[targetDates.length - 1]})`
            : '';

        const created = await createReservationsAtomic({
          room: selectedRoomObj,
          dates: targetDates,
          startPeriod,
          endPeriod: finalEndPeriod,
          userName: teacherName.trim() || '교직원',
          userId: currentUser?.uid,
          userEmail: currentUser?.email || undefined,
          grade: 0,
          classNum: 0,
          classLabel: finalClassLabel,
          recurrenceSummary: recSummary,
          source: initialPeriod ? 'timetable' : 'manual',
        });
        onSuccessMessage(
          `${selectedRoomObj.name} 예약이 완료되었습니다 (${created.length}건 등록됨).`
        );
        onClose();
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '예약 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!selectedReservation) return;
    setSubmitting(true);
    setErrorText('');
    try {
      await cancelReservationAtomic(selectedReservation);
      onSuccessMessage(`${selectedReservation.roomName} 예약이 취소되었습니다.`);
      onClose();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '예약 취소 오류');
    } finally {
      setSubmitting(false);
    }
  };

  // Detail Mode
  if (viewMode === 'detail' && selectedReservation) {
    const colorStyle =
      ROOM_COLOR_PALETTE[selectedReservation.roomColor] || ROOM_COLOR_PALETTE.purple;
    const periodText = formatPeriodRangeLabel(
      selectedReservation.startPeriod,
      selectedReservation.endPeriod,
      periods,
      true
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${colorStyle.badgeBg}`} />
              <h3 className="text-base font-bold text-[#252B36]">특별실 예약 상세</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#8A91A0] hover:text-[#252B36] hover:bg-[#F7F8FC]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className={`p-4 rounded-xl border ${colorStyle.bg} ${colorStyle.border}`}>
              <div className="text-xs font-semibold text-[#8055E8]">
                {selectedReservation.roomCategory}
              </div>
              <div className="text-xl font-bold text-[#252B36] mt-0.5">
                {selectedReservation.roomName}
              </div>
              <div className="text-xs text-[#252B36]/80 mt-1">
                {formatKoreanDate(selectedReservation.date)} · {periodText}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <div className="text-[#8A91A0] mb-0.5">학급 / 예약 대상</div>
                <div className="text-sm font-bold text-[#252B36]">
                  {selectedReservation.classLabel}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <div className="text-[#8A91A0] mb-0.5">예약 교사</div>
                <div className="text-sm font-bold text-[#252B36] truncate">
                  {selectedReservation.userName || '교직원'}
                </div>
              </div>
            </div>

            {selectedReservation.recurrenceSummary && (
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                <span className="text-[#8A91A0]">반복 구분:</span>{' '}
                <span className="font-semibold text-[#8055E8]">
                  {selectedReservation.recurrenceSummary}
                </span>
              </div>
            )}

            {showCancelConfirm && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs space-y-2">
                <div className="font-bold text-red-800">
                  이 예약을 취소하시겠습니까? 해당 시간표 교시가 즉시 비워집니다.
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-3 py-1 bg-white border border-red-200 rounded-lg text-[#252B36]"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCancelReservation}
                    className="px-3 py-1 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
                  >
                    {submitting ? '취소 중...' : '예약 취소 확인'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#252B36] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50"
            >
              닫기
            </button>

            {selectedReservation.status === 'confirmed' && (
              <div className="flex items-center gap-2">
                {!showCancelConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  수정
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Create / Edit Form Mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden my-auto shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-base font-bold text-[#252B36]">
              {viewMode === 'edit' ? '특별실 예약 수정' : '특별실 예약 등록'}
            </h3>
            <p className="text-xs text-[#8A91A0] mt-0.5">
              로그인 없이 교사 성명과 학급을 입력하여 간편하게 예약합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A91A0] hover:text-[#252B36] hover:bg-[#F7F8FC]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
              특별실 선택 *
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#8055E8]"
            >
              {activeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.floor} · {r.category})
                </option>
              ))}
            </select>
          </div>

          {/* Teacher and Class Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                <User className="w-3.5 h-3.5 inline mr-1 text-[#8055E8]" />
                예약 교사 성명 *
              </label>
              <input
                type="text"
                required
                value={teacherName}
                onChange={(e) => {
                  setTeacherName(e.target.value);
                  try {
                    localStorage.setItem('sindong_teacher_name', e.target.value);
                  } catch {}
                }}
                placeholder="예: 김민수 선생님"
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#8055E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                <Users className="w-3.5 h-3.5 inline mr-1 text-[#8055E8]" />
                학급 및 예약 대상 *
              </label>
              <input
                type="text"
                required
                value={classLabel}
                onChange={(e) => {
                  setClassLabel(e.target.value);
                  try {
                    localStorage.setItem('sindong_class_label', e.target.value);
                  } catch {}
                }}
                placeholder="예: 5학년 2반, 과학동아리"
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#8055E8]"
              />
            </div>
          </div>

          {/* Recurrence Selection in Create Mode */}
          {viewMode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                예약 방식
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                {(
                  [
                    { id: 'none', label: '단일 일자' },
                    { id: 'daily', label: '연속 일자' },
                    { id: 'weekly', label: '매주 반복' },
                    { id: 'period_weekday', label: '기간 반복' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setRecurrenceType(tab.id);
                      if (tab.id === 'period_weekday' && endDate <= startDate) {
                        setEndDate(addDays(startDate, 28));
                      }
                    }}
                    className={`py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      recurrenceType === tab.id
                        ? 'bg-white text-[#8055E8] font-bold shadow-xs'
                        : 'text-[#8A91A0] hover:text-[#252B36]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-[#8055E8]" />
                {recurrenceType === 'weekly'
                  ? '첫 시작일 *'
                  : recurrenceType === 'period_weekday' || recurrenceType === 'daily'
                  ? '시작 일자 *'
                  : '예약 날짜 *'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setStartDate(newStart);
                  if (endDate < newStart || viewMode === 'edit') {
                    setEndDate(newStart);
                  }
                }}
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl tabular-nums focus:outline-none focus:border-[#8055E8]"
              />
            </div>

            {viewMode === 'create' && recurrenceType === 'weekly' ? (
              <div>
                <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                  <Repeat className="w-3.5 h-3.5 inline mr-1 text-[#8055E8]" />
                  반복 횟수 (주간)
                </label>
                <select
                  value={weeklyCount}
                  onChange={(e) => setWeeklyCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl tabular-nums"
                >
                  {[2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((w) => (
                    <option key={w} value={w}>
                      {w}주 연속 같은 요일
                    </option>
                  ))}
                </select>
              </div>
            ) : viewMode === 'create' &&
              (recurrenceType === 'daily' || recurrenceType === 'period_weekday') ? (
              <div>
                <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                  종료 일자 *
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl tabular-nums focus:outline-none focus:border-[#8055E8]"
                />
              </div>
            ) : null}
          </div>

          {/* Period Weekday Selector UI when recurrenceType is period_weekday */}
          {viewMode === 'create' && recurrenceType === 'period_weekday' && (
            <div className="space-y-2 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#252B36]">
                  반복 요일 선택 (중복 가능) *
                </label>
                <span className="text-[11px] text-[#8055E8] font-bold">
                  {selectedWeekdays.length}개 요일 선택됨
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { dow: 1, label: '월요일' },
                  { dow: 2, label: '화요일' },
                  { dow: 3, label: '수요일' },
                  { dow: 4, label: '목요일' },
                  { dow: 5, label: '금요일' },
                ].map((day) => {
                  const isSelected = selectedWeekdays.includes(day.dow);
                  return (
                    <button
                      key={day.dow}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          if (selectedWeekdays.length > 1) {
                            setSelectedWeekdays(selectedWeekdays.filter((d) => d !== day.dow));
                          }
                        } else {
                          setSelectedWeekdays([...selectedWeekdays, day.dow].sort((a, b) => a - b));
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#8055E8] text-white shadow-xs'
                          : 'bg-white text-[#8A91A0] border border-[#E2E8F0] hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Period Range */}
          {(() => {
            const periodOrder = [1, 2, 3, 4, 7, 5, 6];
            const sIdx = periodOrder.indexOf(startPeriod);
            const eIdx = periodOrder.indexOf(endPeriod);
            const effectiveEnd = eIdx >= sIdx ? endPeriod : startPeriod;

            return (
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                    <Clock className="w-3.5 h-3.5 inline mr-1 text-[#8055E8]" />
                    시작 교시 *
                  </label>
                  <select
                    value={startPeriod}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStartPeriod(val);
                      const newSIdx = periodOrder.indexOf(val);
                      const curEIdx = periodOrder.indexOf(endPeriod);
                      if (curEIdx < newSIdx) setEndPeriod(val);
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl tabular-nums"
                  >
                    {periods.map((p) => (
                      <option key={p.period} value={p.period}>
                        {p.label} ({p.startTime}~{p.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252B36] mb-1.5">
                    종료 교시 *
                  </label>
                  <select
                    value={effectiveEnd}
                    onChange={(e) => setEndPeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-xl tabular-nums"
                  >
                    {periods
                      .filter((p) => periodOrder.indexOf(p.period) >= sIdx)
                      .map((p) => (
                        <option key={p.period} value={p.period}>
                          {p.label} ({p.startTime}~{p.endTime})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            );
          })()}

          {/* Real-time Conflict Box */}
          <div
            className={`p-3.5 rounded-xl border text-xs ${
              validation.valid
                ? 'bg-[#EDFCF2] border-[#C0F0D1] text-[#157347]'
                : 'bg-[#FFF0F3] border-[#FECDD6] text-[#BE123C]'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {validation.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    예약 가능 ({targetDates.length}일 · 총{' '}
                    {targetDates.length * getPeriodsInRange(startPeriod, effectiveEndPeriod).length}회/시간)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    시간 중복 발생 ({validation.conflicts.length}건)
                  </>
                )}
              </span>
              <span className="tabular-nums font-mono-tabular">
                {targetDates[0]}
                {targetDates.length > 1 ? ` ~ ${targetDates[targetDates.length - 1]}` : ''}
              </span>
            </div>

            {!validation.valid && (
              <div className="mt-2 space-y-1.5">
                {validation.conflicts.slice(0, 3).map((c, i) => (
                  <div key={i} className="text-xs">
                    • {c.date} ({formatPeriodLabel(c.period, periods)}): {c.reason}
                  </div>
                ))}
                {validation.alternatives.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-[#FECDD6]">
                    <div className="font-bold text-[#252B36] mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#8055E8]" />
                      비어 있는 다른 교시·특별실 (클릭 시 자동 선택):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {validation.alternatives.map((alt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyAlternative(alt)}
                          className="px-2.5 py-1 text-xs font-semibold bg-white text-[#5932EA] border border-[#D9C8FF] rounded-lg hover:bg-[#F3EEFF]"
                        >
                          {alt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {errorText && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {errorText}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#252B36] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !validation.valid}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6] disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting
                ? '저장 중...'
                : viewMode === 'edit'
                ? '수정 완료'
                : '예약 확정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
