import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ADMIN_EMAILS,
  db,
  handleFirestoreError,
  OperationType,
  SCHOOL_ID,
  FirebaseUser,
} from '../firebase';
import {
  Announcement,
  AppUser,
  AuditLog,
  Reservation,
  RoomColorKey,
  SchoolSettings,
  SpecialRoom,
} from '../types';
import {
  addDays,
  DEFAULT_SCHOOL_SETTINGS,
  formatPeriodLabel,
  formatPeriodRangeLabel,
  getMondayOfWeek,
  getPeriodsInRange,
  getTodayStr,
} from '../utils/dateAndConflict';

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function sanitizeStr(val: string, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

export function buildSlotKey(roomId: string, date: string, period: number): string {
  const key = `${sanitizeId(roomId)}_${date}_p${period}`;
  return ID_REGEX.test(key) ? key.slice(0, 128) : sanitizeId(key);
}

// Initial 8 special rooms in Jeonju Sindong Elementary School
export const INITIAL_SPECIAL_ROOMS: Omit<SpecialRoom, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'room_science_1',
    schoolId: SCHOOL_ID,
    name: '과학실 1',
    category: '과학',
    colorKey: 'purple',
    location: '본관 동편',
    floor: '2층',
    capacity: 30,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '전자칠판, 실험대 8조, 현미경 24대, 안전장구 세트',
    managerName: '김민수 (과학전담)',
    guidelines: '실험 전 안전수칙 교육 필수, 실험 후 싱크대 정리 확인',
    active: true,
  },
  {
    id: 'room_science_2',
    schoolId: SCHOOL_ID,
    name: '과학실 2',
    category: '과학',
    colorKey: 'cyan',
    location: '본관 동편',
    floor: '3층',
    capacity: 30,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '전자칠판, 실험대 8조, 지구과학 모형, 스마트 패드 충전함',
    managerName: '박지훈 (과학정보부)',
    guidelines: '고학년 탐구 실험 우선 배정, 환기 창문 잠금 확인',
    active: true,
  },
  {
    id: 'room_music_1',
    schoolId: SCHOOL_ID,
    name: '음악실',
    category: '음악',
    colorKey: 'teal',
    location: '후관 서편',
    floor: '4층',
    capacity: 32,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '그랜드 피아노, 전자칠판, 장구·소고 국악기 30세트, 오르프 악기',
    managerName: '이서연 (음악전담)',
    guidelines: '실내화 착용 필수, 악기 사용 후 보관함 정리',
    active: true,
  },
  {
    id: 'room_art_1',
    schoolId: SCHOOL_ID,
    name: '미술실',
    category: '미술',
    colorKey: 'amber',
    location: '본관 서편',
    floor: '3층',
    capacity: 30,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '미술 작업대 8조, 건조대, 찰흙·판화 도구, 대형 세척 싱크대',
    managerName: '최유진 (미술교과)',
    guidelines: '물감·점토 수업 후 싱크대 거름망 비우기',
    active: true,
  },
  {
    id: 'room_computer_1',
    schoolId: SCHOOL_ID,
    name: '컴퓨터실',
    category: '정보',
    colorKey: 'blue',
    location: '본관 중앙',
    floor: '4층',
    capacity: 32,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '학생용 PC 31대, 교사용 제어 PC, 전자칠판, 코딩 로봇',
    managerName: '박지훈 (과학정보부)',
    guidelines: '음식물 반입 금지, 퇴실 시 PC 전원 종료 및 의자 정리',
    active: true,
  },
  {
    id: 'room_library',
    schoolId: SCHOOL_ID,
    name: '도서실 (꿈자람터)',
    category: '도서',
    colorKey: 'emerald',
    location: '본관 중앙',
    floor: '1층',
    capacity: 40,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '빔프로젝터, 모둠 독서 테이블, 도서 검색대 3대, 온돌 열람 공간',
    managerName: '정하늘 (사서교사)',
    guidelines: '도서관 활용 수업 시 사전 예약 필수',
    active: true,
  },
  {
    id: 'room_gym',
    schoolId: SCHOOL_ID,
    name: '강당 (신동관)',
    category: '체육',
    colorKey: 'rose',
    location: '별관 체육관동',
    floor: '2층',
    capacity: 150,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '방송 음향 설비, 대형 전동 스크린, 농구대, 배드민턴 지주대',
    managerName: '강동현 (체육교육부)',
    guidelines: '체육관 실내화 착용, 대형 조명 및 냉난방기 소등 확인',
    active: true,
  },
  {
    id: 'room_av',
    schoolId: SCHOOL_ID,
    name: '시청각실',
    category: '시청각',
    colorKey: 'indigo',
    location: '후관 동편',
    floor: '1층',
    capacity: 90,
    availablePeriods: [1, 2, 3, 4, 7, 5, 6],
    equipment: '레이저 프로젝터, 무선 마이크 4채널, 계단식 좌석 90석',
    managerName: '한지민 (교무기획부)',
    guidelines: '학년 다모임, 초청 강연, 교직원 연수 우선 예약',
    active: true,
  },
];

export function buildDemoPreviewData(referenceDate = getTodayStr()): {
  rooms: SpecialRoom[];
  reservations: Reservation[];
  announcements: Announcement[];
  settings: SchoolSettings;
} {
  const monday = getMondayOfWeek(referenceDate);
  const tue = addDays(monday, 1);
  const wed = addDays(monday, 2);
  const thu = addDays(monday, 3);
  const fri = addDays(monday, 4);

  const rooms: SpecialRoom[] = INITIAL_SPECIAL_ROOMS.map((r) => ({ ...r }));

  const reservations: Reservation[] = [
    {
      id: 'demo_res_1',
      schoolId: SCHOOL_ID,
      roomId: 'room_science_1',
      roomName: '과학실 1',
      roomCategory: '과학',
      roomColor: 'purple',
      userName: '김민수',
      date: monday,
      startPeriod: 2,
      endPeriod: 3,
      grade: 5,
      classNum: 2,
      classLabel: '5학년 2반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'timetable',
    },
    {
      id: 'demo_res_2',
      schoolId: SCHOOL_ID,
      roomId: 'room_music_1',
      roomName: '음악실',
      roomCategory: '음악',
      roomColor: 'teal',
      userName: '이서연',
      date: monday,
      startPeriod: 4,
      endPeriod: 4,
      grade: 4,
      classNum: 1,
      classLabel: '4학년 1반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'manual',
    },
    {
      id: 'demo_res_3',
      schoolId: SCHOOL_ID,
      roomId: 'room_computer_1',
      roomName: '컴퓨터실',
      roomCategory: '정보',
      roomColor: 'blue',
      userName: '박지훈',
      date: tue,
      startPeriod: 1,
      endPeriod: 2,
      grade: 6,
      classNum: 3,
      classLabel: '6학년 3반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'ai',
    },
    {
      id: 'demo_res_4',
      schoolId: SCHOOL_ID,
      roomId: 'room_art_1',
      roomName: '미술실',
      roomCategory: '미술',
      roomColor: 'amber',
      userName: '최유진',
      date: tue,
      startPeriod: 3,
      endPeriod: 4,
      grade: 5,
      classNum: 4,
      classLabel: '5학년 4반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'timetable',
    },
    {
      id: 'demo_res_5',
      schoolId: SCHOOL_ID,
      roomId: 'room_library',
      roomName: '도서실 (꿈자람터)',
      roomCategory: '도서',
      roomColor: 'emerald',
      userName: '정하늘',
      date: wed,
      startPeriod: 2,
      endPeriod: 2,
      grade: 3,
      classNum: 2,
      classLabel: '3학년 2반',
      status: 'confirmed',
      seriesId: 'series_wed_lib',
      recurrenceSummary: '매주 수요일 2교시',
      source: 'manual',
    },
    {
      id: 'demo_res_6',
      schoolId: SCHOOL_ID,
      roomId: 'room_gym',
      roomName: '강당 (신동관)',
      roomCategory: '체육',
      roomColor: 'rose',
      userName: '강동현',
      date: wed,
      startPeriod: 3,
      endPeriod: 4,
      grade: 6,
      classNum: 1,
      classLabel: '6학년 1반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'timetable',
    },
    {
      id: 'demo_res_7',
      schoolId: SCHOOL_ID,
      roomId: 'room_science_2',
      roomName: '과학실 2',
      roomCategory: '과학',
      roomColor: 'cyan',
      userName: '김민수',
      date: thu,
      startPeriod: 2,
      endPeriod: 3,
      grade: 5,
      classNum: 1,
      classLabel: '5학년 1반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'ai',
    },
    {
      id: 'demo_res_8',
      schoolId: SCHOOL_ID,
      roomId: 'room_av',
      roomName: '시청각실',
      roomCategory: '시청각',
      roomColor: 'indigo',
      userName: '한지민',
      date: fri,
      startPeriod: 5,
      endPeriod: 6,
      grade: 6,
      classNum: 2,
      classLabel: '6학년 2반',
      status: 'confirmed',
      seriesId: '',
      recurrenceSummary: '',
      source: 'manual',
    },
  ];

  const announcements: Announcement[] = [
    {
      id: 'demo_ann_1',
      schoolId: SCHOOL_ID,
      title: '[안내] 전주신동초 특별실 시간표 예약 시스템 오픈 안내',
      content:
        '전주신동초등학교 교직원 누구나 로그인 없이 특별실을 조회하고 편리하게 예약할 수 있습니다. 수업 후 정리정돈 및 소등을 부탁드립니다.',
      category: 'general',
      pinned: true,
      authorName: '교무기획부',
    },
  ];

  return {
    rooms,
    reservations,
    announcements,
    settings: DEFAULT_SCHOOL_SETTINGS,
  };
}

// Bootstrap Initial Data to Firebase
export async function bootstrapInitialSchoolData(): Promise<void> {
  const preview = buildDemoPreviewData(getTodayStr());

  // Check if settings document already exists
  let settingsSnap;
  const settingsRef = doc(db, 'settings', 'school_config');
  try {
    settingsSnap = await getDoc(settingsRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/school_config');
  }

  const settingsExists = settingsSnap?.exists() ?? false;
  const settingsData = settingsExists ? settingsSnap?.data() : null;

  // Check existing room documents
  let existingRoomIds = new Set<string>();
  try {
    const roomsSnap = await getDocs(collection(db, 'rooms'));
    existingRoomIds = new Set(roomsSnap.docs.map((d) => d.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'rooms');
  }

  // Batch 1: Seed missing special rooms and default settings
  const batch1 = writeBatch(db);
  let batch1Count = 0;

  for (const room of INITIAL_SPECIAL_ROOMS) {
    if (!existingRoomIds.has(room.id)) {
      const roomRef = doc(db, 'rooms', room.id);
      batch1.set(roomRef, {
        ...room,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch1Count++;
    }
  }

  if (!settingsExists) {
    batch1.set(settingsRef, {
      ...DEFAULT_SCHOOL_SETTINGS,
      updatedBy: '신동초 교직원',
      updatedAt: serverTimestamp(),
    });
    batch1Count++;
  }

  if (batch1Count > 0) {
    try {
      await batch1.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'bootstrapRoomsAndSettings');
    }
  }

  // If settings existed prior to bootstrap or sample was cleared, DO NOT re-seed sample data!
  if (settingsExists || settingsData?.sampleCleared) {
    return;
  }

  // Seed sample announcements if empty
  let existingAnnIds = new Set<string>();
  try {
    const annSnap = await getDocs(collection(db, 'announcements'));
    existingAnnIds = new Set(annSnap.docs.map((d) => d.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'announcements');
  }

  if (existingAnnIds.size === 0) {
    const batchAnn = writeBatch(db);
    for (const ann of preview.announcements) {
      const annRef = doc(db, 'announcements', ann.id);
      batchAnn.set(annRef, {
        ...ann,
        authorName: '교무기획부',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batchAnn.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'bootstrapAnnouncements');
    }
  }

  // Batch 2: Reservations & SlotLocks
  let reservationsEmpty = true;
  try {
    const resSnap = await getDocs(collection(db, 'reservations'));
    reservationsEmpty = resSnap.empty;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reservations');
  }

  if (reservationsEmpty) {
    const batch2 = writeBatch(db);
    for (const resItem of preview.reservations) {
      const resId = sanitizeId(resItem.id);
      const resRef = doc(db, 'reservations', resId);
      batch2.set(resRef, {
        ...resItem,
        id: resId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const p of getPeriodsInRange(resItem.startPeriod, resItem.endPeriod)) {
        const slotKey = buildSlotKey(resItem.roomId, resItem.date, p);
        batch2.set(doc(db, 'slotLocks', slotKey), {
          id: slotKey,
          schoolId: SCHOOL_ID,
          roomId: resItem.roomId,
          date: resItem.date,
          period: p,
          reservationId: resId,
          userName: resItem.userName,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const logId = `log_init_${Date.now()}`;
    batch2.set(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: SCHOOL_ID,
      actorName: '시스템',
      action: 'manage_settings',
      targetId: 'school_config',
      summary: '전주신동초 특별실 관리 초기 데이터(8실·시간표) 세팅 완료',
      createdAt: serverTimestamp(),
    });

    try {
      await batch2.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'bootstrapReservations');
    }
  }
}

// Reset / Clear Default Sample Data from Firestore
export async function resetInitialSampleData(clearAll = false): Promise<{ resDeleted: number; annDeleted: number }> {
  let resDeleted = 0;
  let annDeleted = 0;

  try {
    // 1. Delete target reservations & associated slotLocks
    const resSnap = await getDocs(collection(db, 'reservations'));
    const locksSnap = await getDocs(collection(db, 'slotLocks'));

    const sampleUserNames = [
      '김민수',
      '이서연',
      '박지훈',
      '최유진',
      '정하늘',
      '강동현',
      '한지민',
    ];

    const resDocsToDelete = clearAll
      ? resSnap.docs
      : resSnap.docs.filter((d) => {
          const data = d.data() as Reservation;
          const id = d.id || '';
          const resId = data.id || '';
          const userName = data.userName || '';
          return (
            id.startsWith('demo_res_') ||
            resId.startsWith('demo_res_') ||
            id.startsWith('demo_') ||
            resId.startsWith('demo_') ||
            sampleUserNames.includes(userName)
          );
        });

    const targetResIds = new Set(resDocsToDelete.map((d) => d.id));

    const batchSize = 400;
    for (let i = 0; i < resDocsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = resDocsToDelete.slice(i, i + batchSize);
      for (const d of chunk) {
        batch.delete(d.ref);
        resDeleted++;
      }
      await batch.commit();
    }

    const locksToDelete = locksSnap.docs.filter((d) => {
      const data = d.data();
      const resId = String(data.reservationId || '');
      return (
        clearAll ||
        targetResIds.has(resId) ||
        resId.startsWith('demo_res_') ||
        resId.startsWith('demo_')
      );
    });

    for (let i = 0; i < locksToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = locksToDelete.slice(i, i + batchSize);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    // 2. Delete target announcements
    const annSnap = await getDocs(collection(db, 'announcements'));
    const annDocsToDelete = clearAll
      ? annSnap.docs
      : annSnap.docs.filter((d) => d.id.startsWith('demo_ann_') || d.id === 'demo_ann_1' || d.id.startsWith('demo_'));

    for (let i = 0; i < annDocsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = annDocsToDelete.slice(i, i + batchSize);
      for (const d of chunk) {
        batch.delete(d.ref);
        annDeleted++;
      }
      await batch.commit();
    }

    // 3. Update settings document to mark sampleCleared
    const settingsRef = doc(db, 'settings', 'school_config');
    let existingSettings: Partial<SchoolSettings> = {};
    try {
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        existingSettings = snap.data() as SchoolSettings;
      }
    } catch {
      // Ignore if not existing
    }

    try {
      await setDoc(
        settingsRef,
        {
          ...DEFAULT_SCHOOL_SETTINGS,
          ...existingSettings,
          id: 'school_config',
          schoolId: SCHOOL_ID,
          sampleCleared: true,
          updatedBy: '신동초 교직원',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/school_config');
    }

    // 4. Record Audit Log
    const logId = `log_clear_${Date.now()}`;
    try {
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        schoolId: SCHOOL_ID,
        actorName: '교직원',
        action: 'manage_settings',
        targetId: 'school_config',
        summary: clearAll
          ? `전체 데이터 일괄 초기화 완료 (예약 ${resDeleted}건, 공지 ${annDeleted}건 삭제)`
          : `기본 예시 자료 정리 완료 (예약 ${resDeleted}건, 공지 ${annDeleted}건 삭제)`,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'reservations');
  }

  return { resDeleted, annDeleted };
}

// Atomic Reservation Creation (Without Login Requirement)
export async function createReservationsAtomic(params: {
  room: SpecialRoom;
  dates: string[];
  startPeriod: number;
  endPeriod: number;
  userName: string;
  userId?: string;
  userEmail?: string;
  grade: number;
  classNum: number;
  classLabel: string;
  recurrenceSummary: string;
  source: 'manual' | 'timetable' | 'ai';
}): Promise<string[]> {
  const {
    room,
    dates,
    startPeriod,
    endPeriod,
    userName,
    userId,
    userEmail,
    grade,
    classNum,
    classLabel,
    recurrenceSummary,
    source,
  } = params;

  const seriesId = dates.length > 1 ? `series_${Date.now()}` : '';
  const createdIds: string[] = [];
  const cleanUserName = sanitizeStr(userName, 60, '교사');

  try {
    await runTransaction(db, async (tx) => {
      const slotChecks: Array<{
        slotKey: string;
        date: string;
        period: number;
        reservationId: string;
      }> = [];

      const dateToResId = new Map<string, string>();
      dates.forEach((d, idx) => {
        const resId = `res_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
        dateToResId.set(d, sanitizeId(resId));
      });

      for (const date of dates) {
        const resId = dateToResId.get(date)!;
        for (const p of getPeriodsInRange(startPeriod, endPeriod)) {
          const slotKey = buildSlotKey(room.id, date, p);
          const slotRef = doc(db, 'slotLocks', slotKey);
          const snap = await tx.get(slotRef);
          if (snap.exists()) {
            throw new Error(
              `CONFLICT:${date} ${formatPeriodLabel(p)} ${room.name}은(는) 이미 다른 예약에 의해 예약되어 있습니다.`
            );
          }
          slotChecks.push({ slotKey, date, period: p, reservationId: resId });
        }
      }

      for (const date of dates) {
        const resId = dateToResId.get(date)!;
        createdIds.push(resId);
        const resRef = doc(db, 'reservations', resId);

        tx.set(resRef, {
          id: resId,
          schoolId: SCHOOL_ID,
          roomId: sanitizeId(room.id),
          roomName: sanitizeStr(room.name, 60, '특별실'),
          roomCategory: sanitizeStr(room.category, 40, '기타'),
          roomColor: room.colorKey,
          userName: cleanUserName,
          ...(userId ? { userId: sanitizeId(userId) } : {}),
          ...(userEmail ? { userEmail: sanitizeStr(userEmail, 120) } : {}),
          date,
          startPeriod,
          endPeriod,
          grade: Math.min(Math.max(0, Number(grade) || 0), 6),
          classNum: Math.min(Math.max(0, Number(classNum) || 0), 20),
          classLabel: sanitizeStr(classLabel, 40, `${grade}학년 ${classNum}반`),
          status: 'confirmed',
          seriesId: sanitizeStr(seriesId, 128, ''),
          recurrenceSummary: sanitizeStr(recurrenceSummary, 120, ''),
          source,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (const slot of slotChecks) {
        const slotRef = doc(db, 'slotLocks', slot.slotKey);
        tx.set(slotRef, {
          id: slot.slotKey,
          schoolId: SCHOOL_ID,
          roomId: sanitizeId(room.id),
          date: slot.date,
          period: slot.period,
          reservationId: slot.reservationId,
          userName: cleanUserName,
          updatedAt: serverTimestamp(),
        });
      }

      const logId = `log_create_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      tx.set(doc(db, 'auditLogs', logId), {
        id: logId,
        schoolId: SCHOOL_ID,
        actorName: cleanUserName,
        action: 'create_reservation',
        targetId: createdIds[0],
        summary: sanitizeStr(
          `${room.name} 예약 등록 (${dates[0]}${
            dates.length > 1 ? ` 외 ${dates.length - 1}일` : ''
          } · ${formatPeriodRangeLabel(startPeriod, endPeriod)} · ${classLabel} · ${cleanUserName})`,
          250,
          '예약 등록'
        ),
        createdAt: serverTimestamp(),
      });
    });

    return createdIds;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('CONFLICT:')) {
      throw new Error(err.message.replace('CONFLICT:', ''));
    }
    handleFirestoreError(err, OperationType.CREATE, 'reservations');
  }
}

// Atomic Reservation Update
export async function updateReservationAtomic(params: {
  existing: Reservation;
  room: SpecialRoom;
  date: string;
  startPeriod: number;
  endPeriod: number;
  userName: string;
  grade: number;
  classNum: number;
  classLabel: string;
}): Promise<void> {
  const { existing, room, date, startPeriod, endPeriod, userName, grade, classNum, classLabel } =
    params;
  const cleanUserName = sanitizeStr(userName, 60, existing.userName);

  try {
    await runTransaction(db, async (tx) => {
      const oldSlots: string[] = [];
      for (const p of getPeriodsInRange(existing.startPeriod, existing.endPeriod)) {
        oldSlots.push(buildSlotKey(existing.roomId, existing.date, p));
      }

      const newSlots: Array<{ slotKey: string; period: number }> = [];
      for (const p of getPeriodsInRange(startPeriod, endPeriod)) {
        newSlots.push({
          slotKey: buildSlotKey(room.id, date, p),
          period: p,
        });
      }

      for (const ns of newSlots) {
        if (!oldSlots.includes(ns.slotKey)) {
          const snap = await tx.get(doc(db, 'slotLocks', ns.slotKey));
          if (snap.exists()) {
            const lockData = snap.data();
            if (lockData.reservationId !== existing.id) {
              throw new Error(
                `CONFLICT:${date} ${formatPeriodLabel(ns.period)} ${room.name}은(는) 이미 예약되어 있습니다.`
              );
            }
          }
        }
      }

      const resRef = doc(db, 'reservations', existing.id);
      const resSnap = await tx.get(resRef);

      for (const os of oldSlots) {
        if (!newSlots.some((n) => n.slotKey === os)) {
          tx.delete(doc(db, 'slotLocks', os));
        }
      }

      if (!resSnap.exists()) {
        tx.set(resRef, {
          id: existing.id,
          schoolId: SCHOOL_ID,
          roomId: sanitizeId(room.id),
          roomName: sanitizeStr(room.name, 60, '특별실'),
          roomCategory: sanitizeStr(room.category, 40, '기타'),
          roomColor: room.colorKey,
          userName: cleanUserName,
          date,
          startPeriod,
          endPeriod,
          grade: Math.min(Math.max(0, Number(grade) || 0), 6),
          classNum: Math.min(Math.max(0, Number(classNum) || 0), 20),
          classLabel: sanitizeStr(classLabel, 40, `${grade}학년 ${classNum}반`),
          status: 'confirmed',
          seriesId: sanitizeStr(existing.seriesId || '', 128, ''),
          recurrenceSummary: sanitizeStr(existing.recurrenceSummary || '', 120, ''),
          source: existing.source || 'manual',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(resRef, {
          roomId: sanitizeId(room.id),
          roomName: sanitizeStr(room.name, 60, '특별실'),
          roomCategory: sanitizeStr(room.category, 40, '기타'),
          roomColor: room.colorKey,
          userName: cleanUserName,
          date,
          startPeriod,
          endPeriod,
          grade: Math.min(Math.max(0, Number(grade) || 0), 6),
          classNum: Math.min(Math.max(0, Number(classNum) || 0), 20),
          classLabel: sanitizeStr(classLabel, 40, `${grade}학년 ${classNum}반`),
          updatedAt: serverTimestamp(),
        });
      }

      for (const ns of newSlots) {
        if (!oldSlots.includes(ns.slotKey)) {
          tx.set(doc(db, 'slotLocks', ns.slotKey), {
            id: ns.slotKey,
            schoolId: SCHOOL_ID,
            roomId: sanitizeId(room.id),
            date,
            period: ns.period,
            reservationId: existing.id,
            userName: cleanUserName,
            updatedAt: serverTimestamp(),
          });
        }
      }

      const logId = `log_upd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      tx.set(doc(db, 'auditLogs', logId), {
        id: logId,
        schoolId: SCHOOL_ID,
        actorName: cleanUserName,
        action: 'update_reservation',
        targetId: existing.id,
        summary: sanitizeStr(
          `${room.name} 예약 수정 (${date} · ${formatPeriodRangeLabel(
            startPeriod,
            endPeriod
          )} · ${classLabel} · ${cleanUserName})`,
          250,
          '예약 수정'
        ),
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('CONFLICT:')) {
      throw new Error(err.message.replace('CONFLICT:', ''));
    }
    handleFirestoreError(err, OperationType.UPDATE, `reservations/${existing.id}`);
  }
}

// Atomic Reservation Deletion (True Delete on Server)
export async function cancelReservationAtomic(reservation: Reservation): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const resRef = doc(db, 'reservations', reservation.id);
      const resSnap = await tx.get(resRef);
      if (resSnap.exists()) {
        tx.delete(resRef);
      }

      for (const p of getPeriodsInRange(reservation.startPeriod, reservation.endPeriod)) {
        const slotKey = buildSlotKey(reservation.roomId, reservation.date, p);
        tx.delete(doc(db, 'slotLocks', slotKey));
      }

      const logId = `log_del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      tx.set(doc(db, 'auditLogs', logId), {
        id: logId,
        schoolId: SCHOOL_ID,
        actorName: reservation.userName || '교직원',
        action: 'cancel_reservation',
        targetId: reservation.id,
        summary: sanitizeStr(
          `${reservation.roomName} 예약 삭제 (${reservation.date} · ${formatPeriodRangeLabel(reservation.startPeriod, reservation.endPeriod)} · ${reservation.classLabel || reservation.userName})`,
          250,
          '예약 삭제'
        ),
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `reservations/${reservation.id}`);
  }
}

// Bulk / Period Reservation Deletion
export async function deleteReservationsByRange(params: {
  startDate?: string;
  endDate?: string;
  beforeDate?: string;
  deleteAll?: boolean;
}): Promise<number> {
  const { startDate, endDate, beforeDate, deleteAll } = params;
  try {
    const resSnap = await getDocs(collection(db, 'reservations'));
    const locksSnap = await getDocs(collection(db, 'slotLocks'));

    let targetDocs = resSnap.docs;

    if (!deleteAll) {
      if (beforeDate) {
        targetDocs = targetDocs.filter((d) => {
          const data = d.data() as Reservation;
          return data.date < beforeDate;
        });
      } else if (startDate && endDate) {
        targetDocs = targetDocs.filter((d) => {
          const data = d.data() as Reservation;
          return data.date >= startDate && data.date <= endDate;
        });
      }
    }

    if (targetDocs.length === 0) return 0;

    const targetResIds = new Set(targetDocs.map((d) => d.id));

    // Delete reservations in batches
    const batchSize = 400;
    let deletedCount = 0;

    for (let i = 0; i < targetDocs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = targetDocs.slice(i, i + batchSize);

      for (const d of chunk) {
        batch.delete(d.ref);
        deletedCount++;
      }

      await batch.commit();
    }

    // Delete associated slot locks
    const targetLocks = locksSnap.docs.filter((d) => {
      const data = d.data();
      return targetResIds.has(data.reservationId);
    });

    for (let i = 0; i < targetLocks.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = targetLocks.slice(i, i + batchSize);

      for (const d of chunk) {
        batch.delete(d.ref);
      }

      await batch.commit();
    }

    // Record audit log
    const logId = `log_bulk_del_${Date.now()}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: SCHOOL_ID,
      actorName: '교직원',
      action: 'cancel_reservation',
      targetId: 'bulk_deletion',
      summary: sanitizeStr(
        `예약 기록 삭제 (${deletedCount}건${
          beforeDate
            ? ` · ${beforeDate} 이전`
            : startDate && endDate
            ? ` · ${startDate}~${endDate}`
            : ' · 전체 삭제'
        })`,
        250,
        '예약 기록 삭제'
      ),
      createdAt: serverTimestamp(),
    });

    return deletedCount;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'reservations');
    return 0;
  }
}

// Selected Reservations Batch Deletion
export async function deleteReservationsByIds(
  targetReservations: Reservation[]
): Promise<number> {
  if (!targetReservations || targetReservations.length === 0) return 0;

  try {
    const targetIdSet = new Set<string>();
    const slotKeySet = new Set<string>();

    for (const r of targetReservations) {
      if (r.id) {
        targetIdSet.add(r.id);
        targetIdSet.add(sanitizeId(r.id));
      }
      for (const p of getPeriodsInRange(r.startPeriod, r.endPeriod)) {
        slotKeySet.add(buildSlotKey(r.roomId, r.date, p));
      }
    }

    const locksSnap = await getDocs(collection(db, 'slotLocks'));
    for (const d of locksSnap.docs) {
      const data = d.data();
      if (data.reservationId && targetIdSet.has(String(data.reservationId))) {
        slotKeySet.add(d.id);
      }
    }

    const resIds = Array.from(targetIdSet);
    const slotKeys = Array.from(slotKeySet);
    const batchSize = 400;

    for (let i = 0; i < resIds.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = resIds.slice(i, i + batchSize);
      for (const id of chunk) {
        batch.delete(doc(db, 'reservations', id));
      }
      await batch.commit();
    }

    for (let i = 0; i < slotKeys.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = slotKeys.slice(i, i + batchSize);
      for (const key of chunk) {
        batch.delete(doc(db, 'slotLocks', key));
      }
      await batch.commit();
    }

    const deletedCount = targetReservations.length;
    const firstItem = targetReservations[0];
    const logId = `log_sel_del_${Date.now()}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: SCHOOL_ID,
      actorName: '교직원',
      action: 'cancel_reservation',
      targetId: sanitizeId(firstItem?.id || 'selected_deletion'),
      summary: sanitizeStr(
        `선택 예약 삭제 (${deletedCount}건 · ${firstItem?.roomName || '특별실'} ${firstItem?.date || ''}${
          deletedCount > 1 ? ` 외 ${deletedCount - 1}건` : ''
        })`,
        250,
        '선택 예약 삭제'
      ),
      createdAt: serverTimestamp(),
    });

    return deletedCount;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'reservations');
    return 0;
  }
}

// Clear Audit Logs
export async function clearAuditLogs(): Promise<number> {
  try {
    const logsSnap = await getDocs(collection(db, 'auditLogs'));
    if (logsSnap.empty) return 0;

    // Collect all auditLogs document IDs
    const docIds = logsSnap.docs.map((d) => d.id);
    const batchSize = 400;
    let deletedCount = 0;

    for (let i = 0; i < docIds.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunkIds = docIds.slice(i, i + batchSize);

      for (const id of chunkIds) {
        batch.delete(doc(db, 'auditLogs', id));
        deletedCount++;
      }

      await batch.commit();
    }

    return deletedCount;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'auditLogs');
    return 0;
  }
}

// Special Room Management
export async function saveSpecialRoom(params: {
  room: Omit<SpecialRoom, 'schoolId' | 'createdAt' | 'updatedAt'>;
  isNew: boolean;
}): Promise<void> {
  const { room, isNew } = params;
  const roomId = sanitizeId(room.id || `room_${Date.now()}`);
  const roomRef = doc(db, 'rooms', roomId);

  const payload = {
    id: roomId,
    schoolId: SCHOOL_ID,
    name: sanitizeStr(room.name, 60, '특별실'),
    category: sanitizeStr(room.category, 40, '기타'),
    colorKey: (room.colorKey || 'purple') as RoomColorKey,
    location: sanitizeStr(room.location, 80, '본관'),
    floor: sanitizeStr(room.floor, 20, '2층'),
    capacity: Math.min(Math.max(1, Number(room.capacity) || 30), 300),
    availablePeriods:
      room.availablePeriods && room.availablePeriods.length > 0
        ? room.availablePeriods.filter((p) => p >= 1 && p <= 7).slice(0, 7)
        : [1, 2, 3, 4, 7, 5, 6],
    equipment: sanitizeStr(room.equipment, 300, ''),
    managerName: sanitizeStr(room.managerName, 60, '담당교사'),
    guidelines: sanitizeStr(room.guidelines, 500, ''),
    active: Boolean(room.active),
  };

  try {
    if (isNew) {
      await setDoc(roomRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { id: _id, schoolId: _sc, ...updateFields } = payload;
      await updateDoc(roomRef, {
        ...updateFields,
        updatedAt: serverTimestamp(),
      });
    }

    const logId = `log_room_${Date.now()}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: SCHOOL_ID,
      actorName: '관리자',
      action: 'manage_room',
      targetId: roomId,
      summary: sanitizeStr(
        `특별실 ${isNew ? '등록' : '정보 수정'}: ${payload.name} (${payload.active ? '사용 가능' : '비활성화'})`,
        250,
        '특별실 관리'
      ),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function deleteSpecialRoom(roomId: string, roomName: string): Promise<void> {
  const cleanId = sanitizeId(roomId);
  try {
    await deleteDoc(doc(db, 'rooms', cleanId));
    if (roomId && roomId !== cleanId) {
      await deleteDoc(doc(db, 'rooms', roomId));
    }

    // Also clean up any reservations and slotLocks belonging to the deleted room
    const [resSnap, locksSnap] = await Promise.all([
      getDocs(collection(db, 'reservations')),
      getDocs(collection(db, 'slotLocks')),
    ]);

    const roomResDocs = resSnap.docs.filter((d) => {
      const data = d.data();
      return data.roomId === cleanId || data.roomId === roomId;
    });
    const roomResIds = new Set(roomResDocs.map((d) => d.id));

    const roomLockDocs = locksSnap.docs.filter((d) => {
      const data = d.data();
      return (
        data.roomId === cleanId ||
        data.roomId === roomId ||
        (data.reservationId && roomResIds.has(String(data.reservationId)))
      );
    });

    const docsToDelete = [...roomResDocs, ...roomLockDocs];
    const batchSize = 400;
    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docsToDelete.slice(i, i + batchSize);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    const logId = `log_del_room_${Date.now()}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: SCHOOL_ID,
      actorName: '관리자',
      action: 'manage_room',
      targetId: cleanId,
      summary: sanitizeStr(`특별실 삭제: ${roomName}`, 250, '특별실 삭제'),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanId}`);
  }
}

// Announcements Management
export async function createAnnouncement(params: {
  title: string;
  content: string;
  category: 'general' | 'maintenance' | 'event' | 'urgent';
  pinned: boolean;
  authorName: string;
}): Promise<void> {
  const { title, content, category, pinned, authorName } = params;
  const announcementId = `ann_${Date.now()}`;
  try {
    await setDoc(doc(db, 'announcements', announcementId), {
      id: announcementId,
      schoolId: SCHOOL_ID,
      title: sanitizeStr(title, 120, '공지사항'),
      content: sanitizeStr(content, 1500, '내용 없음'),
      category,
      pinned,
      authorName: sanitizeStr(authorName, 60, '교무기획부'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `announcements/${announcementId}`);
  }
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `announcements/${announcementId}`);
  }
}

// School Settings
export async function saveSchoolSettings(settings: SchoolSettings): Promise<void> {
  const ref = doc(db, 'settings', 'school_config');
  try {
    const snap = await getDoc(ref);
    const payload = {
      schoolName: sanitizeStr(settings.schoolName, 80, '전주신동초등학교'),
      maxAdvanceDays: Math.min(Math.max(1, Number(settings.maxAdvanceDays) || 90), 365),
      allowTeacherRecurring: Boolean(settings.allowTeacherRecurring),
      p1Start: settings.p1Start,
      p1End: settings.p1End,
      p2Start: settings.p2Start,
      p2End: settings.p2End,
      p3Start: settings.p3Start,
      p3End: settings.p3End,
      p4Start: settings.p4Start,
      p4End: settings.p4End,
      lunchStart: settings.lunchStart,
      lunchEnd: settings.lunchEnd,
      p5Start: settings.p5Start,
      p5End: settings.p5End,
      p6Start: settings.p6Start,
      p6End: settings.p6End,
      updatedBy: '신동초 교직원',
      updatedAt: serverTimestamp(),
    };

    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        id: 'school_config',
        schoolId: SCHOOL_ID,
        ...payload,
      });
    }

    const logId = `log_set_${Date.now()}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: SCHOOL_ID,
      actorName: '시스템',
      action: 'manage_settings',
      targetId: 'school_config',
      summary: '교시 시정표(1~6교시) 시간 설정 변경',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/school_config');
  }
}

export async function syncUserProfile(user: FirebaseUser): Promise<AppUser> {
  const userRef = doc(db, 'users', user.uid);
  const userEmail = (user.email || '').toLowerCase().trim();
  const isAdmin = ADMIN_EMAILS.includes(userEmail);
  const role: 'admin' | 'teacher' = isAdmin ? 'admin' : 'teacher';

  let cleanDisplayName = (user.displayName || '').trim();
  const emailPrefix = userEmail ? userEmail.split('@')[0].toLowerCase() : '';
  if (!cleanDisplayName || cleanDisplayName.toLowerCase() === emailPrefix || cleanDisplayName.includes('@')) {
    cleanDisplayName = isAdmin ? '특별실 관리자' : '신동초 선생님';
  }

  const appUser: AppUser = {
    uid: user.uid,
    email: user.email || null,
    displayName: cleanDisplayName,
    photoURL: user.photoURL || null,
    role,
    schoolId: SCHOOL_ID,
  };

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        schoolId: SCHOOL_ID,
        email: user.email || '',
        displayName: appUser.displayName,
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: appUser.displayName,
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('syncUserProfile notice:', err);
  }

  return appUser;
}
