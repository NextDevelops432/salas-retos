import { useEffect, useReducer, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps } from 'react-native';
import { colors, paletteFor, radius, shadow, spacing } from '../constants/theme';
import { formatDueIn } from '../lib/format';

export function IconBadge({ seed, emoji, size = 44 }: { seed: string; emoji: string; size?: number }) {
  const { bg } = paletteFor(seed);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
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
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
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
});
