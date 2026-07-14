export function formatDueIn(dueAt: string | null): { label: string; overdue: boolean } {
  if (!dueAt) return { label: 'Sin vencimiento', overdue: false };
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs <= 0) return { label: 'Vencida', overdue: true };

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return { label: `Vence en ${minutes} min`, overdue: false };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { label: `Vence en ${hours} h`, overdue: false };

  const days = Math.round(hours / 24);
  return { label: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, overdue: false };
}

export function durationToHours(amount: number, unit: 'hours' | 'days'): number {
  return unit === 'days' ? amount * 24 : amount;
}
