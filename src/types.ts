export type RoomColorKey =
  | 'purple'
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'cyan';

export interface SpecialRoom {
  id: string;
  schoolId: string;
  name: string;
  category: string;
  colorKey: RoomColorKey;
  location: string;
  floor: string;
  capacity: number;
  availablePeriods: number[];
  equipment: string;
  managerName: string;
  guidelines: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'teacher';
  schoolId: string;
}

export interface Reservation {
  id: string;
  schoolId: string;
  roomId: string;
  roomName: string;
  roomCategory: string;
  roomColor: RoomColorKey;
  userName: string; // 예약자 교사 성명
  userId?: string; // Firebase Auth UID (선택/연동)
  userEmail?: string; // Firebase Auth Email (선택/연동)
  date: string; // YYYY-MM-DD
  startPeriod: number; // 1..6
  endPeriod: number; // 1..6
  grade: number; // 학년 (1..6)
  classNum: number; // 반 (1..20)
  classLabel: string; // 예: "5학년 2반"
  status: 'confirmed' | 'cancelled';
  seriesId: string;
  recurrenceSummary: string;
  source: 'manual' | 'timetable' | 'ai';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Announcement {
  id: string;
  schoolId: string;
  title: string;
  content: string;
  category: 'general' | 'maintenance' | 'event' | 'urgent';
  pinned: boolean;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  schoolId: string;
  actorName: string;
  action:
    | 'create_reservation'
    | 'update_reservation'
    | 'cancel_reservation'
    | 'manage_room'
    | 'manage_settings';
  targetId: string;
  summary: string;
  createdAt?: unknown;
}

export interface SchoolSettings {
  id: string;
  schoolId: string;
  schoolName: string;
  maxAdvanceDays: number;
  allowTeacherRecurring: boolean;
  p1Start: string;
  p1End: string;
  p2Start: string;
  p2End: string;
  p3Start: string;
  p3End: string;
  p4Start: string;
  p4End: string;
  lunchStart: string;
  lunchEnd: string;
  p5Start: string;
  p5End: string;
  p6Start: string;
  p6End: string;
  sampleCleared?: boolean;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface PeriodInfo {
  period: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface ConflictItem {
  date: string;
  period: number;
  reason: string;
}

export interface AlternativeSlot {
  roomId: string;
  roomName: string;
  date: string;
  startPeriod: number;
  endPeriod: number;
  label: string;
}

export interface AIReservationParsed {
  intent: 'create_reservation' | 'search_available';
  roomId: string;
  roomName: string;
  userName: string;
  startDate: string;
  endDate: string;
  startPeriod: number;
  endPeriod: number;
  recurrenceType: 'none' | 'daily' | 'weekly' | 'period_weekday';
  weeklyCount: number;
  grade: number;
  classNum: number;
  classLabel: string;
  missingFields: string[];
  followUpQuestion: string;
  explanation: string;
}

export type NavSectionId =
  | 'dashboard'
  | 'timetable'
  | 'calendar'
  | 'new-reservation'
  | 'my-reservations'
  | 'all-reservations'
  | 'recurring-reservations'
  | 'room-list'
  | 'room-manage'
  | 'announcements'
  | 'system-settings';

export const ROOM_COLOR_PALETTE: Record<
  RoomColorKey,
  {
    bg: string;
    border: string;
    text: string;
    subtext: string;
    badgeBg: string;
    label: string;
  }
> = {
  purple: {
    bg: 'bg-[#F5F2FD] dark:bg-purple-950/45',
    border: 'border-[#D8C7F8] dark:border-purple-700/60',
    text: 'text-[#5B3FB8] dark:text-purple-200',
    subtext: 'text-[#7A5EC7] dark:text-purple-300',
    badgeBg: 'bg-[#7A5EC7] dark:bg-purple-400',
    label: '라벤더 (과학실)',
  },
  blue: {
    bg: 'bg-[#F0F7FF] dark:bg-blue-950/45',
    border: 'border-[#B9DAFE] dark:border-blue-700/60',
    text: 'text-[#1D5BD6] dark:text-blue-200',
    subtext: 'text-[#3B73E0] dark:text-blue-300',
    badgeBg: 'bg-[#2563EB] dark:bg-blue-400',
    label: '스카이블루 (컴퓨터실)',
  },
  teal: {
    bg: 'bg-[#EBFBF8] dark:bg-teal-950/45',
    border: 'border-[#A7E8DC] dark:border-teal-700/60',
    text: 'text-[#0E7470] dark:text-teal-200',
    subtext: 'text-[#138A85] dark:text-teal-300',
    badgeBg: 'bg-[#0D9488] dark:bg-teal-400',
    label: '청록 (음악실)',
  },
  emerald: {
    bg: 'bg-[#EAF7EE] dark:bg-emerald-950/45',
    border: 'border-[#B2E4C2] dark:border-emerald-700/60',
    text: 'text-[#166534] dark:text-emerald-200',
    subtext: 'text-[#1E8A58] dark:text-emerald-300',
    badgeBg: 'bg-[#22C55E] dark:bg-emerald-400',
    label: '민트 (도서실)',
  },
  amber: {
    bg: 'bg-[#FEF6E9] dark:bg-amber-950/45',
    border: 'border-[#FCD385] dark:border-amber-700/60',
    text: 'text-[#B45309] dark:text-amber-200',
    subtext: 'text-[#C96718] dark:text-amber-300',
    badgeBg: 'bg-[#F59E0B] dark:bg-amber-400',
    label: '웜샌드 (미술실)',
  },
  rose: {
    bg: 'bg-[#FFF0ED] dark:bg-rose-950/45',
    border: 'border-[#FCC0B5] dark:border-rose-700/60',
    text: 'text-[#BE123C] dark:text-rose-200',
    subtext: 'text-[#D42A54] dark:text-rose-300',
    badgeBg: 'bg-[#FB7185] dark:bg-rose-400',
    label: '피치 (실과실)',
  },
  indigo: {
    bg: 'bg-[#EEF2FF] dark:bg-indigo-950/45',
    border: 'border-[#B4C3FE] dark:border-indigo-700/60',
    text: 'text-[#3730A3] dark:text-indigo-200',
    subtext: 'text-[#4F46E5] dark:text-indigo-300',
    badgeBg: 'bg-[#6366F1] dark:bg-indigo-400',
    label: '인디고 (스마트AI실)',
  },
  cyan: {
    bg: 'bg-[#ECFEFF] dark:bg-cyan-950/45',
    border: 'border-[#ADEFFC] dark:border-cyan-700/60',
    text: 'text-[#0E7490] dark:text-cyan-200',
    subtext: 'text-[#0891B2] dark:text-cyan-300',
    badgeBg: 'bg-[#06B6D4] dark:bg-cyan-400',
    label: '시안 (체육관)',
  },
};
