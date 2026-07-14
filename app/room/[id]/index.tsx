import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Card, EmptyState } from '../../../components/UI';
import { colors, radius, spacing } from '../../../constants/theme';
import { formatDueIn } from '../../../lib/format';
import type { Reward, Room, Task, TaskCompletion } from '../../../lib/database.types';

type TabKey = 'tasks' | 'rewards';

interface TaskWithMyStatus extends Task {
  myCompletionStatus: TaskCompletion['status'] | null;
}

interface PendingRedemption {
  id: string;
  rewardTitle: string;
  pointsSpent: number;
  username: string;
}

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('tasks');
  const [room, setRoom] = useState<Room | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [tasks, setTasks] = useState<TaskWithMyStatus[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [pendingRedemptions, setPendingRedemptions] = useState<PendingRedemption[]>([]);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session || !id) return;

    const [{ data: roomData }, { data: membership }, { data: pointsRow }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).single(),
      supabase.from('room_members').select('role').eq('room_id', id).eq('user_id', session.user.id).single(),
      supabase
        .from('room_member_points')
        .select('points_balance')
        .eq('room_id', id)
        .eq('user_id', session.user.id)
        .maybeSingle(),
    ]);

    setRoom(roomData ?? null);
    setIsOwner(membership?.role === 'owner');
    setPointsBalance(pointsRow?.points_balance ?? 0);

    const { data: taskRows } = await supabase
      .from('tasks')
      .select('*')
      .eq('room_id', id)
      .eq('status', 'active')
      .order('due_at', { ascending: true, nullsFirst: false });

    const taskIds = (taskRows ?? []).map((t) => t.id);

    const { data: myCompletions } = taskIds.length
      ? await supabase
          .from('task_completions')
          .select('task_id, status, completed_at')
          .eq('user_id', session.user.id)
          .in('task_id', taskIds)
          .order('completed_at', { ascending: false })
      : { data: [] };

    const latestStatusByTask = new Map<string, TaskCompletion['status']>();
    for (const c of myCompletions ?? []) {
      if (!latestStatusByTask.has(c.task_id)) latestStatusByTask.set(c.task_id, c.status as any);
    }

    setTasks(
      (taskRows ?? []).map((t) => ({
        ...t,
        myCompletionStatus: latestStatusByTask.get(t.id) ?? null,
      }))
    );

    const { data: rewardRows } = await supabase
      .from('rewards')
      .select('*')
      .eq('room_id', id)
      .eq('is_active', true)
      .order('cost_points', { ascending: true });
    setRewards(rewardRows ?? []);

    const { count } = await supabase
      .from('task_completions')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', id)
      .eq('status', 'pending');
    setPendingReviewCount(count ?? 0);

    if (membership?.role === 'owner') {
      const { data: redemptionRows } = await supabase
        .from('reward_redemptions')
        .select('*, reward:rewards(title), user:profiles!reward_redemptions_user_id_fkey(username)')
        .eq('room_id', id)
        .eq('status', 'pending')
        .order('redeemed_at', { ascending: true });
      setPendingRedemptions(
        (redemptionRows ?? []).map((r: any) => ({
          id: r.id,
          rewardTitle: r.reward?.title ?? 'Recompensa',
          pointsSpent: r.points_spent,
          username: r.user?.username ?? 'Usuario',
        }))
      );
    } else {
      setPendingRedemptions([]);
    }

    setLoading(false);
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRedeem = async (reward: Reward) => {
    const { error } = await supabase.rpc('redeem_reward', { p_reward_id: reward.id });
    if (error) {
      Alert.alert('No se pudo canjear', error.message);
      return;
    }
    Alert.alert('¡Canjeado!', `Canjeaste "${reward.title}" por ${reward.cost_points} pts.`);
    load();
  };

  const handleFulfill = async (redemptionId: string) => {
    setFulfillingId(redemptionId);
    const { error } = await supabase.rpc('fulfill_redemption', { p_redemption_id: redemptionId });
    setFulfillingId(null);
    if (error) {
      Alert.alert('No se pudo entregar', error.message);
      return;
    }
    load();
  };

  const shareInvite = () => {
    if (!room) return;
    Share.share({ message: `Únete a mi sala "${room.name}" en Salas de Retos con el código: ${room.invite_code}` });
  };

  if (!room && !loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Sala' }} />
        <EmptyState title="No se pudo cargar la sala" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Stack.Screen options={{ title: room?.name ?? 'Sala' }} />

      <Card>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomName}>{room?.name}</Text>
            {room?.description ? <Text style={styles.roomDesc}>{room.description}</Text> : null}
          </View>
          <View style={styles.pointsBox}>
            <Text style={styles.pointsValue}>{pointsBalance}</Text>
            <Text style={styles.pointsLabel}>puntos</Text>
          </View>
        </View>
        <View style={{ height: spacing.sm }} />
        <Pressable onPress={shareInvite} style={styles.inviteRow}>
          <Text style={styles.inviteLabel}>Código de invitación</Text>
          <Text style={styles.inviteCode}>{room?.invite_code} ↗</Text>
        </Pressable>
      </Card>

      {pendingReviewCount > 0 && (
        <Link href={{ pathname: '/room/[id]/review', params: { id: id as string } }} asChild>
          <Pressable>
            <Card style={{ marginTop: spacing.md, borderColor: colors.warning }}>
              <Text style={styles.reviewBanner}>
                📋 {pendingReviewCount} {pendingReviewCount === 1 ? 'evidencia pendiente' : 'evidencias pendientes'} de aprobar
              </Text>
            </Card>
          </Pressable>
        </Link>
      )}

      <View style={{ height: spacing.md }} />

      <View style={styles.segment}>
        <Pressable style={[styles.segmentBtn, tab === 'tasks' && styles.segmentBtnActive]} onPress={() => setTab('tasks')}>
          <Text style={[styles.segmentText, tab === 'tasks' && styles.segmentTextActive]}>Retos</Text>
        </Pressable>
        <Pressable style={[styles.segmentBtn, tab === 'rewards' && styles.segmentBtnActive]} onPress={() => setTab('rewards')}>
          <Text style={[styles.segmentText, tab === 'rewards' && styles.segmentTextActive]}>Recompensas</Text>
        </Pressable>
      </View>

      <View style={{ height: spacing.md }} />

      {tab === 'tasks' ? (
        <>
          {tasks.length === 0 && !loading ? (
            <EmptyState title="No hay retos activos" subtitle="Crea el primer reto para esta sala." />
          ) : (
            tasks.map((task) => {
              const due = formatDueIn(task.due_at);
              return (
                <Link key={task.id} href={{ pathname: '/room/[id]/task/[taskId]', params: { id: id as string, taskId: task.id } }} asChild>
                  <Pressable>
                    <Card style={{ marginBottom: spacing.sm }}>
                      <View style={styles.taskRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <View style={styles.taskBadges}>
                            <Badge text={due.label} tone={due.overdue ? 'danger' : 'default'} />
                            {task.myCompletionStatus === 'pending' && <Badge text="Enviado, esperando revisión" tone="warning" />}
                            {task.myCompletionStatus === 'approved' && <Badge text="Completado ✓" tone="accent" />}
                            {task.myCompletionStatus === 'rejected' && <Badge text="Rechazado" tone="danger" />}
                          </View>
                        </View>
                        <Badge text={`${task.points} pts`} tone="points" />
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              );
            })
          )}
          <Link href={{ pathname: '/room/[id]/create-task', params: { id: id as string } }} asChild>
            <Pressable style={styles.addRow}>
              <Text style={styles.addText}>+ Nuevo reto</Text>
            </Pressable>
          </Link>
        </>
      ) : (
        <>
          {pendingRedemptions.length > 0 && (
            <>
              <Text style={styles.subheading}>Canjes pendientes de entregar</Text>
              {pendingRedemptions.map((r) => (
                <Card key={r.id} style={{ marginBottom: spacing.sm, borderColor: colors.warning }}>
                  <View style={styles.taskRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle}>{r.rewardTitle}</Text>
                      <Text style={styles.roomDesc}>
                        {r.username} · {r.pointsSpent} pts
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: spacing.sm }} />
                  <Pressable style={styles.redeemBtn} onPress={() => handleFulfill(r.id)} disabled={fulfillingId === r.id}>
                    <Text style={styles.redeemBtnText}>{fulfillingId === r.id ? 'Entregando…' : 'Marcar como entregado'}</Text>
                  </Pressable>
                </Card>
              ))}
              <View style={{ height: spacing.md }} />
            </>
          )}
          {rewards.length === 0 && !loading ? (
            <EmptyState title="No hay recompensas todavía" subtitle="Crea una recompensa para canjear con puntos." />
          ) : (
            rewards.map((reward) => (
              <Card key={reward.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.taskRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{reward.title}</Text>
                    {reward.description ? <Text style={styles.roomDesc}>{reward.description}</Text> : null}
                  </View>
                  <Badge text={`${reward.cost_points} pts`} tone="points" />
                </View>
                <View style={{ height: spacing.sm }} />
                <Pressable
                  style={[styles.redeemBtn, pointsBalance < reward.cost_points && styles.redeemBtnDisabled]}
                  disabled={pointsBalance < reward.cost_points}
                  onPress={() => handleRedeem(reward)}
                >
                  <Text style={styles.redeemBtnText}>
                    {pointsBalance < reward.cost_points ? 'Puntos insuficientes' : 'Canjear'}
                  </Text>
                </Pressable>
              </Card>
            ))
          )}
          <Link href={{ pathname: '/room/[id]/create-reward', params: { id: id as string } }} asChild>
            <Pressable style={styles.addRow}>
              <Text style={styles.addText}>+ Nueva recompensa</Text>
            </Pressable>
          </Link>
        </>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  roomName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  roomDesc: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  pointsBox: { alignItems: 'center', marginLeft: spacing.sm },
  pointsValue: { color: colors.points, fontSize: 22, fontWeight: '800' },
  pointsLabel: { color: colors.textMuted, fontSize: 11 },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  inviteLabel: { color: colors.textMuted, fontSize: 12 },
  inviteCode: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  reviewBanner: { color: colors.warning, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: colors.text },
  subheading: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase' },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start' },
  taskTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  taskBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  addRow: { paddingVertical: spacing.md, alignItems: 'center' },
  addText: { color: colors.primary, fontWeight: '700' },
  redeemBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  redeemBtnDisabled: { backgroundColor: colors.surfaceAlt },
  redeemBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
