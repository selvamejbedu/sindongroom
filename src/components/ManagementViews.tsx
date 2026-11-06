import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  Megaphone,
  Plus,
  Repeat,
  Search,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Announcement,
  AppUser,
  AuditLog,
  PeriodInfo,
  Reservation,
  ROOM_COLOR_PALETTE,
  RoomColorKey,
  SchoolSettings,
  SpecialRoom,
} from '../types';
import {
  formatPeriodRangeLabel,
  getMonthCalendarGrid,
  getTodayStr,
  getWeekDays,
  KOR_WEEKDAYS,
} from '../utils/dateAndConflict';
import {
  bootstrapInitialSchoolData,
  clearAuditLogs,
  createAnnouncement,
  deleteAnnouncement,
  deleteReservationsByIds,
  deleteReservationsByRange,
  deleteSpecialRoom,
  resetInitialSampleData,
  saveSchoolSettings,
  saveSpecialRoom,
} from '../services/firestoreService';

// ============================================================================
// 1. Monthly Calendar View (예약 달력 - 월간 달력 보기)
// ============================================================================
export const MonthlyCalendarView: React.FC<{
  referenceDate: string;
  onSelectDateToTimetable: (dateStr: string) => void;
  reservations: Reservation[];
  rooms?: SpecialRoom[];
  selectedRoomFilter?: string;
  onChangeRoomFilter?: (roomId: string) => void;
  onSwitchViewMode?: (mode: 'day' | 'week') => void;
  periods?: PeriodInfo[];
  onClickReservation: (r: Reservation) => void;
}> = ({
  referenceDate,
  onSelectDateToTimetable,
  reservations,
  rooms = [],
  selectedRoomFilter = 'all',
  onChangeRoomFilter,
  onSwitchViewMode,
  periods,
  onClickReservation,
}) => {
  const initialParts = referenceDate.split('-').map(Number);
  const [year, setYear] = useState<number>(initialParts[0] || 2026);
  const [month, setMonth] = useState<number>(initialParts[1] || 10);
  const [internalRoomFilter, setInternalRoomFilter] = useState<string>('all');

  const activeRoomFilter = onChangeRoomFilter ? selectedRoomFilter : internalRoomFilter;
  const setRoomFilter = (val: string) => {
    if (onChangeRoomFilter) {
      onChangeRoomFilter(val);
    } else {
      setInternalRoomFilter(val);
    }
  };

  const cells = useMemo(() => getMonthCalendarGrid(year, month), [year, month]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#CBD5E1] dark:border-[#243048] shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#CBD5E1] dark:border-[#243048]">
        <div>
          <h2 className="text-base font-bold text-[#252B36] dark:text-[#F8FAFC]">월간 특별실 예약 달력</h2>
          <p className="text-xs text-[#8A91A0] dark:text-[#94A3B8] mt-0.5">
            전체보기 또는 특별실별 필터를 선택해 예약 분포를 확인하고, 날짜 클릭 시 해당 일자 시간표로 이동합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-[#CBD5E1] dark:border-[#2E3E5B] hover:bg-[#F7F8FC] dark:hover:bg-[#1A2234] text-[#252B36] dark:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-bold text-[#252B36] dark:text-[#F8FAFC] tabular-nums">
              {year}년 {month}월
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-[#CBD5E1] dark:border-[#2E3E5B] hover:bg-[#F7F8FC] dark:hover:bg-[#1A2234] text-[#252B36] dark:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const t = getTodayStr().split('-').map(Number);
                setYear(t[0]);
                setMonth(t[1]);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-[#8055E8] dark:text-purple-300 bg-[#F3EEFF] dark:bg-purple-950/50 border border-[#D9C8FF] dark:border-purple-700/50 rounded-xl hover:bg-[#e8deff] dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
            >
              오늘이 속한 달
            </button>
          </div>

          {onSwitchViewMode && (
            <div className="flex items-center p-0.5 bg-[#F4F6F8] dark:bg-[#161F32] border border-[#CBD5E1] dark:border-[#243048] rounded-full text-xs font-bold">
              <button
                type="button"
                onClick={() => onSwitchViewMode('day')}
                className="px-3 py-1 rounded-full text-[#667085] dark:text-[#94A3B8] hover:text-[#1E232A] dark:hover:text-white transition-all cursor-pointer border border-transparent"
              >
                일간 보기
              </button>
              <button
                type="button"
                onClick={() => onSwitchViewMode('week')}
                className="px-3 py-1 rounded-full text-[#667085] dark:text-[#94A3B8] hover:text-[#1E232A] dark:hover:text-white transition-all cursor-pointer border border-transparent"
              >
                주간 보기
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded-full bg-white dark:bg-[#2563EB] text-[#1E232A] dark:text-white shadow-xs border border-[#CBD5E1] dark:border-transparent cursor-pointer"
              >
                월간 보기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Special Room Filter Bar (전체보기 기본 + 특별실별 필터링) */}
      {activeRooms.length > 0 && (
        <div className="px-6 py-3 bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E9EBF1] dark:border-[#243048] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-[#475467] dark:text-[#94A3B8] mr-1.5">특별실 필터:</span>
            <button
              type="button"
              onClick={() => setRoomFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeRoomFilter === 'all'
                  ? 'bg-[#1E232A] text-white shadow-xs border border-[#1E232A] dark:bg-[#2563EB] dark:border-[#2563EB]'
                  : 'bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] text-[#475467] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-[#222D42]'
              }`}
            >
              전체보기
            </button>
            {activeRooms.map((room) => {
              const c = ROOM_COLOR_PALETTE[room.colorKey] || ROOM_COLOR_PALETTE.purple;
              const isSelected = activeRoomFilter === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setRoomFilter(room.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? `${c.bg} ${c.border} ${c.text} shadow-xs font-extrabold border-2`
                      : 'bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] text-[#475467] dark:text-[#94A3B8] hover:bg-gray-50 dark:hover:bg-[#222D42]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.badgeBg}`} />
                  {room.name}
                </button>
              );
            })}
          </div>

          {activeRoomFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setRoomFilter('all')}
              className="text-xs font-semibold text-[#667085] hover:text-[#1E232A] underline cursor-pointer"
            >
              전체보기로 초기화
            </button>
          )}
        </div>
      )}

      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-[#CBD5E1] dark:border-[#243048] bg-[#F7F8FC] dark:bg-[#161F32]">
        {KOR_WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`py-2.5 text-center text-xs font-semibold ${
              idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-600' : 'text-[#8A91A0] dark:text-[#94A3B8]'
            }`}
          >
            {day}요일
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-[#CBD5E1] dark:divide-[#243048]">
        {cells.map((cell) => {
          const dayRes = reservations.filter(
            (r) =>
              r.status === 'confirmed' &&
              r.date === cell.date &&
              (activeRoomFilter === 'all' || r.roomId === activeRoomFilter)
          );

          return (
            <div
              key={cell.date}
              onClick={() => onSelectDateToTimetable(cell.date)}
              className={`min-h-[116px] p-2 sm:p-2.5 transition-colors cursor-pointer hover:bg-[#F7F8FC] dark:hover:bg-[#1A2234] calendar-day-cell ${
                !cell.isCurrentMonth ? 'bg-gray-50/50 dark:bg-[#0B0F17]/50 opacity-40' : 'bg-white dark:bg-[#111827]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-lg tabular-nums ${
                    cell.isToday
                      ? 'bg-[#8055E8] text-white shadow-xs'
                      : cell.isWeekend
                      ? 'text-[#8A91A0]'
                      : 'text-[#252B36]'
                  }`}
                >
                  {cell.dayNumber}
                </span>
                {dayRes.length > 0 && (
                  <span className="text-[11px] font-bold text-[#8055E8] tabular-nums">
                    {dayRes.length}건
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayRes.slice(0, 3).map((r) => {
                  const c = ROOM_COLOR_PALETTE[r.roomColor] || ROOM_COLOR_PALETTE.purple;
                  const periodLabel = formatPeriodRangeLabel(r.startPeriod, r.endPeriod, periods, false);
                  return (
                    <div
                      key={r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClickReservation(r);
                      }}
                      title={`${r.roomName} · ${periodLabel} (${r.classLabel})`}
                      className={`px-1.5 py-1 rounded-lg border font-medium calendar-day-badge shadow-2xs hover:opacity-90 transition-all ${c.bg} ${c.border} ${c.text}`}
                    >
                      <div className="flex items-center justify-between gap-1 leading-tight">
                        <span className="font-bold truncate">{r.roomName}</span>
                        <span className="shrink-0 opacity-85 tabular-nums text-[0.9em]">
                          {periodLabel}
                        </span>
                      </div>
                      <div className="text-[0.92em] opacity-90 truncate leading-tight mt-0.5">
                        {r.classLabel}
                      </div>
                    </div>
                  );
                })}
                {dayRes.length > 3 && (
                  <div className="calendar-day-badge text-[#8A91A0] pl-1 font-semibold tabular-nums">
                    + {dayRes.length - 3}건 더보기
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 2. Reservation List View (전체 예약 목록 / 반복 예약)
// ============================================================================
export const ReservationListView: React.FC<{
  mode: 'all' | 'recurring' | 'my';
  reservations: Reservation[];
  rooms: SpecialRoom[];
  periods?: PeriodInfo[];
  initialSearch?: string;
  currentUser?: AppUser | null;
  onLogin?: () => void;
  onOpenNewModal: (recurring?: boolean) => void;
  onSelectReservation: (r: Reservation) => void;
  onSuccessMessage?: (msg: string) => void;
}> = ({
  mode,
  reservations,
  rooms,
  periods,
  initialSearch = '',
  currentUser,
  onLogin,
  onOpenNewModal,
  onSelectReservation,
  onSuccessMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Selected reservation IDs for selective deletion
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSelectDeleteModal, setShowSelectDeleteModal] = useState<boolean>(false);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');

  // Bulk Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [delType, setDelType] = useState<'sample' | 'before' | 'range' | 'all'>('sample');
  const [delBeforeDate, setDelBeforeDate] = useState<string>(getTodayStr());
  const [delStartDate, setDelStartDate] = useState<string>(getTodayStr());
  const [delEndDate, setDelEndDate] = useState<string>(getTodayStr());
  const [deleting, setDeleting] = useState<boolean>(false);

  const filtered = useMemo(() => {
    return reservations
      .filter((r) => {
        if (mode === 'recurring' && !r.seriesId && !r.recurrenceSummary) return false;
        if (mode === 'my') {
          if (!currentUser) return false;
          const isVisitorAdmin = currentUser.uid === 'sindong_admin_default';
          if (!isVisitorAdmin) {
            const isMine =
              (r.userId && r.userId === currentUser.uid) ||
              (r.userEmail && r.userEmail.toLowerCase() === (currentUser.email || '').toLowerCase()) ||
              (r.userName && currentUser.displayName && r.userName.trim() === currentUser.displayName.trim());
            if (!isMine) return false;
          }
        }
        if (selectedRoomFilter !== 'all' && r.roomId !== selectedRoomFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (dateFilter && r.date !== dateFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            r.roomName.toLowerCase().includes(q) ||
            r.userName.toLowerCase().includes(q) ||
            r.classLabel.toLowerCase().includes(q) ||
            r.date.includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.startPeriod - b.startPeriod;
      });
  }, [reservations, mode, selectedRoomFilter, statusFilter, dateFilter, searchQuery, currentUser]);

  // Keep selectedIds synced with existing reservations
  useEffect(() => {
    const existingIds = new Set(reservations.map((r) => r.id));
    setSelectedIds((prev) => prev.filter((id) => existingIds.has(id)));
  }, [reservations]);

  const modalFilteredReservations = useMemo(() => {
    if (!modalSearchQuery.trim()) return filtered;
    const q = modalSearchQuery.trim().toLowerCase();
    return filtered.filter(
      (r) =>
        r.roomName.toLowerCase().includes(q) ||
        r.classLabel.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        (r.recurrenceSummary && r.recurrenceSummary.toLowerCase().includes(q))
    );
  }, [filtered, modalSearchQuery]);

  const isAllFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.includes(r.id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filtered.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filtered.map((r) => r.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const toggleSelectAllModalFiltered = () => {
    const allModalSelected =
      modalFilteredReservations.length > 0 &&
      modalFilteredReservations.every((r) => selectedIds.includes(r.id));
    if (allModalSelected) {
      const modalIdSet = new Set(modalFilteredReservations.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !modalIdSet.has(id)));
    } else {
      const combined = new Set([
        ...selectedIds,
        ...modalFilteredReservations.map((r) => r.id),
      ]);
      setSelectedIds(Array.from(combined));
    }
  };

  const handleExecuteSelectedDelete = async () => {
    const targetList = reservations.filter((r) => selectedIds.includes(r.id));
    if (targetList.length === 0) return;
    setDeleting(true);
    try {
      const count = await deleteReservationsByIds(targetList);
      onSuccessMessage?.(
        `선택 삭제 완료: 선택한 ${count}건의 예약이 삭제되었습니다.`
      );
      setSelectedIds([]);
      setShowSelectDeleteModal(false);
    } catch (err) {
      onSuccessMessage?.('선택 예약 삭제 도중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExecuteBulkDelete = async () => {
    setDeleting(true);
    try {
      let count = 0;
      if (delType === 'sample') {
        const res = await resetInitialSampleData(false);
        count = res.resDeleted;
      } else if (delType === 'all') {
        count = await deleteReservationsByRange({ deleteAll: true });
      } else if (delType === 'before') {
        count = await deleteReservationsByRange({ beforeDate: delBeforeDate });
      } else if (delType === 'range') {
        count = await deleteReservationsByRange({ startDate: delStartDate, endDate: delEndDate });
      }
      onSuccessMessage?.(`예약 기록 삭제 완료: 총 ${count}건의 예약이 서버에서 삭제되었습니다.`);
      setShowBulkDeleteModal(false);
    } catch (err) {
      onSuccessMessage?.('삭제 도중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const title =
    mode === 'recurring'
      ? '반복 및 연속 예약 목록'
      : mode === 'my'
      ? '내 예약 모아보기'
      : '전체 특별실 예약 목록';

  const teacherLabel = useMemo(() => {
    if (!currentUser) return '선생님';
    const name = currentUser.displayName?.trim() || '';
    const emailPrefix = currentUser.email ? currentUser.email.split('@')[0].toLowerCase() : '';
    if (name && !name.includes('@') && name.toLowerCase() !== emailPrefix && name !== 'admin') {
      return `${name} 선생님`;
    }
    return '선생님';
  }, [currentUser]);

  const isVisitorAdmin = currentUser?.uid === 'sindong_admin_default';
  const subtitle =
    mode === 'my'
      ? isVisitorAdmin
        ? '전원 관리자 권한: 전체 등록된 예약 현황을 실시간 확인하고 관리자 권한으로 수정 및 삭제할 수 있습니다.'
        : `${teacherLabel}의 특별실 예약 현황입니다.`
      : '예약 항목을 체크하여 선택 삭제하거나, 클릭하여 상세 내역 확인 및 수정을 진행합니다.';

  return (
    <div className="bg-white rounded-2xl border border-[#E9EBF1] shadow-xs overflow-hidden">
      {mode === 'my' && isVisitorAdmin && (
        <div className="px-6 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs font-semibold text-amber-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>전원 관리자 권한이 활성화되어 모든 예약의 확인·수정·일괄 삭제가 가능합니다.</span>
          </div>
          {onLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-amber-900 font-bold hover:bg-amber-100 cursor-pointer shadow-2xs shrink-0"
            >
              내 계정 연결하기
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#E9EBF1]">
        <div>
          <h2 className="text-base font-bold text-[#252B36]">{title}</h2>
          <p className="text-xs text-[#8A91A0] mt-0.5">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setModalSearchQuery('');
              setShowSelectDeleteModal(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors shadow-2xs cursor-pointer ${
              selectedIds.length > 0
                ? 'text-white bg-red-600 hover:bg-red-700'
                : 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {selectedIds.length > 0 ? `선택 삭제 (${selectedIds.length}건)` : '선택 삭제'}
          </button>
          <button
            type="button"
            onClick={() => setShowBulkDeleteModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#475467] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl hover:bg-gray-100 transition-colors shadow-2xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#667085]" />
            기간/전체 일괄 삭제
          </button>
          <button
            type="button"
            onClick={() => onOpenNewModal(mode === 'recurring')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6] transition-colors shadow-sm cursor-pointer"
          >
            {mode === 'recurring' ? <Repeat className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {mode === 'recurring' ? '새 반복 예약 등록' : '새 예약 등록'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-[#F7F8FC] border-b border-[#E9EBF1]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8A91A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="특별실, 학급, 날짜 검색..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl focus:outline-none focus:border-[#8055E8]"
          />
        </div>

        <select
          value={selectedRoomFilter}
          onChange={(e) => setSelectedRoomFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl focus:outline-none focus:border-[#8055E8]"
        >
          <option value="all">모든 특별실</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl focus:outline-none focus:border-[#8055E8] tabular-nums"
        />

        <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#161F32] rounded-xl border border-[#CBD5E1] dark:border-[#243048]">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'confirmed', label: '예약확정' },
              { id: 'cancelled', label: '취소내역' },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-[#F3EEFF] dark:bg-purple-950/60 text-[#8055E8] dark:text-purple-300 font-bold border border-[#D9C8FF]/60 dark:border-purple-700/50'
                  : 'text-[#8A91A0] dark:text-[#94A3B8] hover:text-[#252B36] dark:hover:text-white border border-transparent'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Selection Banner */}
      {selectedIds.length > 0 && (
        <div className="px-6 py-2.5 bg-red-50/80 border-b border-red-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-red-700">
              현재 {selectedIds.length}개의 예약이 선택되었습니다.
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[#667085] underline hover:text-[#252B36] cursor-pointer"
            >
              선택 해제
            </button>
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={handleExecuteSelectedDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? '삭제 중...' : `선택한 ${selectedIds.length}건 바로 삭제`}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E9EBF1] dark:border-[#243048] text-[11px] font-semibold text-[#8A91A0] dark:text-[#94A3B8] bg-[#F7F8FC]/60 dark:bg-[#161F32]">
              <th className="py-3 pl-5 pr-2 w-10">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  title="전체 선택/해제"
                  className="w-4 h-4 rounded border-[#CBD5E1] dark:border-[#475569] dark:bg-[#1E293B] text-[#8055E8] focus:ring-0 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4">예약 날짜</th>
              <th className="py-3 px-4">교시</th>
              <th className="py-3 px-4">특별실</th>
              <th className="py-3 px-4">예약 학급 / 대상</th>
              <th className="py-3 px-4">반복 정보</th>
              <th className="py-3 px-4">상태</th>
              <th className="py-3 px-4 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9EBF1] dark:divide-[#243048] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#8A91A0] dark:text-[#94A3B8]">
                  조건에 해당하는 특별실 예약 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const c = ROOM_COLOR_PALETTE[r.roomColor] || ROOM_COLOR_PALETTE.purple;
                const isChecked = selectedIds.includes(r.id);
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectReservation(r)}
                    className={`cursor-pointer transition-colors ${
                      isChecked ? 'bg-[#F3EEFF]/50 dark:bg-purple-950/40 hover:bg-[#F3EEFF]/80' : 'hover:bg-[#F7F8FC] dark:hover:bg-[#161F32]'
                    }`}
                  >
                    <td
                      className="py-3 pl-5 pr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(r.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-[#CBD5E1] dark:border-[#475569] dark:bg-[#1E293B] text-[#8055E8] focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#252B36] tabular-nums whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#8055E8] tabular-nums whitespace-nowrap">
                      {formatPeriodRangeLabel(r.startPeriod, r.endPeriod, periods, true)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 font-bold ${c.text}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${c.badgeBg}`} />
                        {r.roomName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#252B36] whitespace-nowrap">
                      <span className="font-bold">{r.classLabel}</span>
                    </td>
                    <td className="py-3 px-4 text-[#8A91A0] whitespace-nowrap">
                      {r.recurrenceSummary ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8055E8] bg-[#F3EEFF] px-2 py-0.5 rounded-md">
                          <Repeat className="w-3 h-3" />
                          {r.recurrenceSummary}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">단일 예약</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                          r.status === 'confirmed'
                            ? 'bg-[#EDFCF2] text-[#157347]'
                            : 'bg-gray-100 text-[#8A91A0] line-through'
                        }`}
                      >
                        {r.status === 'confirmed' ? '예약확정' : '취소완료'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReservation(r);
                        }}
                        className="px-3 py-1 text-xs font-semibold text-[#8055E8] hover:bg-[#F3EEFF] rounded-lg transition-colors"
                      >
                        상세 / 수정
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Select & Delete Modal (선택 삭제 모달) */}
      {showSelectDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-[#E9EBF1] shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9EBF1]">
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                <div>
                  <h3 className="text-base font-bold text-[#252B36]">
                    예약 선택 삭제 ({mode === 'recurring' ? '반복 예약 현황' : '전체 예약 목록'})
                  </h3>
                  <p className="text-[11px] text-[#8A91A0]">
                    삭제할 기존 예약 항목들을 체크한 뒤 하단의 [선택 항목 삭제 실행] 버튼을 눌러주세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSelectDeleteModal(false)}
                className="p-1.5 rounded-lg text-[#8A91A0] hover:text-[#252B36] hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Search & Select All Controls inside Modal */}
            <div className="px-6 py-3 bg-[#F7F8FC] border-b border-[#E9EBF1] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#252B36] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      modalFilteredReservations.length > 0 &&
                      modalFilteredReservations.every((r) => selectedIds.includes(r.id))
                    }
                    onChange={toggleSelectAllModalFiltered}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  목록 전체 선택 ({modalFilteredReservations.length}건)
                </label>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-[#667085] hover:text-[#252B36] underline cursor-pointer"
                  >
                    전체 선택 해제
                  </button>
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#8A91A0] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="특별실, 학급, 날짜로 빠른 필터..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E9EBF1] rounded-xl focus:outline-none focus:border-[#8055E8]"
                />
              </div>
            </div>

            {/* Scrollable Checklist of Existing Reservations */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E9EBF1] px-6">
              {modalFilteredReservations.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8A91A0]">
                  선택 가능한 예약 내역이 없습니다.
                </div>
              ) : (
                modalFilteredReservations.map((r) => {
                  const isChecked = selectedIds.includes(r.id);
                  const c = ROOM_COLOR_PALETTE[r.roomColor] || ROOM_COLOR_PALETTE.purple;
                  return (
                    <label
                      key={r.id}
                      className={`py-3 px-3 -mx-3 flex items-center justify-between gap-3 cursor-pointer rounded-xl transition-colors ${
                        isChecked ? 'bg-red-50/70' : 'hover:bg-[#F7F8FC]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(r.id)}
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-extrabold text-[#252B36] tabular-nums">
                              {r.date}
                            </span>
                            <span className="text-xs font-bold text-[#8055E8] tabular-nums">
                              {formatPeriodRangeLabel(r.startPeriod, r.endPeriod, periods, true)}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md ${c.bg} ${c.border} ${c.text}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${c.badgeBg}`} />
                              {r.roomName}
                            </span>
                            <span className="text-xs font-bold text-[#1E232A]">
                              {r.classLabel}
                            </span>
                          </div>
                          {r.recurrenceSummary && (
                            <div className="text-[11px] text-[#8A91A0] mt-0.5 flex items-center gap-1">
                              <Repeat className="w-3 h-3 text-[#8055E8]" />
                              {r.recurrenceSummary}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                          isChecked
                            ? 'bg-red-100 text-red-700 font-bold'
                            : 'bg-gray-100 text-[#667085]'
                        }`}
                      >
                        {isChecked ? '삭제 선택됨' : '미선택'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E9EBF1] bg-white flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-[#475467]">
                선택된 예약:{' '}
                <span className="font-extrabold text-red-600">{selectedIds.length}건</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSelectDeleteModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#252B36] bg-white border border-[#E9EBF1] rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={deleting || selectedIds.length === 0}
                  onClick={handleExecuteSelectedDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
                >
                  {deleting
                    ? '서버 삭제 진행 중...'
                    : `선택 항목 삭제 실행 (${selectedIds.length}건)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E9EBF1] shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EBF1]">
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#252B36]">기간/전체 예약 일괄 삭제</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-[#8A91A0] hover:text-[#252B36]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8A91A0] leading-relaxed">
              서버(Firestore)에 등록되어 있는 기존 예약 데이터 및 시간표 잠금을 조건별로 일괄 삭제합니다.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#252B36]">삭제 범위 선택</label>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 cursor-pointer hover:bg-amber-50">
                  <input
                    type="radio"
                    name="delType"
                    checked={delType === 'sample'}
                    onChange={() => setDelType('sample')}
                    className="text-amber-600"
                  />
                  <div>
                    <div className="font-bold text-amber-900">기본 예시 자료만 삭제 (demo_res_*)</div>
                    <div className="text-[11px] text-amber-700">
                      초기 설치 시 자동 생성된 예시 예약과 예시 공지사항만 삭제합니다.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9EBF1] cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="delType"
                    checked={delType === 'before'}
                    onChange={() => setDelType('before')}
                    className="text-[#8055E8]"
                  />
                  <div>
                    <div className="font-bold text-[#252B36]">특정 날짜 이전 내역 삭제</div>
                    <div className="text-[11px] text-[#8A91A0]">지난 날짜의 오래된 예약을 정리합니다.</div>
                  </div>
                </label>

                {delType === 'before' && (
                  <div className="pl-7 pr-2 pb-2">
                    <label className="block text-[11px] text-[#8A91A0] mb-1">
                      기준 날짜 이전 (해당 날짜 미포함 삭제)
                    </label>
                    <input
                      type="date"
                      value={delBeforeDate}
                      onChange={(e) => setDelBeforeDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#E9EBF1] rounded-lg tabular-nums"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9EBF1] cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="delType"
                    checked={delType === 'range'}
                    onChange={() => setDelType('range')}
                    className="text-[#8055E8]"
                  />
                  <div>
                    <div className="font-bold text-[#252B36]">특정 기간 예약 삭제</div>
                    <div className="text-[11px] text-[#8A91A0]">
                      지정한 시작일~종료일 사이의 예약을 삭제합니다.
                    </div>
                  </div>
                </label>

                {delType === 'range' && (
                  <div className="pl-7 pr-2 pb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#8A91A0] mb-1">시작일</label>
                      <input
                        type="date"
                        value={delStartDate}
                        onChange={(e) => setDelStartDate(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-[#E9EBF1] rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8A91A0] mb-1">종료일</label>
                      <input
                        type="date"
                        value={delEndDate}
                        onChange={(e) => setDelEndDate(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-[#E9EBF1] rounded-lg tabular-nums"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-red-200 bg-red-50/50 cursor-pointer hover:bg-red-50">
                  <input
                    type="radio"
                    name="delType"
                    checked={delType === 'all'}
                    onChange={() => setDelType('all')}
                    className="text-red-600"
                  />
                  <div>
                    <div className="font-bold text-red-700">전체 예약 일괄 삭제</div>
                    <div className="text-[11px] text-red-600">
                      등록된 모든 예약 및 시간표 잠금을 초기화합니다.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E9EBF1]">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-[#252B36] bg-white border border-[#E9EBF1] rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleExecuteBulkDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-xs"
              >
                {deleting ? '서버 삭제 진행 중...' : '선택 범위 삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. Special Room Directory & Management (특별실 목록 / 특별실 관리)
// ============================================================================
export const RoomDirectoryAndManageView: React.FC<{
  isManageMode: boolean;
  rooms: SpecialRoom[];
  reservations: Reservation[];
  periods: PeriodInfo[];
  referenceDate: string;
  onQuickReserveRoom: (roomId: string, date?: string, period?: number) => void;
  onSelectReservation: (r: Reservation) => void;
  onSuccessMessage: (msg: string) => void;
}> = ({
  isManageMode,
  rooms,
  reservations,
  periods,
  referenceDate,
  onQuickReserveRoom,
  onSelectReservation,
  onSuccessMessage,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '');
  const [editingRoom, setEditingRoom] = useState<Partial<SpecialRoom> | null>(null);
  const [isNewRoom, setIsNewRoom] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [roomToDelete, setRoomToDelete] = useState<SpecialRoom | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];
  const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);

  const handleConfirmDeleteRoom = async (target: SpecialRoom) => {
    setDeletingRoomId(target.id);
    try {
      await deleteSpecialRoom(target.id, target.name);
      if (editingRoom?.id === target.id) {
        setEditingRoom(null);
      }
      if (selectedRoomId === target.id) {
        const remaining = rooms.filter((r) => r.id !== target.id);
        setSelectedRoomId(remaining[0]?.id || '');
      }
      onSuccessMessage(`'${target.name}' 특별실이 삭제되었습니다.`);
      setRoomToDelete(null);
    } catch (err) {
      onSuccessMessage(err instanceof Error ? err.message : '특별실 삭제 실패');
    } finally {
      setDeletingRoomId(null);
    }
  };

  const startCreateNewRoom = () => {
    setIsNewRoom(true);
    setEditingRoom({
      id: `room_custom_${Date.now()}`,
      name: '',
      category: '과학',
      colorKey: 'purple',
      location: '본관 동편',
      floor: '2층',
      capacity: 30,
      availablePeriods: [1, 2, 3, 4, 7, 5, 6],
      equipment: '',
      managerName: '담당교사',
      guidelines: '',
      active: true,
    });
  };

  const startEditRoom = (room: SpecialRoom) => {
    setIsNewRoom(false);
    setEditingRoom({ ...room });
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editingRoom.name?.trim()) return;
    setSaving(true);
    try {
      await saveSpecialRoom({
        room: {
          id: editingRoom.id || `room_${Date.now()}`,
          name: editingRoom.name.trim(),
          category: editingRoom.category || '기타',
          colorKey: (editingRoom.colorKey || 'purple') as RoomColorKey,
          location: editingRoom.location || '본관',
          floor: editingRoom.floor || '2층',
          capacity: Number(editingRoom.capacity) || 30,
          availablePeriods: editingRoom.availablePeriods || [1, 2, 3, 4, 7, 5, 6],
          equipment: editingRoom.equipment || '',
          managerName: editingRoom.managerName || '담당교사',
          guidelines: editingRoom.guidelines || '',
          active: editingRoom.active !== false,
        },
        isNew: isNewRoom,
      });
      onSuccessMessage(
        `${editingRoom.name} 특별실 정보가 ${isNewRoom ? '등록' : '수정'}되었습니다.`
      );
      setEditingRoom(null);
    } catch (err) {
      onSuccessMessage(err instanceof Error ? err.message : '특별실 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#E9EBF1] p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E9EBF1]">
          <div>
            <h2 className="text-base font-bold text-[#252B36]">
              {isManageMode ? '특별실 등록 및 설정 관리' : '전주신동초 특별실 안내 및 시설 목록'}
            </h2>
            <p className="text-xs text-[#8A91A0] mt-0.5">
              각 특별실의 위치, 수용 정원, 보유 교구 비품, 담당 교사 정보를 확인하고 관리합니다.
            </p>
          </div>
          {isManageMode && (
            <button
              type="button"
              onClick={startCreateNewRoom}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6] transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              새 특별실 추가
            </button>
          )}
        </div>

        {/* Room Editor Form */}
        {editingRoom && (
          <form
            onSubmit={handleSaveRoom}
            className="mt-4 p-5 rounded-xl bg-[#F7F8FC] border border-[#E9EBF1] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#252B36]">
                {isNewRoom ? '새 특별실 등록' : `${editingRoom.name} 정보 수정`}
              </h3>
              <span className="text-xs text-[#8A91A0]">
                기존 예약 이력이 있는 특별실은 비활성화 옵션을 활용하세요.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">특별실 이름</label>
                <input
                  type="text"
                  required
                  value={editingRoom.name || ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                  placeholder="예: AI 정보화실"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">분류</label>
                <select
                  value={editingRoom.category || '기타'}
                  onChange={(e) => setEditingRoom({ ...editingRoom, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl"
                >
                  <option value="과학">과학</option>
                  <option value="정보">정보</option>
                  <option value="예체능">예체능</option>
                  <option value="독서">독서</option>
                  <option value="체육">체육</option>
                  <option value="돌봄">돌봄</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">표시 색상</label>
                <select
                  value={editingRoom.colorKey || 'purple'}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, colorKey: e.target.value as RoomColorKey })
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl"
                >
                  <option value="purple">보라색 (Purple)</option>
                  <option value="blue">파란색 (Blue)</option>
                  <option value="teal">청록색 (Teal)</option>
                  <option value="green">초록색 (Green)</option>
                  <option value="amber">주황/호박색 (Amber)</option>
                  <option value="rose">장미색 (Rose)</option>
                  <option value="indigo">남색 (Indigo)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">위치 및 층수</label>
                <input
                  type="text"
                  value={editingRoom.location || ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, location: e.target.value })}
                  placeholder="예: 본관 3층 동편"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">수용 정원 (명)</label>
                <input
                  type="number"
                  min={1}
                  value={editingRoom.capacity || 30}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, capacity: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">담당 교사 성명</label>
                <input
                  type="text"
                  value={editingRoom.managerName || ''}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, managerName: e.target.value })
                  }
                  placeholder="예: 과학부장"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8A91A0] mb-1">보유 비품 및 교구</label>
                <input
                  type="text"
                  value={editingRoom.equipment || ''}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, equipment: e.target.value })
                  }
                  placeholder="예: 전자칠판, 크롬북 30대"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E9EBF1] rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#252B36] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingRoom.active !== false}
                  onChange={(e) => setEditingRoom({ ...editingRoom, active: e.target.checked })}
                  className="rounded text-[#8055E8]"
                />
                시간표에 예약 가능 상태로 활성화
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-3.5 py-1.5 text-xs text-[#8A91A0] bg-white border border-[#E9EBF1] rounded-xl hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6] disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장 완료'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {rooms.map((room) => {
            const c = ROOM_COLOR_PALETTE[room.colorKey] || ROOM_COLOR_PALETTE.purple;
            const isSelected = room.id === selectedRoom?.id;
            return (
              <div
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-2 border-[#8055E8] dark:border-[#A855F7] bg-[#F7F3FF] dark:bg-[#1E1838] shadow-sm'
                    : 'border border-[#CBD5E1] dark:border-[#243048] bg-white dark:bg-[#111827] hover:border-[#8055E8]/60 dark:hover:border-[#A855F7]/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${c.badgeBg}`} />
                    <h3 className="font-bold text-sm text-[#252B36]">{room.name}</h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      room.active ? 'bg-[#EDFCF2] text-[#157347]' : 'bg-gray-100 text-[#8A91A0]'
                    }`}
                  >
                    {room.active ? '예약가능' : '비활성'}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1 text-xs text-[#8A91A0]">
                  <div>위치: <span className="text-[#252B36]">{room.location} ({room.floor})</span></div>
                  <div>정원: <span className="text-[#252B36]">{room.capacity}명</span> · 담당: <span className="text-[#252B36]">{room.managerName}</span></div>
                  {room.equipment && (
                    <div className="truncate">비품: <span className="text-[#252B36]">{room.equipment}</span></div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#E9EBF1] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickReserveRoom(room.id);
                    }}
                    className="text-xs font-semibold text-[#8055E8] hover:underline"
                  >
                    + 예약하기
                  </button>

                  {isManageMode && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={deletingRoomId === room.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoomToDelete(room);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="특별실 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>삭제</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditRoom(room);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#8055E8] bg-[#F3EEFF] hover:bg-[#e8deff] border border-[#D9C8FF] rounded-lg transition-colors cursor-pointer"
                        title="특별실 정보 수정"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>수정</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Room Deletion Confirmation Modal */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#E9EBF1] shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#252B36]">특별실 삭제 확인</h3>
                <p className="text-xs text-[#8A91A0]">선택한 특별실과 관련 예약이 함께 정리됩니다.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#252B36] leading-relaxed">
              <span className="font-extrabold text-red-600">'{roomToDelete.name}'</span> ({roomToDelete.location} {roomToDelete.floor}) 특별실을 정말 삭제하시겠습니까?
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingRoomId === roomToDelete.id}
                onClick={() => setRoomToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#475467] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deletingRoomId === roomToDelete.id}
                onClick={() => void handleConfirmDeleteRoom(roomToDelete)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {deletingRoomId === roomToDelete.id ? '삭제 중...' : '특별실 삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. Announcements View (공지사항)
// ============================================================================
export const AnnouncementsView: React.FC<{
  announcements: Announcement[];
  onSuccessMessage: (msg: string) => void;
}> = ({ announcements, onSuccessMessage }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'general' | 'maintenance' | 'event' | 'urgent'>('general');
  const [pinned, setPinned] = useState(true);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const author = localStorage.getItem('sindong_teacher_name') || '교무실';
    await createAnnouncement({
      title: title.trim(),
      content: content.trim(),
      category,
      pinned,
      authorName: author,
    });
    setTitle('');
    setContent('');
    onSuccessMessage('공지사항이 등록되었습니다.');
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E9EBF1] p-6 space-y-6 shadow-xs">
      <div>
        <h2 className="text-base font-bold text-[#252B36]">특별실 운영 및 이용 수칙 공지사항</h2>
        <p className="text-xs text-[#8A91A0] mt-0.5">
          특별실 사용 수칙, 기기 점검 일정, 비품 신청 관련 공지를 작성하고 확인합니다.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="p-4 rounded-xl bg-[#F7F8FC] border border-[#E9EBF1] space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목 입력..."
            className="sm:col-span-2 px-3 py-2 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-xl text-[#1E232A] dark:text-[#F8FAFC] placeholder-[#8A91A0] focus:outline-none focus:border-[#8055E8]"
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as 'general' | 'maintenance' | 'event' | 'urgent')
            }
            className="px-3 py-2 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-xl text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#8055E8]"
          >
            <option value="general">일반 안내</option>
            <option value="maintenance">시설 점검</option>
            <option value="event">학교 행사</option>
            <option value="urgent">긴급 공지</option>
          </select>
          <label className="flex items-center gap-2 px-3 py-2 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-xl text-[#1E232A] dark:text-[#F8FAFC] cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded border-[#CBD5E1] dark:border-[#475569] text-[#8055E8] focus:ring-0"
            />
            상단 고정 공지
          </label>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="공지 상세 내용 입력..."
            className="flex-1 px-3 py-2 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-xl text-[#1E232A] dark:text-[#F8FAFC] placeholder-[#8A91A0] focus:outline-none focus:border-[#8055E8]"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6] transition-colors shrink-0 shadow-sm cursor-pointer"
          >
            공지 등록
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8A91A0] border border-dashed border-[#CBD5E1] dark:border-[#2E3E5B] rounded-xl">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-xl border border-[#CBD5E1] dark:border-[#243048] bg-white dark:bg-[#111827] flex items-start justify-between gap-4 shadow-2xs"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-[#8A91A0]">
                  {a.pinned && (
                    <span className="font-bold text-[#8055E8] bg-[#F3EEFF] px-2 py-0.5 rounded-md">
                      고정 공지
                    </span>
                  )}
                  <span className="font-medium text-[#252B36]">{a.authorName}</span>
                </div>
                <h3 className="text-sm font-bold text-[#252B36] mt-1.5">{a.title}</h3>
                <p className="text-xs text-[#252B36]/80 mt-1 leading-relaxed">{a.content}</p>
              </div>
              <button
                type="button"
                onClick={() => void deleteAnnouncement(a.id)}
                className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0 p-1"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. System Settings View (교시 시정 설정 및 변경 이력 감사 로그)
// ============================================================================
export const SystemSettingsView: React.FC<{
  settings: SchoolSettings;
  auditLogs: AuditLog[];
  onSuccessMessage: (msg: string) => void;
}> = ({ settings, auditLogs, onSuccessMessage }) => {
  const [formSettings, setFormSettings] = useState<SchoolSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [localAuditLogs, setLocalAuditLogs] = useState<AuditLog[]>(auditLogs);
  const [resetBoxCollapsed, setResetBoxCollapsed] = useState<boolean>(false);
  const [auditLogsCollapsed, setAuditLogsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    setLocalAuditLogs(auditLogs);
  }, [auditLogs]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSchoolSettings(formSettings);
      onSuccessMessage('1~6교시 시간표 및 시스템 설정이 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleBootstrap = async () => {
    setSaving(true);
    try {
      await bootstrapInitialSchoolData();
      onSuccessMessage('전주신동초 특별실(8실)과 표준 1~6교시 시정표가 초기화되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSample = async () => {
    setSaving(true);
    try {
      const { resDeleted, annDeleted } = await resetInitialSampleData(false);
      onSuccessMessage(
        `기본 예시 자료가 완전히 삭제되었습니다. (예약 ${resDeleted}건, 공지 ${annDeleted}건 삭제)`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    setSaving(true);
    try {
      const { resDeleted, annDeleted } = await resetInitialSampleData(true);
      onSuccessMessage(
        `서버 예약 및 공지 데이터가 전체 초기화되었습니다. (예약 ${resDeleted}건, 공지 ${annDeleted}건 삭제)`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClearAuditLogs = async () => {
    setSaving(true);
    setLocalAuditLogs([]); // Instant UI feedback
    try {
      const deleted = await clearAuditLogs();
      onSuccessMessage(`변경 이력 로그 ${deleted}건이 삭제되었습니다.`);
    } catch (err) {
      setLocalAuditLogs(auditLogs); // Rollback on error
      onSuccessMessage(err instanceof Error ? err.message : '이력 로그 삭제 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Reset & Sample Clear Management Box */}
      <div className="bg-white rounded-2xl border border-[#E9EBF1] p-6 space-y-4 shadow-xs">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setResetBoxCollapsed(!resetBoxCollapsed)}
        >
          <div>
            <h3 className="text-sm font-bold text-[#252B36]">
              기본 예시 자료 삭제 및 서버 데이터 초기화
            </h3>
            <p className="text-xs text-[#8A91A0] mt-0.5">
              초기 설치 시 자동 등록되었던 기본 예시 자료(샘플 예약 및 공지)를 삭제하거나 전체 예약 데이터를 깨끗하게 초기화합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setResetBoxCollapsed(!resetBoxCollapsed);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#667085] bg-[#F4F6F8] hover:bg-[#E9ECEF] border border-[#E5E9EE] rounded-xl transition-all shrink-0 cursor-pointer"
          >
            {resetBoxCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span>{resetBoxCollapsed ? '펼치기' : '접기'}</span>
          </button>
        </div>

        {!resetBoxCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <div className="font-bold text-xs text-amber-900">기본 예시 자료(샘플) 삭제</div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                시스템에 기본으로 포함되어 있는 예시 예약(demo_res_*) 및 기본 안내 공지를 삭제합니다.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={handleClearSample}
                className="mt-2 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
              >
                {saving ? '처리 중...' : '기본 예시 자료 삭제'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-red-50/60 border border-red-200/80 space-y-2">
              <div className="font-bold text-xs text-red-900">전체 예약/공지 일괄 초기화</div>
              <p className="text-[11px] text-red-700 leading-relaxed">
                등록된 모든 예약 내역, 시간표 잠금, 공지사항을 서버에서 일괄 삭제합니다.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={handleClearAll}
                className="mt-2 px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-2xs cursor-pointer"
              >
                {saving ? '처리 중...' : '전체 데이터 일괄 초기화'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#E9EBF1] p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E9EBF1]">
          <div>
            <h2 className="text-base font-bold text-[#252B36]">
              교시 시정표(1~6교시) 및 시스템 설정
            </h2>
            <p className="text-xs text-[#8A91A0] mt-0.5">
              전주신동초등학교 실제 일과표에 맞춰 1~6교시 시작·종료 시간을 자유롭게 변경할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleBootstrap}
            className="px-3.5 py-2 text-xs font-semibold text-[#8055E8] bg-[#F3EEFF] border border-[#D9C8FF] rounded-xl hover:bg-[#e8deff] transition-colors"
          >
            학교 표준 특별실(8실) 및 시간표 초기화
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {([1, 2, 3, 4] as const).map((p) => {
              const sKey = `p${p}Start` as keyof SchoolSettings;
              const eKey = `p${p}End` as keyof SchoolSettings;
              return (
                <div
                  key={p}
                  className="p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#161F32] border border-[#CBD5E1] dark:border-[#243048] space-y-2"
                >
                  <div className="text-xs font-bold text-[#252B36] dark:text-[#F8FAFC]">{p}교시 시간</div>
                  <div>
                    <label className="block text-[10px] text-[#8A91A0] dark:text-[#94A3B8]">시작 (HH:MM)</label>
                    <input
                      type="text"
                      value={String(formSettings[sKey] || '')}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, [sKey]: e.target.value })
                      }
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-lg tabular-nums text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#8055E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A91A0] dark:text-[#94A3B8]">종료 (HH:MM)</label>
                    <input
                      type="text"
                      value={String(formSettings[eKey] || '')}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, [eKey]: e.target.value })
                      }
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-lg tabular-nums text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#8055E8]"
                    />
                  </div>
                </div>
              );
            })}

            {/* Lunch Time Card */}
            <div className="p-3.5 rounded-xl bg-amber-50/75 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-2">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">점심시간</div>
              <div>
                <label className="block text-[10px] text-amber-700 dark:text-amber-300">시작 (HH:MM)</label>
                <input
                  type="text"
                  value={String(formSettings.lunchStart || '')}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, lunchStart: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1A2234] border border-amber-300 dark:border-amber-800/60 rounded-lg tabular-nums text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-amber-700 dark:text-amber-300">종료 (HH:MM)</label>
                <input
                  type="text"
                  value={String(formSettings.lunchEnd || '')}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, lunchEnd: e.target.value })
                  }
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1A2234] border border-amber-300 dark:border-amber-800/60 rounded-lg tabular-nums text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {([5, 6] as const).map((p) => {
              const sKey = `p${p}Start` as keyof SchoolSettings;
              const eKey = `p${p}End` as keyof SchoolSettings;
              return (
                <div
                  key={p}
                  className="p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#161F32] border border-[#CBD5E1] dark:border-[#243048] space-y-2"
                >
                  <div className="text-xs font-bold text-[#252B36] dark:text-[#F8FAFC]">{p}교시 시간</div>
                  <div>
                    <label className="block text-[10px] text-[#8A91A0] dark:text-[#94A3B8]">시작 (HH:MM)</label>
                    <input
                      type="text"
                      value={String(formSettings[sKey] || '')}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, [sKey]: e.target.value })
                      }
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-lg tabular-nums text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#8055E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A91A0] dark:text-[#94A3B8]">종료 (HH:MM)</label>
                    <input
                      type="text"
                      value={String(formSettings[eKey] || '')}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, [eKey]: e.target.value })
                      }
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-lg tabular-nums text-[#1E232A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#8055E8]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#8055E8] rounded-xl hover:bg-[#6f44d6] shadow-sm transition-colors"
            >
              {saving ? '저장 중...' : '교시 시정표 설정 저장'}
            </button>
          </div>
        </form>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-2xl border border-[#E9EBF1] p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex-1 cursor-pointer select-none"
            onClick={() => setAuditLogsCollapsed(!auditLogsCollapsed)}
          >
            <h3 className="text-sm font-bold text-[#252B36]">예약 및 시스템 변경 이력 로그</h3>
            <p className="text-xs text-[#8A91A0] mt-0.5">
              예약 등록, 수정, 취소 및 설정 변경 내역이 안전하게 기록됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {localAuditLogs.length > 0 && !auditLogsCollapsed && (
              <button
                type="button"
                disabled={saving}
                onClick={handleClearAuditLogs}
                className="px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? '삭제 중...' : '이력 로그 전체 삭제'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setAuditLogsCollapsed(!auditLogsCollapsed)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#667085] bg-[#F4F6F8] hover:bg-[#E9ECEF] border border-[#E5E9EE] rounded-xl transition-all shrink-0 cursor-pointer"
            >
              {auditLogsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              <span>{auditLogsCollapsed ? '펼치기' : '접기'}</span>
            </button>
          </div>
        </div>

        {!auditLogsCollapsed && (
          <div className="divide-y divide-[#E9EBF1] border border-[#E9EBF1] rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            {localAuditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8A91A0]">
                기록된 변경 이력이 없습니다.
              </div>
            ) : (
              localAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-2.5 text-xs flex items-center justify-between gap-4 bg-white hover:bg-gray-50"
                >
                  <div>
                    <span className="font-bold text-[#252B36]">{log.actorName}</span>
                    <span className="mx-2 text-[#8A91A0]">·</span>
                    <span className="text-[#252B36]">{log.summary}</span>
                  </div>
                  <span className="text-[11px] text-[#8A91A0] shrink-0">{log.action}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
