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

const TASK_KEYWORDS: [RegExp, string][] = [
  [/barr|limpi|orden|aspir/i, '🧹'],
  [/cocin|cen(a|ar)|comid|almuerz/i, '🍳'],
  [/baj|tarea|estudi|leer|le(c|é)tur/i, '📚'],
  [/ba(ñ|n)|duch/i, '🛁'],
  [/ropa|lavar|planch/i, '🧺'],
  [/plat|vajill/i, '🍽️'],
  [/mascota|perro|gato/i, '🐾'],
  [/ejercici|gym|correr|deport/i, '🏋️'],
  [/basura/i, '🗑️'],
  [/jardin|plant|regar/i, '🌱'],
];

const REWARD_KEYWORDS: [RegExp, string][] = [
  [/videojueg|jugar|consola/i, '🎮'],
  [/pelicul|cine|series?/i, '🎬'],
  [/comid|cen(a|ar)|restaur/i, '🍕'],
  [/abrazo|beso|cariñ/i, '🤗'],
  [/baile|bail(a|ar)/i, '💃'],
  [/dinero|efectiv|plata/i, '💵'],
  [/salir|paseo|parque/i, '🚶'],
  [/dorm|siesta|descans/i, '😴'],
  [/masaj/i, '💆'],
  [/dulce|postre|helad|choco/i, '🍦'],
];

export function pickTaskEmoji(title: string): string {
  const match = TASK_KEYWORDS.find(([re]) => re.test(title));
  return match ? match[1] : '✅';
}

export function pickRewardEmoji(title: string): string {
  const match = REWARD_KEYWORDS.find(([re]) => re.test(title));
  return match ? match[1] : '🎁';
}
