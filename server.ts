import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface RoomInput {
  id: string;
  name: string;
  category: string;
  availablePeriods: number[];
  active: boolean;
}

interface ReservationInput {
  id: string;
  roomId: string;
  roomName: string;
  date: string;
  startPeriod: number;
  endPeriod: number;
  userName: string;
  classLabel: string;
  status: string;
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function getDayOfWeekUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function fallbackParseKoreanPrompt(
  prompt: string,
  todayStr: string,
  rooms: RoomInput[]
) {
  const text = prompt.trim();
  const isSearchIntent =
    text.includes('찾아') ||
    text.includes('가능한') ||
    text.includes('빈 시간') ||
    text.includes('비어있는') ||
    text.includes('언제');

  let matchedRoom: RoomInput | undefined = rooms.find((r) =>
    text.includes(r.name.replace(/\s+/g, '')) || text.includes(r.name)
  );
  if (!matchedRoom) {
    matchedRoom = rooms.find(
      (r) =>
        (text.includes('과학') && r.name.includes('과학')) ||
        (text.includes('음악') && r.name.includes('음악')) ||
        (text.includes('미술') && r.name.includes('미술')) ||
        (text.includes('컴퓨터') && r.name.includes('컴퓨터')) ||
        (text.includes('도서') && r.name.includes('도서')) ||
        ((text.includes('체육') || text.includes('강당')) &&
          (r.name.includes('강당') || r.name.includes('체육'))) ||
        (text.includes('시청각') && r.name.includes('시청각')) ||
        (text.includes('실과') && r.name.includes('실과'))
    );
  }

  // Period extraction
  let startPeriod = 0;
  let endPeriod = 0;
  const rangeMatch = text.match(/([1-6])\s*교시\s*(?:부터|~|-|에서)\s*([1-6])\s*교시/);
  if (rangeMatch) {
    startPeriod = Number(rangeMatch[1]);
    endPeriod = Number(rangeMatch[2]);
  } else {
    const singleMatch = text.match(/([1-6])\s*교시/);
    if (singleMatch) {
      startPeriod = Number(singleMatch[1]);
      endPeriod = startPeriod;
    }
  }

  // Date & recurrence extraction
  const todayDow = getDayOfWeekUTC(todayStr); // 0=Sun..6=Sat
  const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = addDaysStr(todayStr, mondayOffset);
  const nextMonday = addDaysStr(thisMonday, 7);

  const korDays: Record<string, number> = {
    월: 0,
    화: 1,
    수: 2,
    목: 3,
    금: 4,
  };

  let startDate = todayStr;
  let endDate = todayStr;
  let recurrenceType: 'none' | 'daily' | 'weekly' = 'none';
  let weeklyCount = 4;

  const explicitDateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (explicitDateMatch) {
    const year = Number(todayStr.slice(0, 4));
    const m = String(Number(explicitDateMatch[1])).padStart(2, '0');
    const d = String(Number(explicitDateMatch[2])).padStart(2, '0');
    startDate = `${year}-${m}-${d}`;
    endDate = startDate;
  } else if (text.includes('모레')) {
    startDate = addDaysStr(todayStr, 2);
    endDate = startDate;
  } else if (text.includes('내일')) {
    startDate = addDaysStr(todayStr, 1);
    endDate = startDate;
  } else if (text.includes('다음 주') || text.includes('다음주')) {
    if (text.includes('월요일부터 금요일') || text.includes('매일')) {
      startDate = nextMonday;
      endDate = addDaysStr(nextMonday, 4);
      recurrenceType = 'daily';
    } else {
      let foundDay = false;
      for (const [k, offset] of Object.entries(korDays)) {
        if (text.includes(`${k}요일`)) {
          startDate = addDaysStr(nextMonday, offset);
          endDate = startDate;
          foundDay = true;
          break;
        }
      }
      if (!foundDay) {
        startDate = nextMonday;
        endDate = addDaysStr(nextMonday, 4);
      }
    }
  } else if (text.includes('매주')) {
    recurrenceType = 'weekly';
    for (const [k, offset] of Object.entries(korDays)) {
      if (text.includes(`${k}요일`)) {
        let candidate = addDaysStr(thisMonday, offset);
        if (candidate < todayStr) {
          candidate = addDaysStr(nextMonday, offset);
        }
        startDate = candidate;
        endDate = addDaysStr(candidate, 7 * (weeklyCount - 1));
        break;
      }
    }
  } else {
    for (const [k, offset] of Object.entries(korDays)) {
      if (text.includes(`${k}요일`)) {
        let candidate = addDaysStr(thisMonday, offset);
        if (candidate < todayStr) {
          candidate = addDaysStr(nextMonday, offset);
        }
        startDate = candidate;
        endDate = startDate;
        break;
      }
    }
  }

  // Teacher Name extraction
  let userName = '교사';
  const teacherMatch = text.match(/([가-힣]{2,4})\s*(?:선생님|교사)/);
  if (teacherMatch) {
    userName = teacherMatch[1];
  }

  // Grade & class extraction
  let grade = 5;
  let classNum = 1;
  const gradeMatch = text.match(/([1-6])\s*학년/);
  const classMatch = text.match(/(\d{1,2})\s*반/);
  if (gradeMatch) grade = Number(gradeMatch[1]);
  if (classMatch) classNum = Number(classMatch[1]);

  const missingFields: string[] = [];
  if (!isSearchIntent && !matchedRoom) {
    missingFields.push('특별실 이름(예: 과학실 1, 음악실, 컴퓨터실)');
  }
  if (!isSearchIntent && (startPeriod < 1 || endPeriod < 1)) {
    missingFields.push('예약 교시(1교시~6교시)');
  }

  return {
    intent: isSearchIntent ? 'search_available' : 'create_reservation',
    roomId: matchedRoom?.id || '',
    roomName: matchedRoom?.name || '',
    userName,
    startDate,
    endDate,
    startPeriod: startPeriod || 2,
    endPeriod: endPeriod || startPeriod || 2,
    recurrenceType,
    weeklyCount,
    grade,
    classNum,
    classLabel: `${grade}학년 ${classNum}반`,
    missingFields,
    followUpQuestion:
      missingFields.length > 0
        ? `정확한 예약을 위해 ${missingFields.join(', ')} 정보를 알려주시겠어요?`
        : '',
    explanation: isSearchIntent
      ? `${startDate} ~ ${endDate} 기간의 예약 가능한 특별실 현황을 조회합니다.`
      : `${startDate}${endDate !== startDate ? ` ~ ${endDate}` : ''} ${startPeriod || 2}${
          (endPeriod || startPeriod || 2) > (startPeriod || 2) ? `~${endPeriod}교시` : '교시'
        } ${matchedRoom?.name || '특별실'} 예약 요청으로 해석했습니다.`,
  };
}

app.post('/api/ai/parse-reservation', async (req, res) => {
  try {
    const {
      prompt,
      todayStr = new Date().toISOString().slice(0, 10),
      rooms = [],
    } = req.body as {
      prompt?: string;
      todayStr?: string;
      rooms?: RoomInput[];
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: '자연어 예약 명령을 입력해 주세요.' });
      return;
    }

    const activeRooms = rooms.filter((r) => r.active !== false);
    const ai = getGeminiClient();

    if (!ai) {
      const parsed = fallbackParseKoreanPrompt(prompt, todayStr, activeRooms);
      res.json({ parsed, usedModel: 'rule-engine-fallback' });
      return;
    }

    const roomListText = activeRooms
      .map((r) => `- ID: "${r.id}", 이름: "${r.name}", 분류: "${r.category}"`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `오늘 날짜: ${todayStr}
학교 특별실 목록:
${roomListText}

입력 문장: "${prompt.trim()}"`,
      config: {
        systemInstruction: `당신은 전주신동초등학교 특별실 예약 시스템의 AI 분석 엔진입니다.
요청 문장에서 날짜(YYYY-MM-DD), 특별실(roomId, roomName), 시작 교시(1~6), 종료 교시(1~6), 예약자 교사명(userName), 학년(1~6), 학급(1~20), 반복 조건(none | daily | weekly)을 추출하세요.
(사용목적, 이용인원, 메모는 시스템에서 사용하지 않으므로 추출하지 않습니다.)
- 예약 가능한 특별실을 찾는 의도면 intent를 "search_available"로 설정하세요.
- 예약 등록 의도면 intent를 "create_reservation"으로 설정하세요.
- 특별실이나 교시가 불명확하면 missingFields와 followUpQuestion을 작성하세요.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              description: 'create_reservation 또는 search_available',
            },
            roomId: {
              type: Type.STRING,
              description: '매칭된 특별실 ID',
            },
            roomName: {
              type: Type.STRING,
              description: '매칭된 특별실 이름',
            },
            userName: {
              type: Type.STRING,
              description: '교사 성명 (언급 없으면 교사)',
            },
            startDate: {
              type: Type.STRING,
              description: '시작 날짜 YYYY-MM-DD',
            },
            endDate: {
              type: Type.STRING,
              description: '종료 날짜 YYYY-MM-DD',
            },
            startPeriod: {
              type: Type.INTEGER,
              description: '시작 교시 (1~6)',
            },
            endPeriod: {
              type: Type.INTEGER,
              description: '종료 교시 (1~6)',
            },
            recurrenceType: {
              type: Type.STRING,
              description: 'none, daily, weekly 중 하나',
            },
            weeklyCount: {
              type: Type.INTEGER,
              description: '매주 반복 시 횟수 (기본 4)',
            },
            grade: {
              type: Type.INTEGER,
              description: '학년 (1~6, 기본 5)',
            },
            classNum: {
              type: Type.INTEGER,
              description: '반 (1~15, 기본 1)',
            },
            classLabel: {
              type: Type.STRING,
              description: '예: 5학년 1반',
            },
            missingFields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            followUpQuestion: {
              type: Type.STRING,
            },
            explanation: {
              type: Type.STRING,
            },
          },
          required: [
            'intent',
            'roomId',
            'roomName',
            'userName',
            'startDate',
            'endDate',
            'startPeriod',
            'endPeriod',
            'recurrenceType',
            'weeklyCount',
            'grade',
            'classNum',
            'classLabel',
            'missingFields',
            'followUpQuestion',
            'explanation',
          ],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      const parsed = fallbackParseKoreanPrompt(prompt, todayStr, activeRooms);
      res.json({ parsed, usedModel: 'rule-engine-fallback' });
      return;
    }

    const parsed = JSON.parse(rawText);
    res.json({ parsed, usedModel: 'gemini-3.8-flash' });
  } catch (error) {
    console.error('AI parse error:', error);
    const { prompt = '', todayStr = new Date().toISOString().slice(0, 10), rooms = [] } =
      req.body || {};
    const parsed = fallbackParseKoreanPrompt(prompt, todayStr, rooms);
    res.json({
      parsed,
      usedModel: 'rule-engine-fallback',
      warning: error instanceof Error ? error.message : 'AI 해석 폴백 처리됨',
    });
  }
});

// Server-side reservation conflict validation endpoint (Simplified without roomBlocks / calendar)
app.post('/api/reservations/validate', (req, res) => {
  try {
    const {
      roomId,
      dates = [],
      startPeriod,
      endPeriod,
      excludeReservationId = '',
      rooms = [],
      reservations = [],
    } = req.body as {
      roomId: string;
      dates: string[];
      startPeriod: number;
      endPeriod: number;
      excludeReservationId?: string;
      rooms: RoomInput[];
      reservations: ReservationInput[];
    };

    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      res.json({
        valid: false,
        conflicts: [{ date: dates[0] || '', period: startPeriod, reason: '선택한 특별실을 찾을 수 없습니다.' }],
        alternatives: [],
      });
      return;
    }

    if (!room.active) {
      res.json({
        valid: false,
        conflicts: [{ date: dates[0] || '', period: startPeriod, reason: `${room.name}은(는) 현재 비활성화 상태입니다.` }],
        alternatives: [],
      });
      return;
    }

    const periodOrder = [1, 2, 3, 4, 7, 5, 6];
    const sIdx = periodOrder.indexOf(startPeriod);
    const eIdx = periodOrder.indexOf(endPeriod);
    const affectedPeriods =
      sIdx !== -1 && eIdx !== -1
        ? periodOrder.slice(Math.min(sIdx, eIdx), Math.max(sIdx, eIdx) + 1)
        : [startPeriod];
    const roomAvailable = room.availablePeriods.includes(7)
      ? room.availablePeriods
      : [...room.availablePeriods, 7];
    const isPeriodOverlap = (p: number, s: number, e: number) => {
      const pi = periodOrder.indexOf(p);
      const si = periodOrder.indexOf(s);
      const ei = periodOrder.indexOf(e);
      if (pi === -1 || si === -1 || ei === -1) return p >= s && p <= e;
      return pi >= Math.min(si, ei) && pi <= Math.max(si, ei);
    };
    const labelFormat = (val: number) => (val === 7 ? '점심시간' : `${val}교시`);

    const conflicts: Array<{ date: string; period: number; reason: string }> = [];

    for (const date of dates) {
      for (const p of affectedPeriods) {
        if (!roomAvailable.includes(p)) {
          conflicts.push({
            date,
            period: p,
            reason: `${room.name}은(는) ${labelFormat(p)} 운영 대상이 아닙니다.`,
          });
        }

        const existing = reservations.find(
          (r) =>
            r.status === 'confirmed' &&
            r.id !== excludeReservationId &&
            r.roomId === roomId &&
            r.date === date &&
            isPeriodOverlap(p, r.startPeriod, r.endPeriod)
        );
        if (existing) {
          conflicts.push({
            date,
            period: p,
            reason: `기존 예약 중복 (${existing.classLabel})`,
          });
        }
      }
    }

    const alternatives: Array<{
      roomId: string;
      roomName: string;
      date: string;
      startPeriod: number;
      endPeriod: number;
      label: string;
    }> = [];

    if (conflicts.length > 0 && dates.length > 0) {
      const targetDate = dates[0];
      const span = Math.max(1, affectedPeriods.length);

      // Same room, other periods
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
                isPeriodOverlap(checkP, r.startPeriod, r.endPeriod)
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
            label: `${targetDate} ${room.name} ${
              p === endP ? labelFormat(p) : `${labelFormat(p)}~${labelFormat(endP)}`
            }`,
          });
        }
      }

      // Other active rooms at requested period
      for (const otherRoom of rooms.filter((r) => r.active && r.id !== roomId)) {
        const otherAvailable = otherRoom.availablePeriods.includes(7)
          ? otherRoom.availablePeriods
          : [...otherRoom.availablePeriods, 7];
        let ok = true;
        for (const checkP of affectedPeriods) {
          if (!otherAvailable.includes(checkP)) ok = false;
          if (
            reservations.some(
              (r) =>
                r.status === 'confirmed' &&
                r.roomId === otherRoom.id &&
                r.date === targetDate &&
                isPeriodOverlap(checkP, r.startPeriod, r.endPeriod)
            )
          ) {
            ok = false;
          }
        }
        if (ok) {
          alternatives.push({
            roomId: otherRoom.id,
            roomName: otherRoom.name,
            date: targetDate,
            startPeriod,
            endPeriod,
            label: `${targetDate} ${otherRoom.name} ${
              startPeriod === endPeriod
                ? labelFormat(startPeriod)
                : `${labelFormat(startPeriod)}~${labelFormat(endPeriod)}`
            }`,
          });
        }
      }
    }

    res.json({
      valid: conflicts.length === 0,
      conflicts,
      alternatives: alternatives.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({
      valid: false,
      error: err instanceof Error ? err.message : '서버 검증 오류',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Resolve port: respect CLI arg (e.g. --port 3000 passed by runner) or enforce 3000 as required by AI Studio
  const args = process.argv.slice(2);
  const portArgIdx = args.indexOf('--port');
  const cliPort = portArgIdx !== -1 && args[portArgIdx + 1] ? Number(args[portArgIdx + 1]) : null;
  const port = cliPort || (process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000);

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
    } else {
      console.error('Server runtime error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
