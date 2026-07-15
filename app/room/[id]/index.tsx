import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Badge, Card, DashboardHeader, DueCountdown, EmptyState, IconBadge } from '../../../components/UI';
import { colors, paletteFor, radius, shadow, spacing } from '../../../constants/theme';
import { pickRewardEmoji, pickTaskEmoji } from '../../../lib/format';
import { useIsWideScreen } from '../../../lib/useIsWideScreen';
import type { Reward, Room, Task, TaskCompletion } from '../../../lib/database.types';

type TabKey = 'tasks' | 'rewards';

interface TaskWithMyStatus extends Task {
  myCompletionStatus: TaskCompletion['status'] | null;
}

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { notify, celebrate } = useToast();
  const router = useRouter();
  const isWide = useIsWideScreen();

  const [tab, setTab] = useState<TabKey>('tasks');
  const [room, setRoom] = useState<Room | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [tasks, setTasks] = useState<TaskWithMyStatus[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);

  const waitingOnFor = (excludeUserId: string | null) => {
    const names = Array.from(memberNames.entries())
      .filter(([uid]) => uid !== excludeUserId)
      .map(([, name]) => name);
    return names.length ? names.join(' o ') : 'otro integrante';
  };

  const nameFor = (userId: string | null) => (userId ? memberNames.get(userId) ?? 'alguien' : null);

  const load = useCallback(async () => {
    if (!session || !id) return;

    const [{ data: roomData }, { data: pointsRow }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).single(),
      supabase
        .from('room_member_points')
        .select('points_balance')
        .eq('room_id', id)
        .eq('user_id', session.user.id)
        .maybeSingle(),
    ]);

    setRoom(roomData ?? null);
    setPointsBalance(pointsRow?.points_balance ?? 0);

    const { data: memberRows } = await supabase.from('room_members').select('user_id').eq('room_id', id);
    const memberIds = (memberRows ?? []).map((m) => m.user_id);
    if (memberIds.length) {
      const { data: memberProfiles } = await supabase.from('profiles').select('id, username').in('id', memberIds);
      setMemberNames(new Map((memberProfiles ?? []).map((p) => [p.id, p.username])));
      setMembers(memberProfiles ?? []);
    }

    const { data: taskRows } = await supabase
      .from('tasks')
      .select('*')
      .eq('room_id', id)
      .eq('status', 'active')
      .neq('approval_status', 'rejected')
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
      .neq('approval_status', 'rejected')
      .order('cost_points', { ascending: true });
    setRewards(rewardRows ?? []);

    const [
      { count: completionsCount },
      { count: redemptionsCount },
      { count: taskApprovalsCount },
      { count: rewardApprovalsCount },
    ] = await Promise.all([
      supabase
        .from('task_completions')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id)
        .eq('status', 'pending'),
      supabase
        .from('reward_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id)
        .eq('status', 'pending')
        .neq('user_id', session.user.id),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id)
        .eq('approval_status', 'pending')
        .eq('assigned_to', session.user.id),
      supabase
        .from('rewards')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id)
        .eq('approval_status', 'pending')
        .neq('last_modified_by', session.user.id),
    ]);
    setPendingReviewCount(
      (completionsCount ?? 0) + (redemptionsCount ?? 0) + (taskApprovalsCount ?? 0) + (rewardApprovalsCount ?? 0)
    );

    setLoading(false);
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRedeem = async (reward: Reward) => {
    setBusyId(reward.id);
    const { error } = await supabase.rpc('redeem_reward', { p_reward_id: reward.id });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo canjear', message: error.message });
      return;
    }
    celebrate({
      emoji: '🎁',
      title: '¡Solicitud enviada!',
      message: `Tu canje de "${reward.title}" queda pendiente hasta que otro integrante de la sala lo apruebe.`,
    });
    load();
  };

  const reviewTask = async (taskId: string, taskTitle: string, approve: boolean) => {
    setBusyId(taskId);
    const { error } = await supabase.rpc('review_task_approval', { p_task_id: taskId, p_approve: approve });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo procesar', message: error.message });
      return;
    }
    if (approve) {
      celebrate({ emoji: '✅', title: '¡Reto aprobado!', message: `"${taskTitle}" ya está activo en la sala.` });
    } else {
      notify({ tone: 'info', title: 'Reto rechazado', message: `"${taskTitle}" quedó archivado.` });
    }
    load();
  };

  const reviewReward = async (rewardId: string, rewardTitle: string, approve: boolean) => {
    setBusyId(rewardId);
    const { error } = await supabase.rpc('review_reward_approval', { p_reward_id: rewardId, p_approve: approve });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo procesar', message: error.message });
      return;
    }
    if (approve) {
      celebrate({ emoji: '✅', title: '¡Recompensa aprobada!', message: `"${rewardTitle}" ya se puede canjear.` });
    } else {
      notify({ tone: 'info', title: 'Recompensa rechazada', message: `"${rewardTitle}" quedó archivada.` });
    }
    load();
  };

  const shareInvite = () => {
    if (!room) return;
    Share.share({ message: `Únete a mi sala "${room.name}" en RetaMe con el código: ${room.invite_code}` });
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isWide && { maxWidth: 1000 }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable style={styles.backRow} onPress={() => router.push('/')}>
        <Text style={styles.backText}>← Volver a mis salas</Text>
      </Pressable>
      <View style={{ height: spacing.sm }} />

      <DashboardHeader greeting={room?.name ?? 'Sala'} subtitle={room?.description} username={profile?.username} />

      <LinearGradient colors={[colors.bgGradientStart, colors.bgGradientEnd]} style={styles.hero}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsLabel}>Puntos disponibles</Text>
            <Text style={styles.pointsValue}>⭐ {pointsBalance}</Text>
          </View>
        </View>
        <View style={{ height: spacing.md }} />
        <Pressable onPress={shareInvite} style={styles.inviteRow}>
          <Text style={styles.inviteLabel}>Código de invitación</Text>
          <Text style={styles.inviteCode}>{room?.invite_code}  ↗</Text>
        </Pressable>
      </LinearGradient>

      <View style={{ height: spacing.md }} />
      <Text style={styles.sectionTitle}>Integrantes</Text>
      <View style={{ height: spacing.sm }} />
      <View style={styles.membersRow}>
        {members.map((m) => {
          const { bg, fg } = paletteFor(m.id);
          return (
            <View key={m.id} style={styles.memberPill}>
              <View style={[styles.memberAvatar, { backgroundColor: bg }]}>
                <Text style={{ color: fg, fontWeight: '800', fontSize: 12 }}>
                  {m.username.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.id === session?.user.id ? 'Tú' : m.username}
              </Text>
            </View>
          );
        })}
      </View>

      {pendingReviewCount > 0 && (
        <Link href={{ pathname: '/room/[id]/review', params: { id: id as string } }} asChild>
          <Pressable>
            <Card style={{ marginTop: spacing.md, backgroundColor: colors.warningBg }}>
              <Text style={styles.reviewBanner}>
                📋 {pendingReviewCount} {pendingReviewCount === 1 ? 'cosa pendiente' : 'cosas pendientes'} de aprobar
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
            <View style={isWide ? styles.grid : undefined}>
            {tasks.map((task) => {
              const isPending = task.approval_status === 'pending';
              const canReview = isPending && task.assigned_to === session?.user.id;
              const assigneeName = nameFor(task.assigned_to);
              return (
                <Card key={task.id} style={[{ marginBottom: spacing.sm }, isWide && styles.gridItem]}>
                  <Link href={{ pathname: '/room/[id]/task/[taskId]', params: { id: id as string, taskId: task.id } }} asChild>
                    <Pressable>
                      <View style={styles.tileHeadRow}>
                        <IconBadge seed={task.id} emoji={task.icon || pickTaskEmoji(task.title)} size={48} />
                        <Badge text={`${task.points}`} tone="points" />
                      </View>
                      <View style={{ height: spacing.sm }} />
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {assigneeName && (
                        <Text style={styles.assignee}>
                          {task.assigned_to === session?.user.id ? 'Asignado a ti' : `Asignado a ${assigneeName}`}
                        </Text>
                      )}
                      <View style={styles.taskBadges}>
                        <DueCountdown dueAt={task.due_at} onExpire={load} />
                        {isPending && <Badge text="Pendiente de aprobación" tone="warning" />}
                        {task.myCompletionStatus === 'pending' && <Badge text="Enviado, esperando revisión" tone="warning" />}
                        {task.myCompletionStatus === 'approved' && <Badge text="Completado ✓" tone="accent" />}
                        {task.myCompletionStatus === 'rejected' && <Badge text="Rechazado" tone="danger" />}
                      </View>
                      {isPending && (
                        <Text style={styles.waitingOn}>Esperando que lo confirme: {assigneeName ?? 'la persona asignada'}</Text>
                      )}
                      {task.myCompletionStatus === 'pending' && (
                        <Text style={styles.waitingOn}>
                          Esperando que lo apruebe: {waitingOnFor(session?.user.id ?? null)}
                        </Text>
                      )}
                    </Pressable>
                  </Link>
                  <View style={{ height: spacing.sm }} />
                  <View style={styles.buttonsRow}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => router.push({ pathname: '/room/[id]/create-task', params: { id: id as string, taskId: task.id } })}
                    >
                      <Text style={styles.editBtnText}>Editar</Text>
                    </Pressable>
                    {canReview && (
                      <>
                        <View style={{ width: spacing.sm }} />
                        <Pressable
                          style={[styles.smallBtn, { backgroundColor: colors.dangerBg }]}
                          disabled={busyId === task.id}
                          onPress={() => reviewTask(task.id, task.title, false)}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.danger }]}>Rechazar</Text>
                        </Pressable>
                        <View style={{ width: spacing.sm }} />
                        <Pressable
                          style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                          disabled={busyId === task.id}
                          onPress={() => reviewTask(task.id, task.title, true)}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.textOnPrimary }]}>Aprobar</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </Card>
              );
            })}
            </View>
          )}
          <Link href={{ pathname: '/room/[id]/create-task', params: { id: id as string } }} asChild>
            <Pressable style={styles.addRow}>
              <Text style={styles.addText}>+ Nuevo reto</Text>
            </Pressable>
          </Link>
        </>
      ) : (
        <>
          {rewards.length === 0 && !loading ? (
            <EmptyState title="No hay recompensas todavía" subtitle="Crea una recompensa para canjear con puntos." />
          ) : (
            <View style={isWide ? styles.grid : undefined}>
            {rewards.map((reward) => {
              const isPending = reward.approval_status === 'pending';
              const canReview = isPending && reward.last_modified_by !== session?.user.id;
              return (
                <Card key={reward.id} style={[{ marginBottom: spacing.sm }, isWide && styles.gridItem]}>
                  <View style={styles.tileHeadRow}>
                    <IconBadge seed={reward.id} emoji={reward.icon || pickRewardEmoji(reward.title)} size={48} />
                    <Badge text={`${reward.cost_points}`} tone="points" />
                  </View>
                  <View style={{ height: spacing.sm }} />
                  <Text style={styles.taskTitle}>{reward.title}</Text>
                  {reward.description ? <Text style={styles.roomDescCard}>{reward.description}</Text> : null}
                  {isPending && (
                    <View style={{ marginTop: 6 }}>
                      <Badge text="Pendiente de aprobación" tone="warning" />
                      <Text style={styles.waitingOn}>Esperando que lo apruebe: {waitingOnFor(reward.last_modified_by)}</Text>
                    </View>
                  )}
                  <View style={{ height: spacing.sm }} />
                  <View style={styles.buttonsRow}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => router.push({ pathname: '/room/[id]/create-reward', params: { id: id as string, rewardId: reward.id } })}
                    >
                      <Text style={styles.editBtnText}>Editar</Text>
                    </Pressable>
                    {canReview ? (
                      <>
                        <View style={{ width: spacing.sm }} />
                        <Pressable
                          style={[styles.smallBtn, { backgroundColor: colors.dangerBg }]}
                          disabled={busyId === reward.id}
                          onPress={() => reviewReward(reward.id, reward.title, false)}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.danger }]}>Rechazar</Text>
                        </Pressable>
                        <View style={{ width: spacing.sm }} />
                        <Pressable
                          style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                          disabled={busyId === reward.id}
                          onPress={() => reviewReward(reward.id, reward.title, true)}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.textOnPrimary }]}>Aprobar</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View style={{ width: spacing.sm }} />
                        <Pressable
                          style={[
                            styles.redeemBtn,
                            { flex: 1 },
                            (isPending || pointsBalance < reward.cost_points) && styles.redeemBtnDisabled,
                          ]}
                          disabled={isPending || pointsBalance < reward.cost_points || busyId === reward.id}
                          onPress={() => handleRedeem(reward)}
                        >
                          <Text
                            style={[
                              styles.smallBtnText,
                              { color: isPending || pointsBalance < reward.cost_points ? colors.textMuted : colors.textOnPrimary },
                            ]}
                          >
                            {isPending
                              ? 'Esperando aprobación'
                              : pointsBalance < reward.cost_points
                              ? 'Puntos insuficientes'
                              : 'Canjear'}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </Card>
              );
            })}
            </View>
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
  content: { padding: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  backRow: { alignSelf: 'flex-start' },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...shadow,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { color: colors.text, fontWeight: '700', fontSize: 12, maxWidth: 100 },
  hero: { borderRadius: radius.lg, padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  roomDescCard: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  pointsValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  pointsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  inviteLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  inviteCode: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  reviewBanner: { color: colors.warning, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.primary, ...shadow },
  segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: colors.textOnPrimary },
  tileHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  assignee: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  taskBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  waitingOn: { color: colors.warning, fontSize: 11, fontWeight: '700', marginTop: 6 },
  addRow: { paddingVertical: spacing.md, alignItems: 'center' },
  addText: { color: colors.primary, fontWeight: '700' },
  buttonsRow: { flexDirection: 'row', alignItems: 'center' },
  editBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  editBtnText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  smallBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  smallBtnText: { fontWeight: '800', fontSize: 13 },
  redeemBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  redeemBtnDisabled: { backgroundColor: colors.surfaceAlt },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '48.5%' },
});
