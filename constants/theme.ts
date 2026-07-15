export const colors = {
  bg: '#F4F1FE',
  bgGradientStart: '#8B5CF6',
  bgGradientEnd: '#6D28D9',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EDFC',
  border: '#E7E1FA',
  primary: '#7C4DFF',
  primaryDark: '#5B21B6',
  primaryText: '#FFFFFF',
  accent: '#14B8A6',
  accentBg: '#DCFCF5',
  warning: '#F59E0B',
  warningBg: '#FEF3E0',
  danger: '#F43F5E',
  dangerBg: '#FEE9EC',
  text: '#211A3D',
  textMuted: '#79738F',
  textOnPrimary: '#FFFFFF',
  points: '#F5A623',
  pointsBg: '#FFF3DC',
  shadow: 'rgba(124, 77, 255, 0.18)',
};

export const iconPalette = [
  { bg: '#EDE4FF', fg: '#7C4DFF' },
  { bg: '#DCFCF5', fg: '#0D9488' },
  { bg: '#FFE8D6', fg: '#EA7C1F' },
  { bg: '#FEE9EC', fg: '#E11D48' },
  { bg: '#E0F2FE', fg: '#0284C7' },
  { bg: '#FEF3E0', fg: '#D97706' },
];

export function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return iconPalette[hash % iconPalette.length];
}

export const vividPalette = ['#22C55E', '#7C4DFF', '#F59E0B', '#EC4899', '#0EA5E9', '#F43F5E'];

export function vividColorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return vividPalette[hash % vividPalette.length];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const shadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 1,
  shadowRadius: 20,
  elevation: 4,
};
