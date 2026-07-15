import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, IconBadge } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';
import { useIsWideScreen } from '../../lib/useIsWideScreen';

const FEATURES = [
  { emoji: '🏠', title: 'Crea tu sala', text: 'Arma un espacio para tu pareja, tu familia o tus compañeros de casa.' },
  { emoji: '🎯', title: 'Asigna retos', text: 'Reparte tareas con puntos y fecha límite a una persona específica.' },
  { emoji: '📸', title: 'Sube evidencia', text: 'Marca el reto como hecho y adjunta una foto si hace falta.' },
  { emoji: '🎁', title: 'Canjea recompensas', text: 'Usa los puntos ganados para canjear premios que ustedes definan.' },
];

const STEPS = [
  { n: '1', emoji: '🏠', title: 'Crea o únete a una sala', text: 'Genera un código de invitación y compártelo.' },
  { n: '2', emoji: '🎯', title: 'Reparte retos', text: 'Cada reto se asigna a otra persona de la sala, con puntos y plazo.' },
  { n: '3', emoji: '✅', title: 'Cumple y confirma', text: 'La persona asignada lo marca como hecho, con foto si aplica.' },
  { n: '4', emoji: '🎁', title: 'Gana y canjea', text: 'Los puntos se aprueban y se canjean por recompensas reales.' },
];

const USE_CASES = [
  { emoji: '💜', title: 'Para parejas', text: 'Conviertan las tareas del hogar en retos con recompensas: una cena, una salida, un masaje.' },
  { emoji: '👨‍👩‍👧', title: 'Para familias', text: 'Las tareas y la tarea escolar ganan puntos que se canjean por tiempo de pantalla o salidas.' },
];

function NavLink({ label }: { label: string }) {
  return <Text style={styles.navLink}>{label}</Text>;
}

function MockDashboardPreview() {
  return (
    <View style={styles.mockCard}>
      <View style={styles.mockHeaderRow}>
        <View>
          <Text style={styles.mockGreeting}>¡Hola, Ana! 👋</Text>
          <Text style={styles.mockSubtitle}>Casa Díaz</Text>
        </View>
        <View style={styles.mockAvatar}>
          <Text style={{ fontSize: 16 }}>👤</Text>
        </View>
      </View>
      <View style={{ height: spacing.md }} />
      <LinearGradient colors={[colors.bgGradientStart, colors.bgGradientEnd]} style={styles.mockPointsCard}>
        <Text style={styles.mockPointsLabel}>Puntos disponibles</Text>
        <Text style={styles.mockPointsValue}>⭐ 320</Text>
      </LinearGradient>
      <View style={{ height: spacing.md }} />
      <Text style={styles.mockSectionTitle}>Retos de hoy</Text>
      <View style={{ height: spacing.sm }} />
      <View style={styles.mockTaskRow}>
        <IconBadge seed="a" emoji="🗑️" size={36} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.mockTaskTitle}>Sacar la basura</Text>
          <Text style={styles.mockTaskMeta}>Vence en 2 h</Text>
        </View>
        <Text style={styles.mockTaskPoints}>20 pts</Text>
      </View>
      <View style={{ height: spacing.sm }} />
      <View style={styles.mockTaskRow}>
        <IconBadge seed="b" emoji="🍽️" size={36} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.mockTaskTitle}>Lavar los platos</Text>
          <Text style={styles.mockTaskMeta}>Vence mañana</Text>
        </View>
        <Text style={styles.mockTaskPoints}>15 pts</Text>
      </View>
    </View>
  );
}

export default function LandingScreen() {
  const isWide = useIsWideScreen();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.navbar}>
        <View style={styles.navInner}>
          <View style={styles.navBrand}>
            <Text style={{ fontSize: 22 }}>🏆</Text>
            <Text style={styles.navBrandText}>RetaMe</Text>
          </View>
          {isWide ? (
            <View style={styles.navLinks}>
              <NavLink label="Cómo funciona" />
              <NavLink label="Para parejas" />
              <NavLink label="Para familias" />
            </View>
          ) : null}
          <View style={styles.navActions}>
            <Link href="/(auth)/login" asChild>
              <Button title="Iniciar sesión" variant="secondary" onPress={() => {}} />
            </Link>
            {isWide ? (
              <Link href="/(auth)/signup" asChild>
                <Button title="Únete gratis" onPress={() => {}} />
              </Link>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={[styles.heroText, isWide && { maxWidth: 480 }]}>
          <Text style={styles.heroTitle}>
            Retos que <Text style={{ color: colors.primary }}>los une</Text>, recompensas que{' '}
            <Text style={{ color: colors.primary }}>los motivan</Text>.
          </Text>
          <Text style={styles.heroSubtitle}>
            RetaMe convierte las tareas de pareja o de familia en retos con puntos: cumple, sube la evidencia y canjea
            recompensas reales.
          </Text>
          <View style={{ height: spacing.md }} />
          <View style={styles.heroButtons}>
            <Link href="/(auth)/signup" asChild>
              <Button title="Únete gratis  →" onPress={() => {}} />
            </Link>
            <View style={{ width: spacing.sm }} />
            <Link href="/(auth)/login" asChild>
              <Button title="Ya tengo cuenta" variant="secondary" onPress={() => {}} />
            </Link>
          </View>
        </View>

        {isWide ? (
          <View style={styles.heroMock}>
            <MockDashboardPreview />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
          {FEATURES.map((f) => (
            <View key={f.title} style={[styles.featureCard, isWide && { flex: 1 }]}>
              <View style={styles.featureIcon}>
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>¿Cómo funciona?</Text>
        <View style={{ height: spacing.lg }} />
        <View style={[styles.stepsRow, isWide && styles.stepsRowWide]}>
          {STEPS.map((s) => (
            <View key={s.n} style={[styles.stepCard, isWide && { flex: 1 }]}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{s.n}</Text>
              </View>
              <Text style={{ fontSize: 26, marginTop: spacing.sm }}>{s.emoji}</Text>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.useCaseRow, isWide && styles.useCaseRowWide]}>
          {USE_CASES.map((u) => (
            <LinearGradient
              key={u.title}
              colors={[colors.bgGradientStart, colors.bgGradientEnd]}
              style={[styles.useCaseCard, isWide && { flex: 1 }]}
            >
              <Text style={{ fontSize: 30 }}>{u.emoji}</Text>
              <Text style={styles.useCaseTitle}>{u.title}</Text>
              <Text style={styles.useCaseText}>{u.text}</Text>
            </LinearGradient>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>🏆 RetaMe</Text>
        <Text style={styles.footerText}>Retos y recompensas para parejas y familias.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBrandText: { fontSize: 18, fontWeight: '800', color: colors.text },
  navLinks: { flexDirection: 'row', gap: spacing.lg },
  navLink: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hero: {
    padding: spacing.lg,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl * 1.5,
    gap: spacing.xl,
  },
  heroText: { alignSelf: 'stretch' },
  heroTitle: { fontSize: 36, fontWeight: '800', color: colors.text, lineHeight: 44 },
  heroSubtitle: { fontSize: 15, color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
  heroButtons: { flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm },
  heroMock: { flex: 1, alignItems: 'center' },
  mockCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: 320,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 6,
  },
  mockHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mockGreeting: { fontSize: 15, fontWeight: '800', color: colors.text },
  mockSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  mockAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPointsCard: { borderRadius: radius.md, padding: spacing.md },
  mockPointsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  mockPointsValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4 },
  mockSectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  mockTaskRow: { flexDirection: 'row', alignItems: 'center' },
  mockTaskTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  mockTaskMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  mockTaskPoints: { fontSize: 12, fontWeight: '800', color: colors.points },
  section: {
    padding: spacing.lg,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  featureGrid: { gap: spacing.md },
  featureGridWide: { flexDirection: 'row' },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...({} as any),
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  featureText: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  stepsRow: { gap: spacing.md },
  stepsRowWide: { flexDirection: 'row' },
  stepCard: { alignItems: 'center', textAlign: 'center' as any, paddingHorizontal: spacing.sm },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 13 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.xs, textAlign: 'center' },
  stepText: { fontSize: 12, color: colors.textMuted, marginTop: 2, textAlign: 'center', lineHeight: 17 },
  useCaseRow: { gap: spacing.md },
  useCaseRowWide: { flexDirection: 'row' },
  useCaseCard: { borderRadius: radius.lg, padding: spacing.lg },
  useCaseTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: spacing.sm },
  useCaseText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 6, lineHeight: 19 },
  footer: { padding: spacing.xl, alignItems: 'center' },
  footerBrand: { fontSize: 16, fontWeight: '800', color: colors.text },
  footerText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
