import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Repeat,
  Search,
  Settings,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  ADMIN_EMAILS,
  auth,
  AuthErrorInfo,
  db,
  handleFirestoreError,
  logoutUser,
  onAuthStateChanged,
  OperationType,
  parseAuthError,
  SCHOOL_ID,
  signInWithGoogle,
} from './firebase';
import {
  Announcement,
  AppUser,
  AuditLog,
  NavSectionId,
  PeriodInfo,
  Reservation,
  ROOM_COLOR_PALETTE,
  SchoolSettings,
  SpecialRoom,
} from './types';
import {
  addDays,
  DEFAULT_SCHOOL_SETTINGS,
  formatKoreanDate,
  formatWeekRangeLabel,
  getMonthCalendarGrid,
  getTodayStr,
  getWeekDays,
  isPeriodInReservation,
  KOR_WEEKDAYS,
  settingsToPeriods,
} from './utils/dateAndConflict';
import {
  bootstrapInitialSchoolData,
  buildDemoPreviewData,
  syncUserProfile,
} from './services/firestoreService';
import { ReservationModal } from './components/ReservationModal';
import { LoginModal } from './components/LoginModal';
import {
  AnnouncementsView,
  MonthlyCalendarView,
  ReservationListView,
  RoomDirectoryAndManageView,
  SystemSettingsView,
} from './components/ManagementViews';

export default function App() {
  // ==========================================================================
  // Navigation & UI State
  // ==========================================================================
  const [activeNav, setActiveNav] = useState<NavSectionId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Theme State: White (light) mode as default
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sindong_theme');
      return saved === 'dark'; // false (White mode) is default
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('sindong_theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('sindong_theme', 'light');
      } catch {}
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // ==========================================================================
  // Firebase Auth & User State
  // Default: All visitors and authenticated users immediately have Admin role
  // ==========================================================================
  const DEFAULT_VISITOR_ADMIN: AppUser = {
    uid: 'sindong_admin_default',
    email: null,
    displayName: '신동초 관리자',
    photoURL: null,
    role: 'admin',
    schoolId: SCHOOL_ID,
  };

  const [currentUser, setCurrentUser] = useState<AppUser>(() => {
    try {
      const saved = localStorage.getItem('sindong_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, role: 'admin' };
      }
    } catch {}
    return DEFAULT_VISITOR_ADMIN;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [loginModalError, setLoginModalError] = useState<AuthErrorInfo | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const profile = await syncUserProfile(fbUser);
          const adminProfile: AppUser = { ...profile, role: 'admin' };
          setCurrentUser(adminProfile);
          try {
            localStorage.setItem('sindong_user', JSON.stringify(adminProfile));
            if (
              adminProfile.displayName &&
              !adminProfile.displayName.includes('@') &&
              !adminProfile.displayName.includes('admin')
            ) {
              localStorage.setItem('sindong_teacher_name', adminProfile.displayName);
            }
          } catch {}
        } catch (err) {
          console.warn('Sync profile warning:', err);
          const emailLower = (fbUser.email || '').toLowerCase().trim();
          const emailPrefix = emailLower ? emailLower.split('@')[0] : '';
          const cleanName =
            fbUser.displayName &&
            !fbUser.displayName.includes('@') &&
            fbUser.displayName.toLowerCase() !== emailPrefix
              ? fbUser.displayName
              : '특별실 관리자';
          const fallbackUser: AppUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: cleanName,
            photoURL: fbUser.photoURL,
            role: 'admin',
            schoolId: SCHOOL_ID,
          };
          setCurrentUser(fallbackUser);
          try {
            localStorage.setItem('sindong_user', JSON.stringify(fallbackUser));
          } catch {}
        }
      } else {
        // If logged out from Firebase and not in manual bypass mode
        const saved = localStorage.getItem('sindong_user');
        if (saved) {
          try {
            setCurrentUser({ ...JSON.parse(saved), role: 'admin' });
          } catch {
            setCurrentUser(DEFAULT_VISITOR_ADMIN);
          }
        } else {
          setCurrentUser(DEFAULT_VISITOR_ADMIN);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const fbUser = await signInWithGoogle();
      const profile = await syncUserProfile(fbUser);
      const adminProfile: AppUser = { ...profile, role: 'admin' };
      setCurrentUser(adminProfile);
      try {
        localStorage.setItem('sindong_user', JSON.stringify(adminProfile));
        if (
          adminProfile.displayName &&
          !adminProfile.displayName.includes('@') &&
          !adminProfile.displayName.includes('admin')
        ) {
          localStorage.setItem('sindong_teacher_name', adminProfile.displayName);
        }
      } catch {}
      showToast(`${adminProfile.displayName} 선생님, 환영합니다!`);
    } catch (err) {
      console.error('Google Sign-in failed:', err);
      const parsed = parseAuthError(err);
      setLoginModalError(parsed);
      setLoginModalOpen(true);
      showToast(parsed.friendlyMessage);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Logout notice:', err);
    }
    try {
      localStorage.removeItem('sindong_user');
    } catch {}
    setCurrentUser(DEFAULT_VISITOR_ADMIN);
    showToast('로그아웃되었습니다.');
  };

  const safeTeacherDisplayName = useMemo(() => {
    if (!currentUser) return '전주신동초 교직원';
    const name = currentUser.displayName?.trim() || '';
    const emailPrefix = currentUser.email ? currentUser.email.split('@')[0].toLowerCase() : '';
    if (name && !name.includes('@') && name.toLowerCase() !== emailPrefix && name !== 'admin') {
      return name;
    }
    return '신동초 선생님';
  }, [currentUser]);

  // Timetable Navigation & Filters
  // ==========================================================================
  const [referenceDate, setReferenceDate] = useState<string>(getTodayStr());
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'day'>('day');

  // Mini Month Calendar State (Left pane)
  const [miniCalYear, setMiniCalYear] = useState<number>(() => {
    return Number(getTodayStr().split('-')[0]) || 2026;
  });
  const [miniCalMonth, setMiniCalMonth] = useState<number>(() => {
    return Number(getTodayStr().split('-')[1]) || 10;
  });

  // ==========================================================================
  // Reservation Modal State
  // ==========================================================================
  const [resModalOpen, setResModalOpen] = useState<boolean>(false);
  const [resModalMode, setResModalMode] = useState<'create' | 'detail' | 'edit'>('create');
  const [resModalInitialDate, setResModalInitialDate] = useState<string>(getTodayStr());
  const [resModalInitialPeriod, setResModalInitialPeriod] = useState<number>(2);
  const [resModalInitialRoomId, setResModalInitialRoomId] = useState<string>('');
  const [resModalInitialRecurrence, setResModalInitialRecurrence] = useState<
    'none' | 'daily' | 'weekly' | 'period_weekday'
  >('none');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // ==========================================================================
  // Firestore Subscriptions
  // ==========================================================================
  const demoData = useMemo(() => buildDemoPreviewData(getTodayStr()), []);
  const [liveRooms, setLiveRooms] = useState<SpecialRoom[]>([]);
  const [liveReservations, setLiveReservations] = useState<Reservation[]>([]);
  const [liveAnnouncements, setLiveAnnouncements] = useState<Announcement[]>([]);
  const [liveSettings, setLiveSettings] = useState<SchoolSettings | null>(null);
  const [liveAuditLogs, setLiveAuditLogs] = useState<AuditLog[]>([]);

  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [resLoaded, setResLoaded] = useState(false);
  const [annLoaded, setAnnLoaded] = useState(false);

  useEffect(() => {
    const unsubRooms = onSnapshot(
      collection(db, 'rooms'),
      (snap) => {
        const list: SpecialRoom[] = snap.docs.map((d) => {
          const data = d.data() as SpecialRoom;
          return {
            ...data,
            availablePeriods: Array.from(
              new Set([...(data.availablePeriods || [1, 2, 3, 4, 5, 6]), 7])
            ),
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setLiveRooms(list);
        setRoomsLoaded(true);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rooms');
        setRoomsLoaded(true);
      }
    );

    const unsubRes = onSnapshot(
      collection(db, 'reservations'),
      (snap) => {
        const list: Reservation[] = snap.docs.map((d) => d.data() as Reservation);
        setLiveReservations(list);
        setResLoaded(true);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'reservations');
        setResLoaded(true);
      }
    );

    const unsubAnnounce = onSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        const list: Announcement[] = snap.docs.map((d) => d.data() as Announcement);
        list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        setLiveAnnouncements(list);
        setAnnLoaded(true);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'announcements');
        setAnnLoaded(true);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'school_config'),
      (snap) => {
        if (snap.exists()) {
          setLiveSettings(snap.data() as SchoolSettings);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/school_config')
    );

    const unsubLogs = onSnapshot(
      collection(db, 'auditLogs'),
      (snap) => {
        const list: AuditLog[] = snap.docs.map((d) => d.data() as AuditLog);
        list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setLiveAuditLogs(list.slice(0, 50));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      unsubRooms();
      unsubRes();
      unsubAnnounce();
      unsubSettings();
      unsubLogs();
    };
  }, []);

  const rooms: SpecialRoom[] =
    roomsLoaded && (liveRooms.length > 0 || liveSettings !== null) ? liveRooms : demoData.rooms;
  const reservations: Reservation[] = resLoaded ? liveReservations : demoData.reservations;
  const announcements: Announcement[] = annLoaded ? liveAnnouncements : demoData.announcements;
  const settings: SchoolSettings = liveSettings || DEFAULT_SCHOOL_SETTINGS;
  const auditLogs: AuditLog[] = liveAuditLogs;

  const myReservationCount = useMemo(() => {
    if (!currentUser) return 0;
    if (currentUser.uid === 'sindong_admin_default') {
      return reservations.filter((r) => r.status === 'confirmed').length;
    }
    return reservations.filter(
      (r) =>
        r.status === 'confirmed' &&
        ((r.userId && r.userId === currentUser.uid) ||
          (r.userEmail && r.userEmail.toLowerCase() === (currentUser.email || '').toLowerCase()) ||
          (r.userName && currentUser.displayName && r.userName.trim() === currentUser.displayName.trim()))
    ).length;
  }, [currentUser, reservations]);

  useEffect(() => {
    if (selectedRoomFilter !== 'all' && !rooms.some((r) => r.id === selectedRoomFilter)) {
      setSelectedRoomFilter('all');
    }
  }, [rooms, selectedRoomFilter]);

  const periods: PeriodInfo[] = useMemo(() => settingsToPeriods(settings), [settings]);
  const weekDays = useMemo(() => getWeekDays(referenceDate), [referenceDate]);

  const miniCalendarGrid = useMemo(
    () => getMonthCalendarGrid(miniCalYear, miniCalMonth),
    [miniCalYear, miniCalMonth]
  );

  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (!bootstrappedRef.current && roomsLoaded && liveRooms.length === 0) {
      bootstrappedRef.current = true;
      void bootstrapInitialSchoolData();
    }
  }, [roomsLoaded, liveRooms.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const handleMiniMonthChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (miniCalMonth === 1) {
        setMiniCalYear((y) => y - 1);
        setMiniCalMonth(12);
      } else {
        setMiniCalMonth((m) => m - 1);
      }
    } else {
      if (miniCalMonth === 12) {
        setMiniCalYear((y) => y + 1);
        setMiniCalMonth(1);
      } else {
        setMiniCalMonth((m) => m + 1);
      }
    }
  };

  const handleOpenNewModal = (opts?: {
    date?: string;
    period?: number;
    roomId?: string;
    recurring?: boolean;
  }) => {
    setResModalMode('create');
    setSelectedReservation(null);
    setResModalInitialDate(opts?.date || referenceDate);
    setResModalInitialPeriod(opts?.period || 2);
    setResModalInitialRoomId(opts?.roomId || (rooms[0]?.id || ''));
    setResModalInitialRecurrence(opts?.recurring ? 'weekly' : 'none');
    setResModalOpen(true);
  };

  const handleOpenDetailModal = (r: Reservation) => {
    setSelectedReservation(r);
    setResModalMode('detail');
    setResModalInitialDate(r.date);
    setResModalInitialPeriod(r.startPeriod);
    setResModalInitialRoomId(r.roomId);
    setResModalOpen(true);
  };

  const currentSelectedRoom =
    selectedRoomFilter === 'all'
      ? rooms[0]
      : rooms.find((r) => r.id === selectedRoomFilter) || rooms[0];



  const fontClass = 'font-apple-sd';

  return (
    <div className={`min-h-screen bg-[#F8FAFC] p-2.5 sm:p-4 lg:p-6 flex flex-col ${fontClass} text-[#0F172A]`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-white bg-[#1E232A] rounded-2xl shadow-xl transition-all">
          <CheckCircle2 className="w-4 h-4 text-[#86EFAC]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Enclosing Canvas Card matching the reference image */}
      <div className="w-full max-w-[1600px] mx-auto bg-white rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 lg:p-7 shadow-xs border border-[#E2EAE5] flex-1 flex flex-col gap-5">
        {/* ================================================================== */}
        {/* CSS Selector: header.sticky */}
        {/* Modern, clean header matching the reference design */}
        {/* ================================================================== */}
        <header className="sticky top-0 z-30 pb-4 border-b border-[#EEF2F0] flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Logo & School Title Area */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-xl text-[#8A91A0] hover:text-[#1E232A] hover:bg-[#F4F6F8]"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* School Title Area */}
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-black text-[#1E232A] tracking-tight">
                전주신동초 특별실 관리
              </h1>
            </div>
          </div>

          {/* Center Search Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-xl mx-2 sm:mx-6 justify-center">
            {/* Modern pill search bar */}
            <div className="relative w-full max-w-xs sm:max-w-sm">
              <Search className="w-4 h-4 text-[#8A91A0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveNav('all-reservations');
                  }
                }}
                placeholder="특별실, 예약 교사, 학급 검색..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#F4F6F8] hover:bg-[#EEF1F4] border border-[#E5E9EE] rounded-full focus:bg-white focus:outline-none focus:border-[#1E232A] transition-all text-[#1E232A] placeholder-[#8A91A0]"
              />
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark Mode / White Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-full border border-[#E5E9EE] bg-[#F4F6F8] hover:bg-[#EEF1F4] text-[#475467] transition-all cursor-pointer shadow-2xs group"
              title={isDarkMode ? '화이트 모드로 전환' : '다크 모드로 전환'}
              aria-label={isDarkMode ? '화이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#F59E0B] transition-transform group-hover:rotate-45" />
                  <span className="text-xs font-bold text-[#F8FAFC] hidden md:inline">화이트 모드</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#64748B] transition-transform group-hover:-rotate-12" />
                  <span className="text-xs font-bold text-[#475467] hidden md:inline">다크 모드</span>
                </>
              )}
            </button>

            {/* Mint pill action button matching reference image */}
            <button
              type="button"
              onClick={() => handleOpenNewModal()}
              className="inline-flex items-center gap-2 px-4.5 py-2 text-sm sm:text-base font-bold text-[#166534] bg-[#DCFCE7] hover:bg-[#BBF7D0] border border-[#BBF7D0] rounded-full transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>새 예약 등록</span>
            </button>

            {/* Google Authentication / User Profile / Admin Mode */}
            {currentUser.uid === 'sindong_admin_default' ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#E5E9EE] dark:border-[#243048]">
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalError(null);
                    setLoginModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] text-xs font-bold text-[#1E232A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#2A374F] shadow-2xs transition-all cursor-pointer"
                  title="Google 계정 로그인 또는 교사 성함 설정"
                >
                  <User className="w-3.5 h-3.5 text-[#8055E8]" />
                  <span>계정 연결</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-[#E5E9EE] dark:border-[#243048]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F4F6F8] dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] text-xs sm:text-sm font-bold text-[#1E232A] dark:text-[#F8FAFC]">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || ''}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-[#8055E8] text-white flex items-center justify-center text-[10px] font-bold">
                      {(currentUser.displayName || '선')[0]}
                    </span>
                  )}
                  <span className="max-w-[110px] truncate">
                    {safeTeacherDisplayName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-full border border-[#CBD5E1] dark:border-[#334155] bg-[#F4F6F8] dark:bg-[#1E293B] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-[#64748B] transition-all cursor-pointer shadow-2xs"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ================================================================== */}
        {/* Content Layout: Left Sidebar + Right Main Panel */}
        {/* ================================================================== */}
        <div className="flex-1 flex gap-5 overflow-hidden">
          {/* ================================================================ */}
          {/* CSS Selector: aside.bg-white */}
          {/* Sidebar with roomy item spacing & soft charcoal active badge */}
          {/* ================================================================ */}
          <aside
            className={`relative bg-gradient-to-r from-[#F8FAFC] to-[#FFFFFF] border-r border-[#EEF2F0] py-2 px-2.5 pr-4 flex flex-col shrink-0 transition-all duration-200 rounded-2xl ${
              sidebarCollapsed ? 'w-16' : 'w-60'
            } hidden lg:flex`}
          >
            {/* Middle Collapse / Expand Toggle Button on Sidebar Border */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] shadow-md hover:shadow-lg hover:bg-[#F8FAFC] dark:hover:bg-[#2A374F] text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-all cursor-pointer group focus:outline-none focus:ring-0"
              title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
              aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 transition-transform group-hover:scale-110" />
              ) : (
                <ChevronLeft className="w-4 h-4 transition-transform group-hover:scale-110" />
              )}
            </button>

            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
              {/* Group 1: 학교 업무 */}
              <div className="space-y-1.5">
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1 text-xs font-bold tracking-wider text-[#64748B] uppercase">
                    학교 업무
                  </div>
                )}
                <SidebarItem
                  icon={<LayoutDashboard className="w-4.5 h-4.5" />}
                  label="홈 대시보드"
                  active={activeNav === 'dashboard'}
                  collapsed={sidebarCollapsed}
                  onClick={() => setActiveNav('dashboard')}
                />
                <SidebarItem
                  icon={<CalendarDays className="w-4.5 h-4.5" />}
                  label="월간 예약 달력"
                  active={activeNav === 'calendar'}
                  collapsed={sidebarCollapsed}
                  onClick={() => {
                    setSelectedRoomFilter('all');
                    setActiveNav('calendar');
                  }}
                />
              </div>

              {/* Group 2: 예약 관리 */}
              <div className="space-y-1.5">
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1 text-xs font-bold tracking-wider text-[#64748B] uppercase">
                    예약 관리
                  </div>
                )}
                <SidebarItem
                  icon={<User className="w-4.5 h-4.5" />}
                  label="내 예약 모아보기"
                  badge={myReservationCount}
                  active={activeNav === 'my-reservations'}
                  collapsed={sidebarCollapsed}
                  onClick={() => setActiveNav('my-reservations')}
                />
                <SidebarItem
                  icon={<ListChecks className="w-4.5 h-4.5" />}
                  label="전체 예약 목록"
                  active={activeNav === 'all-reservations'}
                  collapsed={sidebarCollapsed}
                  onClick={() => setActiveNav('all-reservations')}
                />
              </div>

              {/* Group 3: 시설 관리 */}
              <div className="space-y-1.5">
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1 text-xs font-bold tracking-wider text-[#64748B] uppercase">
                    시설 관리
                  </div>
                )}
                <SidebarItem
                  icon={<Settings className="w-4.5 h-4.5" />}
                  label="특별실 관리"
                  active={activeNav === 'room-manage'}
                  collapsed={sidebarCollapsed}
                  onClick={() => setActiveNav('room-manage')}
                />
              </div>

              {/* Group 4: 운영 관리 */}
              <div className="space-y-1.5">
                {!sidebarCollapsed && (
                  <div className="px-3 pb-1 text-xs font-bold tracking-wider text-[#64748B] uppercase">
                    운영 관리
                  </div>
                )}
                <SidebarItem
                  icon={<Megaphone className="w-4.5 h-4.5" />}
                  label="공지사항"
                  active={activeNav === 'announcements'}
                  collapsed={sidebarCollapsed}
                  onClick={() => setActiveNav('announcements')}
                />
                <SidebarItem
                  icon={<Clock className="w-4 h-4" />}
                  label="시간표 시정 설정"
                  active={activeNav === 'system-settings'}
                  collapsed={sidebarCollapsed}
                  onClick={() => setActiveNav('system-settings')}
                />
              </div>
            </div>

            {/* Bottom Profile Box */}
            {!sidebarCollapsed && (
              <div
                onClick={() => {
                  if (!currentUser) {
                    setLoginModalError(null);
                    setLoginModalOpen(true);
                  }
                }}
                className={`mt-4 p-3 rounded-2xl bg-[#F4F6F8] dark:bg-[#1E293B] border border-[#E5E9EE] dark:border-[#334155] flex items-center gap-3 ${
                  !currentUser ? 'cursor-pointer hover:border-[#8055E8] transition-colors group' : ''
                }`}
              >
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#E8DEF8] dark:bg-purple-950 text-[#5B3FB8] dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#1E232A] dark:text-[#F8FAFC] truncate">
                    {safeTeacherDisplayName}
                  </div>
                  <div className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                    특별실 통합 관리
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div
                className="fixed inset-0 bg-black/40"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative w-64 bg-gradient-to-r from-[#F8FAFC] to-[#FFFFFF] h-full flex flex-col p-5 shadow-2xl z-10">
                <div className="flex items-center justify-between pb-3 border-b border-[#EEF2F0]">
                  <span className="font-bold text-sm text-[#1E232A]">전주신동초 메뉴</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="p-1.5 rounded-lg border border-[#E5E9EE] bg-[#F4F6F8] text-[#475467]"
                      title={isDarkMode ? '화이트 모드로 전환' : '다크 모드로 전환'}
                    >
                      {isDarkMode ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4 text-[#64748B]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1 text-[#8A91A0]"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="py-4 space-y-4 flex-1 overflow-y-auto">
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-[#98A2B3] uppercase">학교 업무</div>
                    <SidebarItem
                      icon={<LayoutDashboard className="w-4 h-4" />}
                      label="홈 대시보드"
                      active={activeNav === 'dashboard'}
                      onClick={() => {
                        setActiveNav('dashboard');
                        setMobileMenuOpen(false);
                      }}
                    />
                    <SidebarItem
                      icon={<CalendarDays className="w-4 h-4" />}
                      label="월간 예약 달력"
                      active={activeNav === 'calendar'}
                      onClick={() => {
                        setSelectedRoomFilter('all');
                        setActiveNav('calendar');
                        setMobileMenuOpen(false);
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-[#98A2B3] uppercase">예약 관리</div>
                    <SidebarItem
                      icon={<User className="w-4 h-4" />}
                      label="내 예약 모아보기"
                      badge={myReservationCount}
                      active={activeNav === 'my-reservations'}
                      onClick={() => {
                        setActiveNav('my-reservations');
                        setMobileMenuOpen(false);
                      }}
                    />
                    <SidebarItem
                      icon={<ListChecks className="w-4 h-4" />}
                      label="전체 예약 목록"
                      active={activeNav === 'all-reservations'}
                      onClick={() => {
                        setActiveNav('all-reservations');
                        setMobileMenuOpen(false);
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-[#98A2B3] uppercase">시설 관리</div>
                    <SidebarItem
                      icon={<Settings className="w-4 h-4" />}
                      label="특별실 관리"
                      active={activeNav === 'room-manage'}
                      onClick={() => {
                        setActiveNav('room-manage');
                        setMobileMenuOpen(false);
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-[#98A2B3] uppercase">운영 관리</div>
                    <SidebarItem
                      icon={<Megaphone className="w-4 h-4" />}
                      label="공지사항"
                      active={activeNav === 'announcements'}
                      onClick={() => {
                        setActiveNav('announcements');
                        setMobileMenuOpen(false);
                      }}
                    />
                    <SidebarItem
                      icon={<Clock className="w-4 h-4" />}
                      label="시간표 시정 설정"
                      active={activeNav === 'system-settings'}
                      onClick={() => {
                        setActiveNav('system-settings');
                        setMobileMenuOpen(false);
                      }}
                    />
                  </div>
                </div>

                {/* Mobile Drawer Auth Footer */}
                <div className="pt-4 border-t border-[#EEF2F0] dark:border-[#334155]">
                  {currentUser.uid === 'sindong_admin_default' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setLoginModalError(null);
                        setLoginModalOpen(true);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#8055E8] hover:bg-[#6D42D4] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <User className="w-4 h-4" />
                      <span>교직원 / Google 로그인</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[#F4F6F8] dark:bg-[#1E293B]">
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-[#1E232A] dark:text-[#F8FAFC] truncate">
                          {safeTeacherDisplayName}
                        </div>
                        <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                          전주신동초 교직원
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold"
                        title="로그아웃"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* Main Workspace Area */}
          {/* ================================================================ */}
          <main className="flex-1 overflow-y-auto space-y-5">
            {/* Conditional Views */}
            {activeNav === 'calendar' && (
              <MonthlyCalendarView
                referenceDate={referenceDate}
                onSelectDateToTimetable={(d) => {
                  setReferenceDate(d);
                  setActiveNav('dashboard');
                }}
                reservations={reservations}
                rooms={rooms}
                selectedRoomFilter={selectedRoomFilter}
                onChangeRoomFilter={setSelectedRoomFilter}
                onSwitchViewMode={(mode) => {
                  setCalendarViewMode(mode);
                  setActiveNav('dashboard');
                }}
                periods={periods}
                onClickReservation={handleOpenDetailModal}
              />
            )}

            {(activeNav === 'all-reservations' ||
              activeNav === 'recurring-reservations' ||
              activeNav === 'my-reservations') && (
              <ReservationListView
                mode={
                  activeNav === 'my-reservations'
                    ? 'my'
                    : activeNav === 'recurring-reservations'
                    ? 'recurring'
                    : 'all'
                }
                currentUser={currentUser}
                onLogin={() => {
                  setLoginModalError(null);
                  setLoginModalOpen(true);
                }}
                reservations={reservations}
                rooms={rooms}
                periods={periods}
                initialSearch={searchQuery}
                onOpenNewModal={(recurring) => handleOpenNewModal({ recurring })}
                onSelectReservation={handleOpenDetailModal}
                onSuccessMessage={showToast}
              />
            )}

            {(activeNav === 'room-list' || activeNav === 'room-manage') && (
              <RoomDirectoryAndManageView
                isManageMode={activeNav === 'room-manage'}
                rooms={rooms}
                reservations={reservations}
                periods={periods}
                referenceDate={referenceDate}
                onQuickReserveRoom={(roomId) => handleOpenNewModal({ roomId })}
                onSelectReservation={handleOpenDetailModal}
                onSuccessMessage={showToast}
              />
            )}

            {activeNav === 'announcements' && (
              <AnnouncementsView
                announcements={announcements}
                onSuccessMessage={showToast}
              />
            )}

            {activeNav === 'system-settings' && (
              <SystemSettingsView
                settings={settings}
                auditLogs={auditLogs}
                onSuccessMessage={showToast}
              />
            )}

            {/* Dashboard & Timetable (Primary Screen matching the reference design layout) */}
            {(activeNav === 'dashboard' || activeNav === 'timetable') && (
              <div className="w-full space-y-4">
                {/* Timetable Date Navigator Header */}
                    <div className="p-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#F8FAFC] to-[#FFFFFF] border border-[#CBD5E1] dark:border-[#243048] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-extrabold text-[#1E232A] dark:text-[#F8FAFC] tracking-tight tabular-nums">
                          {calendarViewMode === 'week'
                            ? formatWeekRangeLabel(referenceDate)
                            : formatKoreanDate(referenceDate)}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const delta = calendarViewMode === 'week' ? -7 : -1;
                              setReferenceDate(addDays(referenceDate, delta));
                            }}
                            className="p-1 rounded-lg border border-[#CBD5E1] dark:border-[#2E3E5B] hover:bg-[#F4F6F8] dark:hover:bg-[#1A2234] text-[#1E232A] dark:text-[#F8FAFC] transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const delta = calendarViewMode === 'week' ? 7 : 1;
                              setReferenceDate(addDays(referenceDate, delta));
                            }}
                            className="p-1 rounded-lg border border-[#CBD5E1] dark:border-[#2E3E5B] hover:bg-[#F4F6F8] dark:hover:bg-[#1A2234] text-[#1E232A] dark:text-[#F8FAFC] transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReferenceDate(getTodayStr())}
                            className="px-2.5 py-1 text-xs font-bold text-[#1E232A] dark:text-[#F8FAFC] bg-[#F4F6F8] dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] rounded-lg hover:bg-[#E9ECEF] dark:hover:bg-[#222D42] transition-colors cursor-pointer"
                          >
                            오늘
                          </button>
                        </div>
                      </div>

                       {/* Day vs Week vs Month view toggle */}
                      <div className="flex items-center p-0.5 bg-[#F4F6F8] dark:bg-[#161F32] border border-[#CBD5E1] dark:border-[#243048] rounded-full text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomFilter('all');
                            setCalendarViewMode('day');
                          }}
                          className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                            calendarViewMode === 'day'
                              ? 'bg-white dark:bg-[#2563EB] text-[#1E232A] dark:text-white shadow-xs border border-[#CBD5E1] dark:border-transparent'
                              : 'text-[#667085] dark:text-[#94A3B8] hover:text-[#1E232A] dark:hover:text-white border border-transparent'
                          }`}
                        >
                          일간 보기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomFilter('all');
                            setCalendarViewMode('week');
                          }}
                          className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                            calendarViewMode === 'week'
                              ? 'bg-white dark:bg-[#2563EB] text-[#1E232A] dark:text-white shadow-xs border border-[#CBD5E1] dark:border-transparent'
                              : 'text-[#667085] dark:text-[#94A3B8] hover:text-[#1E232A] dark:hover:text-white border border-transparent'
                          }`}
                        >
                          주간 보기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomFilter('all');
                            setActiveNav('calendar');
                          }}
                          className="px-3 py-1 rounded-full text-[#667085] dark:text-[#94A3B8] hover:text-[#1E232A] dark:hover:text-white transition-all cursor-pointer border border-transparent"
                        >
                          월간 보기
                        </button>
                      </div>
                    </div>

                    {/* Special Room Filter Bar (전체보기 기본 + 특별실별 필터링) */}
                    <div className="p-3 px-4 rounded-2xl bg-gradient-to-r from-[#F8FAFC] to-[#FFFFFF] border border-[#E2E8F0] dark:border-[#243048] flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-[#475467] dark:text-[#94A3B8] mr-1.5">
                          특별실 필터:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRoomFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedRoomFilter === 'all'
                              ? 'bg-[#1E232A] text-white shadow-xs border border-[#1E232A] dark:bg-[#2563EB] dark:border-[#2563EB]'
                              : 'bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] text-[#475467] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#222D42]'
                          }`}
                        >
                          전체보기
                        </button>
                        {rooms
                          .filter((r) => r.active)
                          .map((room) => {
                            const c =
                              ROOM_COLOR_PALETTE[room.colorKey] || ROOM_COLOR_PALETTE.purple;
                            const isSelected = selectedRoomFilter === room.id;
                            return (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => setSelectedRoomFilter(room.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? `${c.bg} ${c.border} ${c.text} shadow-xs font-extrabold border-2`
                                    : 'bg-white dark:bg-[#1A2234] border border-[#CBD5E1] dark:border-[#2E3E5B] text-[#475467] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#222D42]'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${c.badgeBg}`} />
                                {room.name}
                              </button>
                            );
                          })}
                      </div>

                      {selectedRoomFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setSelectedRoomFilter('all')}
                          className="text-xs font-semibold text-[#667085] hover:text-[#1E232A] underline cursor-pointer"
                        >
                          전체보기로 초기화
                        </button>
                      )}
                    </div>

                    {/* Week Columns (Monday ~ Friday) */}
                    {calendarViewMode === 'week' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        {weekDays.map((day) => {
                          const dayReservations = reservations.filter(
                            (r) =>
                              r.status === 'confirmed' &&
                              r.date === day.date &&
                              (selectedRoomFilter === 'all' || r.roomId === selectedRoomFilter)
                          );
                          const isDayActive = day.date === referenceDate;

                          return (
                            <div key={day.date} className="flex flex-col space-y-2.5">
                              {/* Column Header matching MON 20 style */}
                              <div
                                onClick={() => setReferenceDate(day.date)}
                                className={`p-2 rounded-2xl text-center cursor-pointer transition-colors ${
                                  day.isToday
                                    ? 'bg-[#EAF7EE] dark:bg-emerald-950/45 border-2 border-[#166534] dark:border-emerald-600'
                                    : isDayActive
                                    ? 'bg-[#F1F4F9] dark:bg-[#1E293B] border-2 border-[#1E232A] dark:border-[#38BDF8]'
                                    : 'bg-white/60 dark:bg-[#111827]/60 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#243048]'
                                }`}
                              >
                                <div className="text-[10px] font-bold text-[#8A91A0] uppercase tracking-wider">
                                  {day.dayName}
                                </div>
                                <div className="mt-0.5 flex items-center justify-center">
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 text-xs font-extrabold rounded-full tabular-nums ${
                                      day.isToday
                                        ? 'bg-[#166534] text-white shadow-xs'
                                        : isDayActive
                                        ? 'bg-[#1E232A] text-white'
                                        : 'text-[#1E232A]'
                                    }`}
                                  >
                                    {Number(day.date.split('-')[2])}
                                  </span>
                                </div>
                              </div>

                              {/* 1 ~ 6교시 및 점심시간 Slot Cards styled as pastel cards */}
                              <div className="flex flex-col space-y-2">
                                {periods.map((p) => {
                                  const matchingRes = dayReservations.filter((r) =>
                                    isPeriodInReservation(p.period, r.startPeriod, r.endPeriod)
                                  );

                                  if (matchingRes.length > 0) {
                                    return (
                                      <div key={p.period} className="space-y-1.5">
                                        {matchingRes.map((r) => {
                                          const c =
                                            ROOM_COLOR_PALETTE[r.roomColor] ||
                                            ROOM_COLOR_PALETTE.purple;
                                          return (
                                            <div
                                              key={r.id}
                                              onClick={() => handleOpenDetailModal(r)}
                                              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all hover:scale-[1.01] shadow-2xs ${c.bg} ${c.border}`}
                                            >
                                              <div className="flex items-center justify-between text-[11px] font-bold text-[#667085] dark:text-[#94A3B8]">
                                                <span>{p.label}</span>
                                                <span className="tabular-nums text-[10px]">
                                                  {p.startTime}~{p.endTime}
                                                </span>
                                              </div>
                                              <div className="mt-1.5 flex items-center justify-between gap-1.5 min-w-0">
                                                <div className="font-extrabold text-xs text-[#1E232A] dark:text-[#F8FAFC] truncate">
                                                  {r.roomName}
                                                </div>
                                                <div className="text-[11px] font-semibold text-[#475467] dark:text-[#94A3B8] shrink-0 whitespace-nowrap">
                                                  {r.classLabel}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }

                                  // Empty Slot (clickable button card)
                                  return (
                                    <button
                                      key={p.period}
                                      type="button"
                                      onClick={() =>
                                        handleOpenNewModal({
                                          date: day.date,
                                          period: p.period,
                                          roomId:
                                            selectedRoomFilter !== 'all'
                                              ? selectedRoomFilter
                                              : undefined,
                                        })
                                      }
                                      className="group w-full py-2.5 px-3 rounded-2xl border border-[#CBD5E1] dark:border-[#243048] bg-white dark:bg-[#141C2E] hover:border-[#1E232A] dark:hover:border-[#38BDF8] hover:bg-[#F8FAFC] dark:hover:bg-[#1A243B] text-[#1E232A] font-medium text-xs transition-all text-center flex items-center justify-between cursor-pointer"
                                    >
                                      <span className="font-bold text-[#475467] group-hover:text-[#1E232A]">
                                        {p.label}
                                      </span>
                                      <span className="text-[10px] text-[#98A2B3] group-hover:text-[#1E232A] tabular-nums">
                                        {p.startTime}~{p.endTime}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Day View */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {rooms
                          .filter(
                            (r) => selectedRoomFilter === 'all' || r.id === selectedRoomFilter
                          )
                          .map((room) => {
                            const c =
                              ROOM_COLOR_PALETTE[room.colorKey] || ROOM_COLOR_PALETTE.purple;
                            const roomDayRes = reservations.filter(
                              (r) =>
                                r.status === 'confirmed' &&
                                r.date === referenceDate &&
                                r.roomId === room.id
                            );

                            return (
                              <div
                                key={room.id}
                                className="p-4 rounded-2xl border border-[#CBD5E1] dark:border-[#243048] bg-gradient-to-r from-[#F8FAFC] to-[#FFFFFF] dark:from-[#111827] dark:to-[#161F32] space-y-3 shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${c.badgeBg}`} />
                                    <span className="font-bold text-sm text-[#1E232A]">
                                      {room.name}
                                    </span>
                                    <span className="text-xs text-[#8A91A0]">({room.floor})</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenNewModal({
                                        date: referenceDate,
                                        roomId: room.id,
                                      })
                                    }
                                    className="text-xs font-bold text-[#166534] bg-[#DCFCE7] px-2.5 py-1 rounded-full cursor-pointer hover:bg-[#BBF7D0] transition-colors"
                                  >
                                    + 예약
                                  </button>
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                                  {periods.map((p) => {
                                    const res = roomDayRes.find((r) =>
                                      isPeriodInReservation(p.period, r.startPeriod, r.endPeriod)
                                    );
                                    if (res) {
                                      return (
                                        <div
                                          key={p.period}
                                          onClick={() => handleOpenDetailModal(res)}
                                          className={`p-2 rounded-xl border text-center cursor-pointer text-[11px] truncate ${c.bg} ${c.border}`}
                                          title={`${p.label} (${p.startTime}~${p.endTime}) · ${res.classLabel}`}
                                        >
                                          <div className="font-bold text-[#1E232A]">
                                            {p.label}
                                          </div>
                                          <div className="text-[9px] text-[#667085] tabular-nums">
                                            {p.startTime}~{p.endTime}
                                          </div>
                                          <div className="text-[10px] text-[#475467] font-semibold truncate mt-0.5">
                                            {res.classLabel}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <button
                                        key={p.period}
                                        type="button"
                                        onClick={() =>
                                          handleOpenNewModal({
                                            date: referenceDate,
                                            period: p.period,
                                            roomId: room.id,
                                          })
                                        }
                                        title={`${p.label} (${p.startTime}~${p.endTime})`}
                                        className="p-2 rounded-xl border border-[#CBD5E1] dark:border-[#243048] bg-white dark:bg-[#141C2E] hover:border-[#1E232A] dark:hover:border-[#38BDF8] hover:bg-[#F8FAFC] dark:hover:bg-[#1A243B] text-center text-[11px] transition-colors cursor-pointer"
                                      >
                                        <div className="font-semibold text-[#1E232A]">
                                          {p.label}
                                        </div>
                                        <div className="text-[9px] text-[#667085] tabular-nums">
                                          {p.startTime}~{p.endTime}
                                        </div>
                                        <div className="text-[10px] text-[#166534] font-medium mt-0.5">
                                          가능
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* Reservation Modal (Create / Detail / Edit) */}
      {/* ==================================================================== */}
      <ReservationModal
        isOpen={resModalOpen}
        onClose={() => {
          setResModalOpen(false);
          setSelectedReservation(null);
        }}
        mode={resModalMode}
        initialDate={resModalInitialDate}
        initialPeriod={resModalInitialPeriod}
        initialRoomId={resModalInitialRoomId}
        initialRecurrence={resModalInitialRecurrence}
        selectedReservation={selectedReservation}
        rooms={rooms}
        reservations={reservations}
        periods={periods}
        currentUser={currentUser}
        onSuccessMessage={showToast}
      />

      {/* ==================================================================== */}
      {/* Google Login & Quick Teacher Login Modal */}
      {/* ==================================================================== */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          showToast(`${user.displayName} 선생님, 환영합니다!`);
        }}
        initialError={loginModalError}
      />
    </div>
  );
}

// ============================================================================
// Sidebar Navigation Item Helper
// With roomy item spacing and soft charcoal active badge matching reference image
// ============================================================================
function SidebarItem({
  icon,
  label,
  badge,
  active = false,
  collapsed = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm sm:text-[15px] font-semibold rounded-2xl transition-all cursor-pointer ${
        active
          ? 'bg-[#1E232A] text-white font-bold shadow-xs sidebar-active-tab'
          : 'text-[#475467] hover:text-[#1E232A] hover:bg-[#F4F6F8] dark:hover:bg-[#1E293B]'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <div className="flex items-center gap-3 truncate">
        <span className="shrink-0 [&>svg]:w-4.5 [&>svg]:h-4.5">{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>
      {!collapsed && badge !== undefined && Number(badge) > 0 && (
        <span
          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-[#DCFCE7] text-[#166534] dark:bg-emerald-950 dark:text-emerald-300'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
