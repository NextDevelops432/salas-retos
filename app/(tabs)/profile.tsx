import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Card, Input, StreakCard } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';
import { computeLevel, computeStreak } from '../../lib/gamification';

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { notify } = useToast();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [streak, setStreak] = useState(computeStreak([]));

  const loadStats = useCallback(async () => {
    if (!session) return;
    const [{ data: points }, { data: approvedDates }] = await Promise.all([
      supabase.from('room_member_points').select('points_earned').eq('user_id', session.user.id),
      supabase
        .from('task_completions')
        .select('reviewed_at, completed_at')
        .eq('user_id', session.user.id)
        .eq('status', 'approved'),
    ]);
    setLifetimePoints((points ?? []).reduce((sum: number, p: any) => sum + (p.points_earned ?? 0), 0));
    setStreak(computeStreak((approvedDates ?? []).map((r: any) => r.reviewed_at ?? r.completed_at)));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const level = computeLevel(lifetimePoints);

  const handleSave = async () => {
    if (!session) return;
    setError(null);
    if (!username.trim()) {
      setError('El nombre de usuario no puede estar vacío.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    notify({ tone: 'success', title: 'Perfil actualizado' });
    await refreshProfile();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={[colors.bgGradientStart, colors.bgGradientEnd]} style={styles.hero}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatar}>👤</Text>
        </View>
        <Text style={styles.username}>{profile?.username}</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <View style={{ height: spacing.sm }} />
        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>Nivel {level.level} · ⭐ {lifetimePoints} pts de por vida</Text>
        </View>
        <View style={{ height: 6 }} />
        <View style={styles.levelBar}>
          <View style={[styles.levelBarFill, { width: `${Math.round(level.progress * 100)}%` }]} />
        </View>
        <Text style={styles.levelHint}>
          {level.pointsForNextLevel - level.pointsIntoLevel} pts para el nivel {level.level + 1}
        </Text>
      </LinearGradient>

      <View style={{ height: spacing.md }} />
      <StreakCard current={streak.current} weekMarks={streak.weekMarks} />

      <View style={{ height: spacing.md }} />

      <Card>
        <Text style={styles.label}>Nombre de usuario</Text>
        <View style={{ height: spacing.xs }} />
        <Input value={username} onChangeText={setUsername} autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: spacing.sm }} />
        <Button title="Guardar cambios" onPress={handleSave} loading={saving} />
      </Card>

      <View style={{ height: spacing.lg }} />

      <Button title="Cerrar sesión" variant="danger" onPress={() => signOut()} />
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatar: { fontSize: 34 },
  username: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  email: { color: 'rgba(255,255,255,0.8)', marginTop: 2, fontSize: 13 },
  levelPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  levelBar: {
    width: '100%',
    maxWidth: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  levelBarFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },
  levelHint: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.xs },
});
