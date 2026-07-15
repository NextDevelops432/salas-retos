const POINTS_PER_LEVEL = 150;

export function computeLevel(lifetimePoints: number): {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  progress: number;
} {
  const safePoints = Math.max(0, lifetimePoints);
  const level = Math.floor(safePoints / POINTS_PER_LEVEL) + 1;
  const pointsIntoLevel = safePoints % POINTS_PER_LEVEL;
  return {
    level,
    pointsIntoLevel,
    pointsForNextLevel: POINTS_PER_LEVEL,
    progress: pointsIntoLevel / POINTS_PER_LEVEL,
  };
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Recibe timestamps ISO de completions aprobadas y calcula la racha actual (dias consecutivos hasta hoy o ayer). */
export function computeStreak(approvedAtTimestamps: string[]): {
  current: number;
  weekMarks: { label: string; date: string; active: boolean; isToday: boolean }[];
} {
  const activeDays = new Set(approvedAtTimestamps.map((ts) => toDateKey(new Date(ts))));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = 0;
  const cursor = new Date(today);
  if (!activeDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDays.has(toDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const weekMarks = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const key = toDateKey(d);
    return { label: dayLabels[i], date: key, active: activeDays.has(key), isToday: key === toDateKey(today) };
  });

  return { current, weekMarks };
}
