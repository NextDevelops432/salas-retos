import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
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
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionReviewItem[]>([]);
  const [taskProposals, setTaskProposals] = useState<ProposalItem[]>([]);
  const [rewardProposals, setRewardProposals] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const [{ data }, { data: redemptionRows }, { data: taskRows }, { data: rewardRows }] = await Promise.all([
      supabase
        .from('task_completions')
        .select('*, task:tasks(title, points, created_by), user:profiles!task_completions_user_id_fkey(username)')
        .eq('room_id', id)
        .eq('status', 'pending')
        .order('completed_at', { ascending: true }),
      supabase
        .from('reward_redemptions')
        .select('*, reward:rewards(title), user:profiles!reward_redemptions_user_id_fkey(username)')
        .eq('room_id', id)
        .eq('status', 'pending')
        .neq('user_id', session.user.id)
        .order('redeemed_at', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, title, points, last_modified_by, user:profiles!tasks_last_modified_by_fkey(username)')
        .eq('room_id', id)
        .eq('approval_status', 'pending')
        .neq('last_modified_by', session.user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('rewards')
        .select('id, title, cost_points, last_modified_by, user:profiles!rewards_last_modified_by_fkey(username)')
        .eq('room_id', id)
        .eq('approval_status', 'pending')
        .neq('last_modified_by', session.user.id)
        .order('created_at', { ascending: true }),
    ]);

    setItems(
      (data ?? []).map((row: any) => ({
        ...row,
        taskTitle: row.task?.title ?? 'Reto',
        taskPoints: row.task?.points ?? 0,
        username: row.user?.username ?? 'Usuario',
      }))
    );
    setRedemptions(
      (redemptionRows ?? []).map((row: any) => ({
        id: row.id,
        rewardTitle: row.reward?.title ?? 'Recompensa',
        pointsSpent: row.points_spent,
        username: row.user?.username ?? 'Usuario',
      }))
    );
    setTaskProposals(
      (taskRows ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        points: row.points,
        username: row.user?.username ?? 'Usuario',
      }))
    );
    setRewardProposals(
      (rewardRows ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        points: row.cost_points,
        username: row.user?.username ?? 'Usuario',
      }))
    );
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const review = async (completionId: string, approve: boolean) => {
    setBusyId(completionId);
    const { error } = await supabase.rpc('review_completion', {
      p_completion_id: completionId,
      p_approve: approve,
      p_review_note: null,
    });
    setBusyId(null);
    if (error) {
      Alert.alert('No se pudo procesar', error.message);
      return;
    }
    load();
  };

  const reviewRedemption = async (redemptionId: string, approve: boolean) => {
    setBusyId(redemptionId);
    const { error } = await supabase.rpc('review_redemption', {
      p_redemption_id: redemptionId,
      p_approve: approve,
      p_review_note: null,
    });
    setBusyId(null);
    if (error) {
      Alert.alert('No se pudo procesar', error.message);
      return;
    }
    load();
  };

  const reviewTaskProposal = async (taskId: string, approve: boolean) => {
    setBusyId(taskId);
    const { error } = await supabase.rpc('review_task_approval', { p_task_id: taskId, p_approve: approve });
    setBusyId(null);
    if (error) {
      Alert.alert('No se pudo procesar', error.message);
      return;
    }
    load();
  };

  const reviewRewardProposal = async (rewardId: string, approve: boolean) => {
    setBusyId(rewardId);
    const { error } = await supabase.rpc('review_reward_approval', { p_reward_id: rewardId, p_approve: approve });
    setBusyId(null);
    if (error) {
      Alert.alert('No se pudo procesar', error.message);
      return;
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
                  onPress={() => reviewTaskProposal(p.id, false)}
                  loading={busyId === p.id}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Aprobar"
                  onPress={() => reviewTaskProposal(p.id, true)}
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
                  onPress={() => reviewRewardProposal(p.id, false)}
                  loading={busyId === p.id}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Aprobar"
                  onPress={() => reviewRewardProposal(p.id, true)}
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
                  onPress={() => reviewRedemption(r.id, false)}
                  loading={busyId === r.id}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Aprobar"
                  onPress={() => reviewRedemption(r.id, true)}
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
                onPress={() => review(item.id, false)}
                loading={busyId === item.id}
                style={{ flex: 1 }}
              />
              <View style={{ width: spacing.sm }} />
              <Button
                title="Aprobar"
                onPress={() => review(item.id, true)}
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
