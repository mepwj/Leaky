import { Router, Request, Response } from 'express';

const router = Router();

const HOLIDAYS_JSON_URL = 'https://holidays.hyunbin.page/basic.json';

// 전체 공휴일 데이터 캐시
let allHolidaysCache: Record<string, Record<string, string[]>> | null = null;
let cachedAt = 0;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일 (데이터가 자주 바뀌지 않음)

interface HolidayItem {
  date: string;     // "YYYY-MM-DD"
  name: string;     // 공휴일 이름
}

// 전체 데이터를 한 번 가져와서 캐시
async function fetchAllHolidays(): Promise<Record<string, Record<string, string[]>>> {
  if (allHolidaysCache && Date.now() - cachedAt < CACHE_TTL) {
    return allHolidaysCache;
  }

  const response = await fetch(HOLIDAYS_JSON_URL);
  if (!response.ok) {
    throw new Error(`holidays-kr API 오류: ${response.status}`);
  }

  allHolidaysCache = await response.json() as Record<string, Record<string, string[]>>;
  cachedAt = Date.now();
  return allHolidaysCache;
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

    const allData = await fetchAllHolidays();
    const yearData = allData[year];

    if (!yearData) {
      res.json({ holidays: [] });
      return;
    }

    // { "2026-03-02": ["대체공휴일(3ㆍ1절)"] } → [{ date, name }]
    const holidays: HolidayItem[] = Object.entries(yearData).map(([date, names]) => ({
      date,
      name: names.join(', '),
    }));

    res.json({ holidays });
  } catch (error) {
    console.error('공휴일 조회 오류:', error);
    res.status(500).json({ error: '공휴일 조회에 실패했습니다.' });
  }
});

export default router;
