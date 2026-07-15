import { useEffect, useReducer, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps } from 'react-native';
import { colors, paletteFor, radius, shadow, spacing, vividColorFor } from '../constants/theme';
import { formatDueIn } from '../lib/format';
import { NotificationsBell } from './NotificationsBell';

export function IconBadge({
  seed,
  emoji,
  size = 44,
  variant = 'soft',
}: {
  seed: string;
  emoji: string;
  size?: number;
  variant?: 'soft' | 'vivid';
}) {
  const bg = variant === 'vivid' ? vividColorFor(seed) : paletteFor(seed).bg;
  const radiusForVariant = variant === 'vivid' ? size / 2 : size / 3;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radiusForVariant,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: PressableProps['onPress'];
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: PressableProps['style'];
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surfaceAlt;
  const textColor = variant === 'secondary' ? colors.text : colors.textOnPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'primary' && shadow,
        style as any,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[styles.input, props.style]}
      {...props}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.cardGrid}>{children}</View>;
}

export function Badge({ text, tone = 'default' }: { text: string; tone?: 'default' | 'points' | 'warning' | 'danger' | 'accent' }) {
  const map = {
    default: { bg: colors.surfaceAlt, fg: colors.textMuted },
    points: { bg: colors.pointsBg, fg: colors.points },
    warning: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    accent: { bg: colors.accentBg, fg: colors.accent },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{tone === 'points' ? `⭐ ${text}` : text}</Text>
    </View>
  );
}

/** Header de dashboard: saludo + subtitulo a la izquierda, chip de usuario a la derecha. */
export function DashboardHeader({
  greeting,
  subtitle,
  username,
}: {
  greeting: string;
  subtitle?: string;
  username?: string | null;
}) {
  return (
    <View style={styles.dashHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.dashGreeting}>{greeting}</Text>
        {subtitle ? <Text style={styles.dashSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.dashHeaderRight}>
        <NotificationsBell />
        {username ? (
          <View style={styles.avatarChip}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
            <Text style={styles.avatarName} numberOfLines={1}>
              {username}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Tarjeta "tile": icono arriba, titulo, meta y puntos abajo. */
export function Tile({
  seed,
  emoji,
  title,
  meta,
  points,
  onPress,
  footer,
}: {
  seed: string;
  emoji: string;
  title: string;
  meta?: string;
  points?: number;
  onPress?: () => void;
  footer?: React.ReactNode;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.tile} onPress={onPress}>
      <IconBadge seed={seed} emoji={emoji} size={48} />
      <View style={{ height: spacing.sm }} />
      <Text style={styles.tileTitle} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={styles.tileMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      <View style={{ flex: 1, minHeight: spacing.sm }} />
      {points !== undefined ? (
        <View style={styles.tileFooter}>
          <Badge text={String(points)} tone="points" />
        </View>
      ) : null}
      {footer}
    </Wrapper>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Cuenta regresiva en vivo (segundo a segundo cuando falta menos de 1 día). */
export function DueCountdown({ dueAt, onExpire }: { dueAt: string | null; onExpire?: () => void }) {
  const [, tick] = useReducer((x) => x + 1, 0);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!dueAt) return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [dueAt]);

  if (!dueAt) return <Badge text="Sin vencimiento" tone="default" />;

  const remainingMs = new Date(dueAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    if (!firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
    return <Badge text="Vencida" tone="danger" />;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  if (totalSeconds < 24 * 3600) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const label = h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
    return <Badge text={`Vence en ${label}`} tone={totalSeconds < 3600 ? 'danger' : 'warning'} />;
  }

  return <Badge text={formatDueIn(dueAt).label} tone="default" />;
}

const EMOJI_ONLY = /[a-zA-Z0-9]/g;

export function EmojiPicker({
  value,
  onChange,
  quickPicks,
  fallback,
}: {
  value: string;
  onChange: (v: string) => void;
  quickPicks: string[];
  fallback: string;
}) {
  return (
    <View>
      <View style={styles.emojiRow}>
        <View style={styles.emojiPreview}>
          <Text style={{ fontSize: 28 }}>{value || fallback}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="Pega tu propio emoji aquí"
            value={value}
            onChangeText={(t) => onChange(Array.from(t.replace(EMOJI_ONLY, '')).slice(-2).join(''))}
          />
        </View>
        {value ? (
          <Pressable style={styles.emojiClear} onPress={() => onChange('')}>
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ height: spacing.sm }} />
      <Text style={styles.emojiHint}>O elige uno rápido:</Text>
      <View style={{ height: spacing.xs }} />
      <View style={styles.emojiGrid}>
        {quickPicks.map((e) => (
          <Pressable
            key={e}
            style={[styles.emojiOption, value === e && styles.emojiOptionSelected]}
            onPress={() => onChange(e)}
          >
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MemberPicker({
  members,
  value,
  onChange,
}: {
  members: { id: string; username: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (members.length === 0) {
    return <Text style={{ color: colors.textMuted, fontSize: 13 }}>No hay más integrantes en esta sala todavía.</Text>;
  }
  return (
    <View style={styles.memberRow}>
      {members.map((m) => {
        const selected = m.id === value;
        return (
          <Pressable
            key={m.id}
            style={[styles.memberOption, selected && styles.memberOptionSelected]}
            onPress={() => onChange(m.id)}
          >
            <Text style={[styles.memberOptionText, selected && styles.memberOptionTextSelected]}>{m.username}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tarjeta de racha: numero de dias consecutivos + marcas L-D de la semana. */
export function StreakCard({
  current,
  weekMarks,
}: {
  current: number;
  weekMarks: { label: string; active: boolean; isToday: boolean }[];
}) {
  return (
    <View style={styles.streakCard}>
      <Text style={styles.streakLabel}>Racha actual 🔥</Text>
      <Text style={styles.streakValue}>
        {current} {current === 1 ? 'día' : 'días'}
      </Text>
      <View style={{ height: spacing.sm }} />
      <View style={styles.streakDaysRow}>
        {weekMarks.map((d, i) => (
          <View
            key={i}
            style={[
              styles.streakDay,
              d.active && !d.isToday && styles.streakDayActive,
              d.active && d.isToday && styles.streakDayTodayActive,
              !d.active && d.isToday && styles.streakDayTodayPending,
            ]}
          >
            {d.active ? (
              <Text style={styles.streakDayGlyph}>{d.isToday ? '⭐' : '✓'}</Text>
            ) : (
              <Text style={styles.streakDayText}>{d.label}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🗒️</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '800',
    fontSize: 15,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emojiPreview: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiClear: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiHint: { color: colors.textMuted, fontSize: 12 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiOption: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionSelected: { backgroundColor: colors.primary },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberOption: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
  },
  memberOptionSelected: { backgroundColor: colors.primary },
  memberOptionText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  memberOptionTextSelected: { color: colors.textOnPrimary },
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dashGreeting: { color: colors.text, fontSize: 22, fontWeight: '800' },
  dashSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  dashHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...shadow,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarName: { color: colors.text, fontWeight: '700', fontSize: 13, maxWidth: 120 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 150,
    ...shadow,
  },
  tileTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  tileMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow,
  },
  streakLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  streakValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  streakDaysRow: { flexDirection: 'row', gap: 6 },
  streakDay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayActive: { backgroundColor: '#22C55E' },
  streakDayTodayActive: { backgroundColor: colors.warning },
  streakDayTodayPending: { borderWidth: 1.5, borderColor: colors.primary },
  streakDayText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  streakDayGlyph: { fontSize: 12, color: '#FFFFFF' },
});
