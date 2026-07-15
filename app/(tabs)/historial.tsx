import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, DashboardHeader, EmptyState, IconBadge } from '../../components/UI';
import { colors, spacing } from '../../constants/theme';
import { pickRewardEmoji, pickTaskEmoji } from '../../lib/format';

interface HistorialItem {
  id: string;
  kind: 'task' | 'reward';
  title: string;
  points: number;
  status: 'approved' | 'rejected';
  roomName: string;
  date: string;
}

export default function HistorialScreen() {
  const { session, profile } = useAuth();
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: completions }, { data: redemptions }] = await Promise.all([
      supabase
        .from('task_completions')
        .select('id, task_id, room_id, status, points_awarded, completed_at, reviewed_at')
        .eq('user_id', session.user.id)
        .in('status', ['approved', 'rejected'])
        .order('completed_at', { ascending: false })
        .limit(100),
      supabase
        .from('reward_redemptions')
        .select('id, reward_id, room_id, status, points_spent, redeemed_at, reviewed_at')
        .eq('user_id', session.user.id)
        .in('status', ['approved', 'rejected'])
        .order('redeemed_at', { ascending: false })
        .limit(100),
    ]);

    const taskIds = Array.from(new Set((completions ?? []).map((r: any) => r.task_id)));
    const rewardIds = Array.from(new Set((redemptions ?? []).map((r: any) => r.reward_id)));
    const roomIds = Array.from(
      new Set([...(completions ?? []).map((r: any) => r.room_id), ...(redemptions ?? []).map((r: any) => r.room_id)])
    );

    const [{ data: tasks }, { data: rewards }, { data: rooms }] = await Promise.all([
      taskIds.length ? supabase.from('tasks').select('id, title').in('id', taskIds) : Promise.resolve({ data: [] as any[] }),
      rewardIds.length
        ? supabase.from('rewards').select('id, title').in('id', rewardIds)
        : Promise.resolve({ data: [] as any[] }),
      roomIds.length ? supabase.from('rooms').select('id, name').in('id', roomIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const taskById = new Map((tasks ?? []).map((t: any) => [t.id, t.title]));
    const rewardById = new Map((rewards ?? []).map((r: any) => [r.id, r.title]));
    const roomById = new Map((rooms ?? []).map((r: any) => [r.id, r.name]));

    const taskItems: HistorialItem[] = (completions ?? []).map((c: any) => ({
      id: `t-${c.id}`,
      kind: 'task',
      title: taskById.get(c.task_id) ?? 'Reto',
      points: c.points_awarded,
      status: c.status,
      roomName: roomById.get(c.room_id) ?? 'Sala',
      date: c.reviewed_at ?? c.completed_at,
    }));
    const rewardItems: HistorialItem[] = (redemptions ?? []).map((r: any) => ({
      id: `r-${r.id}`,
      kind: 'reward',
      title: rewardById.get(r.reward_id) ?? 'Recompensa',
      points: -r.points_spent,
      status: r.status,
      roomName: roomById.get(r.room_id) ?? 'Sala',
      date: r.reviewed_at ?? r.redeemed_at,
    }));

    setItems([...taskItems, ...rewardItems].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, items.length === 0 && { flex: 1 }]}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <DashboardHeader greeting="Historial" subtitle="Tu actividad en todas tus salas" username={profile?.username} />
        </View>
      }
      ListEmptyComponent={
        <EmptyState title="Todavía no hay actividad" subtitle="Cuando completes retos o canjees recompensas, aparecerán aquí." />
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: spacing.sm }}>
          <View style={styles.row}>
            <IconBadge
              seed={item.id}
              emoji={item.kind === 'task' ? pickTaskEmoji(item.title) : pickRewardEmoji(item.title)}
              size={40}
            />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.roomName} · {new Date(item.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.points, item.points < 0 && { color: colors.danger }]}>
                {item.points > 0 ? '+' : ''}
                {item.points} pts
              </Text>
              <Badge
                text={item.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                tone={item.status === 'approved' ? 'accent' : 'danger'}
              />
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  points: { color: colors.points, fontWeight: '800', fontSize: 13 },
});
