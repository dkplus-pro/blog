/** 本地日期 YYYY-MM-DD，与 frontmatter date 展示一致 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (toDateKey(date) !== key) return null;
  return date;
}

export function buildPostCountMap(dates: Date[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const date of dates) {
    const key = toDateKey(date);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export interface CalendarDay {
  date: Date;
  dateKey: string;
  count: number;
  inRange: boolean;
}

export interface CalendarWeek {
  days: CalendarDay[];
}

/** 对齐到周日（与 GitHub 贡献图一致） */
function startOfWeekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

/**
 * 生成贡献图周列：从 rangeStart 所在周日至 rangeEnd 所在周六
 */
export function buildCalendarWeeks(
  rangeStart: Date,
  rangeEnd: Date,
  postCounts: Record<string, number>,
): CalendarWeek[] {
  const gridStart = startOfWeekSunday(rangeStart);
  const gridEnd = addDays(startOfWeekSunday(rangeEnd), 6);

  const weeks: CalendarWeek[] = [];
  let cursor = gridStart;

  while (!isAfter(cursor, gridEnd)) {
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(cursor, i);
      const inRange = !isBefore(day, rangeStart) && !isAfter(day, rangeEnd);
      const dateKey = toDateKey(day);
      days.push({
        date: day,
        dateKey,
        count: postCounts[dateKey] ?? 0,
        inRange,
      });
    }
    weeks.push({ days });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

/** 根据发文量映射 0–4 档颜色深度 */
export function getHeatLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (maxCount <= 1) return 4;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** 日历可选年份：最早发文年 ~ 今年，降序 */
export function getCalendarYears(dates: Date[]): number[] {
  const todayYear = new Date().getFullYear();
  if (dates.length === 0) return [todayYear];

  let minYear = todayYear;
  for (const date of dates) {
    minYear = Math.min(minYear, date.getFullYear());
  }

  const years: number[] = [];
  for (let y = todayYear; y >= minYear; y--) {
    years.push(y);
  }
  return years;
}

export function getYearRange(year: number): { start: Date; end: Date } {
  const today = new Date();
  const start = new Date(year, 0, 1);
  const end =
    year === today.getFullYear()
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
      : new Date(year, 11, 31);
  return { start, end };
}

export function getYearPostStats(
  postCounts: Record<string, number>,
  year: number,
): { days: number; posts: number; maxCount: number } {
  let days = 0;
  let posts = 0;
  let maxCount = 0;
  const prefix = `${year}-`;

  for (const [key, count] of Object.entries(postCounts)) {
    if (!key.startsWith(prefix)) continue;
    days += 1;
    posts += count;
    maxCount = Math.max(maxCount, count);
  }

  return { days, posts, maxCount };
}

export function buildMonthLabels(
  weeks: CalendarWeek[],
): { weekIndex: number; label: string }[] {
  const labels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstInRange = week.days.find((d) => d.inRange);
    if (!firstInRange) return;
    const month = firstInRange.date.getMonth();
    if (month !== lastMonth) {
      labels.push({
        weekIndex,
        label: `${month + 1}月`,
      });
      lastMonth = month;
    }
  });

  return labels;
}

export function formatDisplayDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}
