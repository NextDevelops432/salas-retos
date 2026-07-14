import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps } from 'react-native';
import { colors, paletteFor, radius, shadow, spacing } from '../constants/theme';

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
});
