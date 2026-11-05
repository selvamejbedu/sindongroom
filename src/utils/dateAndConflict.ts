import {
  AlternativeSlot,
  ConflictItem,
  PeriodInfo,
  Reservation,
  SchoolSettings,
  SpecialRoom,
} from '../types';
import { SCHOOL_ID } from '../firebase';

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  id: 'school_config',
  schoolId: SCHOOL_ID,
  schoolName: '전주신동초등학교',
  maxAdvanceDays: 90,
  allowTeacherRecurring: true,
  p1Start: '09:00',
  p1End: '09:40',
  p2Start: '09:50',
  p2End: '10:30',
  p3Start: '10:40',
  p3End: '11:20',
  p4Start: '11:30',
  p4End: '12:10',
  lunchStart: '12:10',
  lunchEnd: '13:00',
  p5Start: '13:00',
  p5End: '13:40',
  p6Start: '13:50',
  p6End: '14:30',
  updatedBy: 'system',
};

export const PERIOD_ORDER = [1, 2, 3, 4, 7, 5, 6] as const;

export function settingsToPeriods(settings: SchoolSettings): PeriodInfo[] {
  return [
    { period: 1, label: '1교시', startTime: settings.p1Start, endTime: settings.p1End },
    { period: 2, label: '2교시', startTime: settings.p2Start, endTime: settings.p2End },
    { period: 3, label: '3교시', startTime: settings.p3Start, endTime: settings.p3End },
    { period: 4, label: '4교시', startTime: settings.p4Start, endTime: settings.p4End },
    { period: 7, label: '점심시간', startTime: settings.lunchStart, endTime: settings.lunchEnd },
    { period: 5, label: '5교시', startTime: settings.p5Start, endTime: settings.p5End },
    { period: 6, label: '6교시', startTime: settings.p6Start, endTime: settings.p6End },
  ];
}

export function formatPeriodLabel(period: number, periods?: PeriodInfo[]): string {
  const found = periods?.find((p) => p.period === period);
  if (found) return found.label;
  return period === 7 ? '점심시간' : `${period}교시`;
}

export function getPeriodsInRange(startPeriod: number, endPeriod: number): number[] {
  const sIdx = PERIOD_ORDER.indexOf(startPeriod as (typeof PERIOD_ORDER)[number]);
  const eIdx = PERIOD_ORDER.indexOf(endPeriod as (typeof PERIOD_ORDER)[number]);
  if (sIdx === -1 || eIdx === -1) {
    return [startPeriod];
  }
  const minIdx = Math.min(sIdx, eIdx);
  const maxIdx = Math.max(sIdx, eIdx);
  return PERIOD_ORDER.slice(minIdx, maxIdx + 1);
}

export function isPeriodInReservation(
  period: number,
  startPeriod: number,
  endPeriod: number
): boolean {
  const pIdx = PERIOD_ORDER.indexOf(period as (typeof PERIOD_ORDER)[number]);
  const sIdx = PERIOD_ORDER.indexOf(startPeriod as (typeof PERIOD_ORDER)[number]);
  const eIdx = PERIOD_ORDER.indexOf(endPeriod as (typeof PERIOD_ORDER)[number]);
  if (pIdx === -1 || sIdx === -1 || eIdx === -1) {
    return period >= startPeriod && period <= endPeriod;
  }
  const minIdx = Math.min(sIdx, eIdx);
  const maxIdx = Math.max(sIdx, eIdx);
  return pIdx >= minIdx && pIdx <= maxIdx;
}

export function formatPeriodRangeLabel(
  startPeriod: number,
  endPeriod: number,
  periods?: PeriodInfo[],
  includeTime = false
): string {
  const sInfo = periods?.find((p) => p.period === startPeriod);
  const eInfo = periods?.find((p) => p.period === endPeriod);
  const sLabel = sInfo ? sInfo.label : formatPeriodLabel(startPeriod);
  const eLabel = eInfo ? eInfo.label : formatPeriodLabel(endPeriod);

  if (startPeriod === endPeriod) {
    return includeTime && sInfo ? `${sLabel} (${sInfo.startTime}~${sInfo.endTime})` : sLabel;
  }
  return includeTime && sInfo && eInfo
    ? `${sLabel}~${eLabel} (${sInfo.startTime}~${eInfo.endTime})`
    : `${sLabel}~${eLabel}`;
}

export function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDateStr(dt);
}

export const KOR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export interface WeekDayColumn {
  date: string;
  dayName: string; // 월, 화, 수, 목, 금
  dayNumber: number; // 20
  shortDate: string; // 11.02
  monthDayLabel: string; // 11월 2일 (월)
  isToday: boolean;
}

export function getMondayOfWeek(dateStr: string): string {
  const dt = parseDateStr(dateStr);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return formatDateStr(dt);
}

export function getWeekDays(referenceDateStr: string): WeekDayColumn[] {
  const monday = getMondayOfWeek(referenceDateStr);
  const today = getTodayStr();
  return [0, 1, 2, 3, 4].map((offset) => {
    const dStr = addDays(monday, offset);
    const dt = parseDateStr(dStr);
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const dayName = KOR_WEEKDAYS[dt.getDay()];
    return {
      date: dStr,
      dayName,
      dayNumber: d,
      shortDate: `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`,
      monthDayLabel: `${m}월 ${d}일 (${dayName})`,
      isToday: dStr === today,
    };
  });
}

export function formatWeekRangeLabel(referenceDateStr: string): string {
  const days = getWeekDays(referenceDateStr);
  if (days.length < 5) return referenceDateStr;
  const first = parseDateStr(days[0].date);
  const last = parseDateStr(days[4].date);
  const y1 = first.getFullYear();
  const m1 = first.getMonth() + 1;
  const d1 = first.getDate();
  const m2 = last.getMonth() + 1;
  const d2 = last.getDate();
  return `${y1}년 ${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`;
}

export function formatKoreanDate(dateStr: string): string {
  const dt = parseDateStr(dateStr);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  const w = KOR_WEEKDAYS[dt.getDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}

export interface CalendarCell {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export function getMonthCalendarGrid(year: number, month: number): CalendarCell[] {
  const today = getTodayStr();
  const firstDay = new Date(year, month - 1, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const startCursor = new Date(year, month - 1, 1 - startDow);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(startCursor);
    dt.setDate(startCursor.getDate() + i);
    const dateStr = formatDateStr(dt);
    const dow = dt.getDay();
    cells.push({
      date: dateStr,
      dayNumber: dt.getDate(),
      isCurrentMonth: dt.getMonth() === month - 1,
      isToday: dateStr === today,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return cells;
}

export function addMonths(dateStr: string, months: number): string {
  const dt = parseDateStr(dateStr);
  const origDay = dt.getDate();
  dt.setMonth(dt.getMonth() + months);
  if (dt.getDate() !== origDay) {
    dt.setDate(0); // Clamps to last day of previous month if overshoot
  }
  return formatDateStr(dt);
}

export function expandReservationDates(
  startDate: string,
  endDate: string,
  recurrenceType: 'none' | 'daily' | 'weekly' | 'period_weekday',
  weeklyCount = 4,
  selectedWeekdays: number[] = []
): string[] {
  if (recurrenceType === 'none') {
    if (!endDate || endDate <= startDate) return [startDate];
    const dates: string[] = [];
    let cur = startDate;
    let safety = 0;
    while (cur <= endDate && safety < 31) {
      const dow = parseDateStr(cur).getDay();
      if (dow >= 1 && dow <= 5) {
        dates.push(cur);
      }
      cur = addDays(cur, 1);
      safety++;
    }
    return dates.length > 0 ? dates : [startDate];
  }

  if (recurrenceType === 'daily') {
    const dates: string[] = [];
    const targetEnd = endDate && endDate >= startDate ? endDate : addDays(startDate, 4);
    let cur = startDate;
    let safety = 0;
    while (cur <= targetEnd && safety < 31) {
      const dow = parseDateStr(cur).getDay();
      if (dow >= 1 && dow <= 5) {
        dates.push(cur);
      }
      cur = addDays(cur, 1);
      safety++;
    }
    return dates;
  }

  if (recurrenceType === 'weekly') {
    const count = Math.min(Math.max(1, weeklyCount), 24);
    const dates: string[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(addDays(startDate, i * 7));
    }
    return dates;
  }

  if (recurrenceType === 'period_weekday') {
    const dates: string[] = [];
    const targetEnd = endDate && endDate >= startDate ? endDate : addDays(startDate, 28);
    let activeWeekdays = selectedWeekdays;
    if (!activeWeekdays || activeWeekdays.length === 0) {
      const startDow = parseDateStr(startDate).getDay();
      activeWeekdays = startDow >= 1 && startDow <= 5 ? [startDow] : [1];
    }
    let cur = startDate;
    let safety = 0;
    while (cur <= targetEnd && safety < 180) {
      const dow = parseDateStr(cur).getDay();
      if (activeWeekdays.includes(dow)) {
        dates.push(cur);
      }
      cur = addDays(cur, 1);
      safety++;
    }
    return dates.length > 0 ? dates : [startDate];
  }

  return [startDate];
}

export function evaluateReservationConflicts(params: {
  roomId: string;
  dates: string[];
  startPeriod: number;
  endPeriod: number;
  excludeReservationId?: string;
  rooms: SpecialRoom[];
  reservations: Reservation[];
  periods?: PeriodInfo[];
}): {
  valid: boolean;
  conflicts: ConflictItem[];
  alternatives: AlternativeSlot[];
} {
  const {
    roomId,
    dates,
    startPeriod,
    endPeriod,
    excludeReservationId = '',
    rooms,
    reservations,
    periods,
  } = params;

  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    return {
      valid: false,
      conflicts: [
        {
          date: dates[0] || getTodayStr(),
          period: startPeriod,
          reason: '선택한 특별실 정보를 찾을 수 없습니다.',
        },
      ],
      alternatives: [],
    };
  }

  if (!room.active) {
    return {
      valid: false,
      conflicts: [
        {
          date: dates[0] || getTodayStr(),
          period: startPeriod,
          reason: `${room.name}은(는) 현재 사용 중지(비활성화) 상태입니다.`,
        },
      ],
      alternatives: [],
    };
  }

  const periodOrder = [1, 2, 3, 4, 7, 5, 6];
  const sIdx = periodOrder.indexOf(startPeriod);
  const eIdx = periodOrder.indexOf(endPeriod);
  const affectedPeriods = getPeriodsInRange(startPeriod, endPeriod);
  const roomAvailable = room.availablePeriods.includes(7)
    ? room.availablePeriods
    : [...room.availablePeriods, 7];

  const conflicts: ConflictItem[] = [];

  for (const date of dates) {
    const dow = parseDateStr(date).getDay();
    if (dow === 0 || dow === 6) {
      conflicts.push({
        date,
        period: startPeriod,
        reason: '주말(토·일요일)은 정규 수업 시간표 예약 대상이 아닙니다.',
      });
    }

    for (const p of affectedPeriods) {
      if (!roomAvailable.includes(p)) {
        const periodName = formatPeriodLabel(p, periods);
        conflicts.push({
          date,
          period: p,
          reason: `${room.name}은(는) ${periodName} 사용 가능 특별실이 아닙니다.`,
        });
      }

      const existing = reservations.find(
        (r) =>
          r.status === 'confirmed' &&
          r.id !== excludeReservationId &&
          r.roomId === roomId &&
          r.date === date &&
          isPeriodInReservation(p, r.startPeriod, r.endPeriod)
      );
      if (existing) {
        conflicts.push({
          date,
          period: p,
          reason: `중복 예약 (${existing.classLabel})`,
        });
      }
    }
  }

  const alternatives: AlternativeSlot[] = [];
  if (conflicts.length > 0 && dates.length > 0) {
    const targetDate = dates[0];
    const span = Math.max(1, sIdx >= 0 && eIdx >= 0 ? Math.abs(eIdx - sIdx) + 1 : 1);

    // Same room, other periods on targetDate
    for (let i = 0; i <= periodOrder.length - span; i++) {
      const subPeriods = periodOrder.slice(i, i + span);
      const p = subPeriods[0];
      const endP = subPeriods[subPeriods.length - 1];
      let ok = true;
      for (const checkP of subPeriods) {
        if (!roomAvailable.includes(checkP)) ok = false;
        if (
          reservations.some(
            (r) =>
              r.status === 'confirmed' &&
              r.id !== excludeReservationId &&
              r.roomId === roomId &&
              r.date === targetDate &&
              isPeriodInReservation(checkP, r.startPeriod, r.endPeriod)
          )
        ) {
          ok = false;
        }
      }
      if (ok) {
        alternatives.push({
          roomId: room.id,
          roomName: room.name,
          date: targetDate,
          startPeriod: p,
          endPeriod: endP,
          label: `${targetDate} ${room.name} ${formatPeriodRangeLabel(p, endP, periods)}`,
        });
      }
    }

    // Other active rooms on targetDate at requested periods
    for (const other of rooms.filter((r) => r.active && r.id !== roomId)) {
      const otherAvailable = other.availablePeriods.includes(7)
        ? other.availablePeriods
        : [...other.availablePeriods, 7];
      let ok = true;
      for (const checkP of affectedPeriods) {
        if (!otherAvailable.includes(checkP)) ok = false;
        if (
          reservations.some(
            (r) =>
              r.status === 'confirmed' &&
              r.roomId === other.id &&
              r.date === targetDate &&
              isPeriodInReservation(checkP, r.startPeriod, r.endPeriod)
          )
        ) {
          ok = false;
        }
      }
      if (ok) {
        alternatives.push({
          roomId: other.id,
          roomName: other.name,
          date: targetDate,
          startPeriod,
          endPeriod,
          label: `${targetDate} ${other.name} ${formatPeriodRangeLabel(startPeriod, endPeriod, periods)}`,
        });
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    alternatives: alternatives.slice(0, 5),
  };
}

export async function validateReservationOnServer(params: {
  roomId: string;
  dates: string[];
  startPeriod: number;
  endPeriod: number;
  excludeReservationId?: string;
  rooms: SpecialRoom[];
  reservations: Reservation[];
}): Promise<{
  valid: boolean;
  conflicts: ConflictItem[];
  alternatives: AlternativeSlot[];
}> {
  try {
    const resp = await fetch('/api/reservations/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!resp.ok) {
      return evaluateReservationConflicts(params);
    }
    return await resp.json();
  } catch {
    return evaluateReservationConflicts(params);
  }
}
