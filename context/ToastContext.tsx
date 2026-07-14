import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/UI';
import { colors, radius, shadow, spacing } from '../constants/theme';

type NotifyTone = 'success' | 'error' | 'info';

interface NotifyOptions {
  tone?: NotifyTone;
  title: string;
  message?: string;
}

interface CelebrateOptions {
  emoji?: string;
  title: string;
  message?: string;
  onDismiss?: () => void;
}

interface ToastContextValue {
  notify: (opts: NotifyOptions) => void;
  celebrate: (opts: CelebrateOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const CONFETTI_COLORS = [colors.primary, colors.accent, colors.points, colors.danger, '#38BDF8'];
const CONFETTI_COUNT = 24;

function ConfettiBurst({ triggerKey }: { triggerKey: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        anim: new Animated.Value(0),
        angle: (Math.PI * 2 * i) / CONFETTI_COUNT + Math.random() * 0.6,
        distance: 90 + Math.random() * 90,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
      })),
    [triggerKey]
  );

  useMemo(() => {
    pieces.forEach((p) => {
      p.anim.setValue(0);
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 900 + Math.random() * 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return null;
  }, [pieces]);

  return (
    <View pointerEvents="none" style={styles.confettiWrap}>
      {pieces.map((p, i) => {
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.distance] });
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.distance + 40],
        });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              width: p.size,
              height: p.size * 1.6,
              backgroundColor: p.color,
              borderRadius: 2,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<(NotifyOptions & { id: number }) | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [celebration, setCelebration] = useState<CelebrateOptions | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const modalAnim = useRef(new Animated.Value(0)).current;

  const notify = useCallback(
    (opts: NotifyOptions) => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      setBanner({ ...opts, id: Date.now() });
      bannerAnim.setValue(0);
      Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      bannerTimer.current = setTimeout(() => {
        Animated.timing(bannerAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setBanner(null));
      }, 3000);
    },
    [bannerAnim]
  );

  const celebrate = useCallback(
    (opts: CelebrateOptions) => {
      setCelebration(opts);
      setConfettiKey((k) => k + 1);
      modalAnim.setValue(0);
      Animated.spring(modalAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    },
    [modalAnim]
  );

  const closeCelebration = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      const onDismiss = celebration?.onDismiss;
      setCelebration(null);
      onDismiss?.();
    });
  };

  const value = useMemo(() => ({ notify, celebrate }), [notify, celebrate]);

  const toneColor = banner?.tone === 'error' ? colors.danger : banner?.tone === 'info' ? colors.primary : colors.accent;
  const toneEmoji = banner?.tone === 'error' ? '⚠️' : banner?.tone === 'info' ? 'ℹ️' : '✅';

  return (
    <ToastContext.Provider value={value}>
      {children}

      {banner && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.bannerWrap,
            {
              opacity: bannerAnim,
              transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            },
          ]}
        >
          <Pressable
            style={[styles.banner, { borderColor: toneColor }]}
            onPress={() => {
              if (bannerTimer.current) clearTimeout(bannerTimer.current);
              Animated.timing(bannerAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setBanner(null));
            }}
          >
            <Text style={styles.bannerEmoji}>{toneEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              {banner.message ? <Text style={styles.bannerMessage}>{banner.message}</Text> : null}
            </View>
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={!!celebration} transparent animationType="none" onRequestClose={closeCelebration}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalAnim,
                transform: [{ scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <ConfettiBurst triggerKey={confettiKey} />
            <Text style={styles.modalEmoji}>{celebration?.emoji ?? '🎉'}</Text>
            <Text style={styles.modalTitle}>{celebration?.title}</Text>
            {celebration?.message ? <Text style={styles.modalMessage}>{celebration.message}</Text> : null}
            <View style={{ height: spacing.md }} />
            <Button title="¡Genial!" onPress={closeCelebration} />
          </Animated.View>
        </View>
      </Modal>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 420,
    width: '100%',
    ...shadow,
  },
  bannerEmoji: { fontSize: 18 },
  bannerTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  bannerMessage: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(33, 26, 61, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    overflow: 'hidden',
    ...shadow,
  },
  confettiWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, alignItems: 'center' },
  modalEmoji: { fontSize: 56, marginBottom: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalMessage: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.xs },
});
