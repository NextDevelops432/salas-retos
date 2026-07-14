import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, EmptyState } from '../../../components/UI';
import { colors, spacing, radius } from '../../../constants/theme';
import type { TaskCompletion } from '../../../lib/database.types';

interface ReviewItem extends TaskCompletion {
  taskTitle: string;
  taskPoints: number;
  username: string;
}

interface RedemptionReviewItem {
  id: string;
  rewardTitle: string;
  pointsSpent: number;
  username: string;
}

interface ProposalItem {
  id: string;
  title: string;
  points: number;
  username: string;
}

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { notify, celebrate } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionReviewItem[]>([]);
  const [taskProposals, setTaskProposals] = useState<ProposalItem[]>([]);
  const [rewardProposals, setRewardProposals] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !session) return;

    const [
      { data: completionRows, error: completionsErr },
      { data: redemptionRows, error: redemptionsErr },
      { data: taskRows, error: tasksErr },
      { data: rewardRows, error: rewardsErr },
    ] = await Promise.all([
      supabase
        .from('task_completions')
        .select('id, task_id, room_id, user_id, photo_url, note, status, points_awarded, completed_at, reviewed_by, reviewed_at, review_note')
        .eq('room_id', id)
        .eq('status', 'pending')
        .order('completed_at', { ascending: true }),
      supabase
        .from('reward_redemptions')
        .select('id, reward_id, points_spent, user_id')
        .eq('room_id', id)
        .eq('status', 'pending')
        .neq('user_id', session.user.id)
        .order('redeemed_at', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, title, points, last_modified_by, assigned_to')
        .eq('room_id', id)
        .eq('approval_status', 'pending')
        .eq('assigned_to', session.user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('rewards')
        .select('id, title, cost_points, last_modified_by')
        .eq('room_id', id)
        .eq('approval_status', 'pending')
        .neq('last_modified_by', session.user.id)
        .order('created_at', { ascending: true }),
    ]);

    const firstError = completionsErr || redemptionsErr || tasksErr || rewardsErr;
    if (firstError) {
      notify({ tone: 'error', title: 'No se pudo cargar', message: firstError.message });
      setLoading(false);
      return;
    }

    // Los datos relacionados (titulos de retos/recompensas, nombres de
    // usuario) se piden aparte en vez de con joins anidados: los joins
    // anidados de PostgREST descartan la fila completa si la sub-consulta
    // no puede resolverse, y eso escondia evidencias/canjes pendientes.
    const taskIds = Array.from(new Set((completionRows ?? []).map((r) => r.task_id)));
    const rewardIds = Array.from(new Set((redemptionRows ?? []).map((r) => r.reward_id)));
    const userIds = Array.from(
      new Set(
        [
          ...(completionRows ?? []).map((r) => r.user_id),
          ...(redemptionRows ?? []).map((r) => r.user_id),
          ...(taskRows ?? []).map((r) => r.last_modified_by),
          ...(rewardRows ?? []).map((r) => r.last_modified_by),
        ].filter((v): v is string => !!v)
      )
    );

    const [{ data: relatedTasks }, { data: relatedRewards }, { data: relatedProfiles }] = await Promise.all([
      taskIds.length ? supabase.from('tasks').select('id, title, points').in('id', taskIds) : Promise.resolve({ data: [] }),
      rewardIds.length ? supabase.from('rewards').select('id, title').in('id', rewardIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from('profiles').select('id, username').in('id', userIds) : Promise.resolve({ data: [] }),
    ]);

    const taskById = new Map((relatedTasks ?? []).map((t: any) => [t.id, t]));
    const rewardById = new Map((relatedRewards ?? []).map((r: any) => [r.id, r]));
    const usernameById = new Map((relatedProfiles ?? []).map((p: any) => [p.id, p.username]));

    setItems(
      (completionRows ?? []).map((row: any) => ({
        ...row,
        taskTitle: taskById.get(row.task_id)?.title ?? 'Reto',
        taskPoints: taskById.get(row.task_id)?.points ?? 0,
        username: usernameById.get(row.user_id) ?? 'Usuario',
      }))
    );
    setRedemptions(
      (redemptionRows ?? []).map((row: any) => ({
        id: row.id,
        rewardTitle: rewardById.get(row.reward_id)?.title ?? 'Recompensa',
        pointsSpent: row.points_spent,
        username: usernameById.get(row.user_id) ?? 'Usuario',
      }))
    );
    setTaskProposals(
      (taskRows ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        points: row.points,
        username: usernameById.get(row.last_modified_by) ?? 'Usuario',
      }))
    );
    setRewardProposals(
      (rewardRows ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        points: row.cost_points,
        username: usernameById.get(row.last_modified_by) ?? 'Usuario',
      }))
    );
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const review = async (item: ReviewItem, approve: boolean) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('review_completion', {
      p_completion_id: item.id,
      p_approve: approve,
      p_review_note: null,
    });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo procesar', message: error.message });
      return;
    }
    if (approve) {
      celebrate({ emoji: '✅', title: '¡Evidencia aprobada!', message: `${item.username} ganó ${item.taskPoints} puntos.` });
    } else {
      notify({ tone: 'info', title: 'Evidencia rechazada' });
    }
    load();
  };

  const reviewRedemption = async (item: RedemptionReviewItem, approve: boolean) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('review_redemption', {
      p_redemption_id: item.id,
      p_approve: approve,
      p_review_note: null,
    });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo procesar', message: error.message });
      return;
    }
    if (approve) {
      celebrate({ emoji: '🎁', title: '¡Recompensa entregada!', message: `Buen trabajo aprobando "${item.rewardTitle}".` });
    } else {
      notify({ tone: 'info', title: 'Canje rechazado' });
    }
    load();
  };

  const reviewTaskProposal = async (item: ProposalItem, approve: boolean) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('review_task_approval', { p_task_id: item.id, p_approve: approve });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo procesar', message: error.message });
      return;
    }
    if (approve) {
      celebrate({ emoji: '✅', title: '¡Reto aprobado!', message: `"${item.title}" ya está activo en la sala.` });
    } else {
      notify({ tone: 'info', title: 'Reto rechazado' });
    }
    load();
  };

  const reviewRewardProposal = async (item: ProposalItem, approve: boolean) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('review_reward_approval', { p_reward_id: item.id, p_approve: approve });
    setBusyId(null);
    if (error) {
      notify({ tone: 'error', title: 'No se pudo procesar', message: error.message });
      return;
    }
    if (approve) {
      celebrate({ emoji: '✅', title: '¡Recompensa aprobada!', message: `"${item.title}" ya se puede canjear.` });
    } else {
      notify({ tone: 'info', title: 'Recompensa rechazada' });
    }
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Stack.Screen options={{ title: 'Aprobar' }} />

      {items.length === 0 && redemptions.length === 0 && taskProposals.length === 0 && rewardProposals.length === 0 ? (
        <EmptyState title="No hay nada pendiente" subtitle="Todo fue revisado." />
      ) : null}

      {taskProposals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Retos propuestos</Text>
          {taskProposals.map((p) => (
            <Card key={p.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.headerRow}>
                <Text style={styles.taskTitle}>{p.title}</Text>
                <Text style={styles.points}>{p.points} pts</Text>
              </View>
              <Text style={styles.username}>Propuesto por {p.username}</Text>
              <View style={{ height: spacing.sm }} />
              <View style={styles.buttonsRow}>
                <Button
                  title="Rechazar"
                  variant="danger"
                  onPress={() => reviewTaskProposal(p, false)}
                  loading={busyId === p.id}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Aprobar"
                  onPress={() => reviewTaskProposal(p, true)}
                  loading={busyId === p.id}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ))}
          <View style={{ height: spacing.md }} />
        </>
      )}

      {rewardProposals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recompensas propuestas</Text>
          {rewardProposals.map((p) => (
            <Card key={p.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.headerRow}>
                <Text style={styles.taskTitle}>{p.title}</Text>
                <Text style={styles.points}>{p.points} pts</Text>
              </View>
              <Text style={styles.username}>Propuesto por {p.username}</Text>
              <View style={{ height: spacing.sm }} />
              <View style={styles.buttonsRow}>
                <Button
                  title="Rechazar"
                  variant="danger"
                  onPress={() => reviewRewardProposal(p, false)}
                  loading={busyId === p.id}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Aprobar"
                  onPress={() => reviewRewardProposal(p, true)}
                  loading={busyId === p.id}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ))}
          <View style={{ height: spacing.md }} />
        </>
      )}

      {redemptions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Canjes de recompensas</Text>
          {redemptions.map((r) => (
            <Card key={r.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.headerRow}>
                <Text style={styles.taskTitle}>{r.rewardTitle}</Text>
                <Text style={styles.points}>{r.pointsSpent} pts</Text>
              </View>
              <Text style={styles.username}>Solicitado por {r.username}</Text>
              <View style={{ height: spacing.sm }} />
              <View style={styles.buttonsRow}>
                <Button
                  title="Rechazar"
                  variant="danger"
                  onPress={() => reviewRedemption(r, false)}
                  loading={busyId === r.id}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Aprobar"
                  onPress={() => reviewRedemption(r, true)}
                  loading={busyId === r.id}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ))}
          <View style={{ height: spacing.md }} />
        </>
      )}

      {items.length > 0 && <Text style={styles.sectionTitle}>Evidencias de retos</Text>}
      {items.length > 0 &&
        items.map((item) => (
          <Card key={item.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.headerRow}>
              <Text style={styles.taskTitle}>{item.taskTitle}</Text>
              <Text style={styles.points}>{item.taskPoints} pts</Text>
            </View>
            <Text style={styles.username}>Enviado por {item.username}</Text>
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.photo} resizeMode="cover" />
            ) : null}
            {item.note ? <Text style={styles.note}>"{item.note}"</Text> : null}
            <View style={{ height: spacing.sm }} />
            <View style={styles.buttonsRow}>
              <Button
                title="Rechazar"
                variant="danger"
                onPress={() => review(item, false)}
                loading={busyId === item.id}
                style={{ flex: 1 }}
              />
              <View style={{ width: spacing.sm }} />
              <Button
                title="Aprobar"
                onPress={() => review(item, true)}
                loading={busyId === item.id}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  points: { color: colors.points, fontWeight: '700' },
  username: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  photo: { width: '100%', height: 220, borderRadius: radius.md, marginTop: spacing.sm },
  note: { color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  buttonsRow: { flexDirection: 'row' },
});
