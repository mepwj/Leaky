import { Router, Request, Response } from 'express';
import { XMLParser } from 'fast-xml-parser';

const router = Router();

const HOLIDAY_API_KEY = process.env.KOREA_HOLIDAY_API_KEY || '';
const HOLIDAY_API_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

const xmlParser = new XMLParser();

// 연도별 공휴일 캐시 (서버 메모리)
const holidayCache: Record<string, { data: HolidayItem[]; cachedAt: number }> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

interface HolidayItem {
  date: string;     // "YYYY-MM-DD"
  name: string;     // 공휴일 이름
  isHoliday: boolean;
}

// GET /holidays?year=2026
// 해당 연도의 공휴일 목록을 반환 (대체공휴일 포함)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = req.query.year as string;

    if (!year || !/^\d{4}$/.test(year)) {
      res.status(400).json({ error: 'year 파라미터가 필요합니다. (예: 2026)' });
      return;
    }

    // 캐시 확인
    const cached = holidayCache[year];
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      res.json({ holidays: cached.data });
      return;
    }

    if (!HOLIDAY_API_KEY) {
      res.status(500).json({ error: '공휴일 API 키가 설정되지 않았습니다.' });
      return;
    }

    // 공공데이터 API 호출
    const url = `${HOLIDAY_API_BASE}?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&numOfRows=50`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('공휴일 API 응답 오류:', response.status, response.statusText);
      res.status(502).json({ error: '공휴일 API 호출에 실패했습니다.' });
      return;
    }

    const xml = await response.text();
    const parsed = xmlParser.parse(xml);

    // 응답 구조: response.body.items.item (배열 또는 단일 객체)
    const body = parsed?.response?.body;
    if (!body || !body.items) {
      // API 에러 응답 확인
      const header = parsed?.response?.header;
      if (header && header.resultCode !== '00') {
        console.error('공휴일 API 에러:', header.resultCode, header.resultMsg);
        res.status(502).json({ error: `공휴일 API 에러: ${header.resultMsg}` });
        return;
      }
      // 데이터가 없는 경우 (해당 연도 공휴일 미등록)
      res.json({ holidays: [] });
      return;
    }

    // item이 단일 객체일 수도 있고 배열일 수도 있음
    const items = Array.isArray(body.items.item)
      ? body.items.item
      : body.items.item
        ? [body.items.item]
        : [];

    const holidays: HolidayItem[] = items
      .filter((item: { isHoliday: string }) => item.isHoliday === 'Y')
      .map((item: { locdate: number; dateName: string; isHoliday: string }) => {
        // locdate: 20260301 → "2026-03-01"
        const d = String(item.locdate);
        const dateStr = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        return {
          date: dateStr,
          name: item.dateName,
          isHoliday: true,
        };
      });

    // 캐시 저장
    holidayCache[year] = { data: holidays, cachedAt: Date.now() };

    res.json({ holidays });
  } catch (error) {
    console.error('공휴일 조회 오류:', error);
    res.status(500).json({ error: '공휴일 조회에 실패했습니다.' });
  }
});

export default router;
