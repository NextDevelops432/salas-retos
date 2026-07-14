import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { uploadTaskPhoto } from '../../../../lib/uploadPhoto';
import { Badge, Button, Card, IconBadge, Input } from '../../../../components/UI';
import { colors, radius, spacing } from '../../../../constants/theme';
import { formatDueIn, pickTaskEmoji } from '../../../../lib/format';
import type { Task, TaskCompletion } from '../../../../lib/database.types';

export default function TaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ id: string; taskId: string }>();
  const { session } = useAuth();
  const { notify, celebrate } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [myCompletions, setMyCompletions] = useState<TaskCompletion[]>([]);
  const [otherMembers, setOtherMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !taskId) return;
    const [{ data: taskRow }, { data: completions }] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', taskId).single(),
      supabase
        .from('task_completions')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', session.user.id)
        .order('completed_at', { ascending: false }),
    ]);
    setTask(taskRow ?? null);
    setMyCompletions(completions ?? []);

    if (taskRow) {
      const { data: memberRows } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', taskRow.room_id)
        .neq('user_id', session.user.id);
      const otherIds = (memberRows ?? []).map((m) => m.user_id);
      if (otherIds.length) {
        const { data: memberProfiles } = await supabase.from('profiles').select('username').in('id', otherIds);
        setOtherMembers((memberProfiles ?? []).map((p) => p.username));
      } else {
        setOtherMembers([]);
      }
    }

    setLoading(false);
  }, [session, taskId]);

  const waitingOnLabel = otherMembers.length ? otherMembers.join(' o ') : 'otro integrante de la sala';

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify({ tone: 'error', title: 'Permiso necesario', message: 'Necesitamos permiso para acceder a tus fotos.' });
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    setError(null);
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadTaskPhoto(task.room_id, photoUri);
      }
      const { error } = await supabase.rpc('complete_task', {
        p_task_id: task.id,
        p_photo_url: photoUrl,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      setPhotoUri(null);
      setNote('');
      await load();
      celebrate(
        task.requires_approval
          ? { emoji: '📨', title: '¡Enviado!', message: 'Tu evidencia está esperando aprobación.' }
          : { emoji: '🎉', title: '¡Listo!', message: `Ganaste ${task.points} puntos. Buen trabajo.` }
      );
    } catch (e: any) {
      setError(e.message ?? 'Ocurrió un error al enviar la evidencia.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Reto no encontrado.</Text>
      </View>
    );
  }

  const due = formatDueIn(task.due_at);
  const latest = myCompletions[0];
  const canSubmit =
    task.status === 'active' &&
    task.approval_status === 'approved' &&
    !due.overdue &&
    (!latest || latest.status === 'rejected');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Stack.Screen options={{ title: task.title }} />

      <Card>
        <View style={styles.headerRow}>
          <IconBadge seed={task.id} emoji={task.icon || pickTaskEmoji(task.title)} size={40} />
          <Text style={[styles.title, { marginLeft: spacing.sm }]}>{task.title}</Text>
          <Badge text={`${task.points} pts`} tone="points" />
        </View>
        {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
        <View style={{ height: spacing.sm }} />
        <Badge text={due.label} tone={due.overdue ? 'danger' : 'default'} />
        {task.is_recurring ? (
          <View style={{ marginTop: 6 }}>
            <Badge text="Reto recurrente" tone="accent" />
          </View>
        ) : null}
        {task.approval_status === 'pending' ? (
          <View style={{ marginTop: 6 }}>
            <Badge text="Pendiente de aprobación de la sala" tone="warning" />
            <Text style={styles.waitingOn}>Esperando que lo apruebe: {waitingOnLabel}</Text>
          </View>
        ) : null}
      </Card>

      <View style={{ height: spacing.md }} />

      {latest && latest.status !== 'rejected' ? (
        <Card>
          <Text style={styles.sectionTitle}>
            {latest.status === 'pending' ? '⏳ Esperando aprobación' : '✅ Completado'}
          </Text>
          {latest.photo_url ? (
            <Image source={{ uri: latest.photo_url }} style={styles.photoPreview} resizeMode="cover" />
          ) : null}
          {latest.note ? <Text style={styles.note}>"{latest.note}"</Text> : null}
          {latest.status === 'pending' ? (
            <Text style={styles.waitingOn}>Esperando que lo apruebe: {waitingOnLabel}</Text>
          ) : null}
          {latest.status === 'approved' ? (
            <Text style={styles.pointsAwarded}>+{latest.points_awarded} puntos otorgados</Text>
          ) : null}
        </Card>
      ) : null}

      {latest?.status === 'rejected' ? (
        <Card style={{ borderWidth: 2, borderColor: colors.danger }}>
          <Text style={styles.sectionTitle}>❌ Evidencia rechazada</Text>
          {latest.review_note ? <Text style={styles.note}>"{latest.review_note}"</Text> : null}
          <Text style={styles.description}>Puedes intentarlo de nuevo mientras el reto siga vigente.</Text>
        </Card>
      ) : null}

      {canSubmit ? (
        <>
          <View style={{ height: spacing.md }} />
          <Card>
            <Text style={styles.sectionTitle}>Marcar como hecho</Text>
            <View style={{ height: spacing.sm }} />
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            ) : null}
            <View style={styles.photoButtons}>
              <Button title="📷 Tomar foto" variant="secondary" onPress={() => pickImage(true)} style={{ flex: 1 }} />
              <View style={{ width: spacing.sm }} />
              <Button title="🖼️ Elegir foto" variant="secondary" onPress={() => pickImage(false)} style={{ flex: 1 }} />
            </View>
            <View style={{ height: spacing.sm }} />
            <Input placeholder="Nota (opcional)" value={note} onChangeText={setNote} multiline />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={{ height: spacing.md }} />
            <Button title="Marcar como hecho" onPress={handleComplete} loading={submitting} />
          </Card>
        </>
      ) : null}

      {!canSubmit && due.overdue && (!latest || latest.status === 'rejected') ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.note}>Esta tarea ya venció y no se puede completar.</Text>
        </View>
      ) : null}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notFound: { color: colors.textMuted },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', flex: 1, marginRight: spacing.sm },
  description: { color: colors.textMuted, marginTop: 6, fontSize: 13 },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  photoButtons: { flexDirection: 'row' },
  photoPreview: { width: '100%', height: 200, borderRadius: radius.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  note: { color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  waitingOn: { color: colors.warning, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  pointsAwarded: { color: colors.points, fontWeight: '700', marginTop: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.sm },
});
