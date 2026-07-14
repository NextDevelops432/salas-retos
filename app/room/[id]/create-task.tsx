import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, EmojiPicker, Input, MemberPicker } from '../../../components/UI';
import { colors, radius, spacing } from '../../../constants/theme';
import { durationToHours } from '../../../lib/format';

const TASK_EMOJI_PICKS = ['✅', '⭐', '🏆', '🧹', '🍳', '📚', '🛁', '🧺', '🍽️', '🐾', '🏋️', '🗑️', '🌱', '🚗', '💻'];

export default function CreateTaskScreen() {
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { celebrate } = useToast();
  const isEditing = !!taskId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [amount, setAmount] = useState('24');
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [icon, setIcon] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);
  const [loadingTask, setLoadingTask] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;

      const run = async () => {
        setLoadingTask(true);

        let roomId = id;
        let existingAssignee: string | null = null;

        if (taskId) {
          const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single();
          if (data) {
            setTitle(data.title);
            setDescription(data.description ?? '');
            setPoints(String(data.points));
            setRequiresApproval(data.requires_approval);
            setIsRecurring(data.is_recurring);
            setIcon(data.icon ?? '');
            existingAssignee = data.assigned_to;
            roomId = data.room_id;
            if (data.recurrence_hours) {
              if (data.recurrence_hours % 24 === 0) {
                setAmount(String(data.recurrence_hours / 24));
                setUnit('days');
              } else {
                setAmount(String(data.recurrence_hours));
                setUnit('hours');
              }
            }
          }
        }

        const { data: memberRows } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomId)
          .neq('user_id', session.user.id);
        const otherIds = (memberRows ?? []).map((m) => m.user_id);
        let otherMembers: { id: string; username: string }[] = [];
        if (otherIds.length) {
          const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', otherIds);
          otherMembers = profiles ?? [];
        }

        if (!cancelled) {
          setMembers(otherMembers);
          setAssignedTo(existingAssignee ?? (otherMembers.length === 1 ? otherMembers[0].id : null));
          setLoadingTask(false);
        }
      };

      run();
      return () => {
        cancelled = true;
      };
    }, [taskId, id, session])
  );

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError('Ponle un título al reto.');
    const pointsNum = parseInt(points, 10);
    if (!pointsNum || pointsNum <= 0) return setError('Los puntos deben ser un número mayor a 0.');
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) return setError('El plazo debe ser un número mayor a 0.');
    if (!assignedTo) return setError('Elige a quién le asignas este reto.');

    const hours = durationToHours(amountNum, unit);
    setLoading(true);
    const { error } = isEditing
      ? await supabase.rpc('propose_task_edit', {
          p_task_id: taskId,
          p_title: title.trim(),
          p_description: description.trim(),
          p_points: pointsNum,
          p_due_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
          p_requires_approval: requiresApproval,
          p_is_recurring: isRecurring,
          p_recurrence_hours: isRecurring ? hours : null,
          p_icon: icon || null,
          p_assigned_to: assignedTo,
        })
      : await supabase.rpc('create_task', {
          p_room_id: id,
          p_title: title.trim(),
          p_description: description.trim(),
          p_points: pointsNum,
          p_due_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
          p_requires_approval: requiresApproval,
          p_is_recurring: isRecurring,
          p_recurrence_hours: isRecurring ? hours : null,
          p_icon: icon || null,
          p_assigned_to: assignedTo,
        });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const assigneeName = members.find((m) => m.id === assignedTo)?.username ?? '';
    celebrate({
      emoji: '📝',
      title: isEditing ? '¡Cambios guardados!' : '¡Reto asignado!',
      message: isEditing
        ? `${assigneeName} tiene que confirmar los cambios.`
        : `${assigneeName} ya puede completar este reto.`,
      onDismiss: () => router.back(),
    });
  };

  if (loadingTask) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Editar reto' : 'Nuevo reto' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.notice}>
            {isEditing
              ? 'Si cambias algo, la persona asignada tiene que confirmarlo de nuevo.'
              : 'Le asignas este reto a otro integrante de la sala — al crearlo, ya queda listo para que lo complete.'}
          </Text>
          <View style={{ height: spacing.sm }} />

          <Text style={styles.label}>Asignar a</Text>
          <View style={{ height: spacing.xs }} />
          <MemberPicker members={members} value={assignedTo} onChange={setAssignedTo} />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Ícono</Text>
          <View style={{ height: spacing.xs }} />
          <EmojiPicker value={icon} onChange={setIcon} quickPicks={TASK_EMOJI_PICKS} fallback="✅" />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Título</Text>
          <View style={{ height: spacing.xs }} />
          <Input placeholder="Ej. Barrer la casa" value={title} onChangeText={setTitle} />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Descripción (opcional)</Text>
          <View style={{ height: spacing.xs }} />
          <Input placeholder="Detalles del reto" value={description} onChangeText={setDescription} multiline />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Puntos que otorga</Text>
          <View style={{ height: spacing.xs }} />
          <Input placeholder="10" keyboardType="number-pad" value={points} onChangeText={setPoints} />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Vence en (a partir de ahora)</Text>
          <View style={{ height: spacing.xs }} />
          <View style={styles.row}>
            <Input
              style={{ flex: 1 }}
              placeholder="24"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={{ width: spacing.sm }} />
            <View style={styles.unitToggle}>
              <Pressable
                style={[styles.unitBtn, unit === 'hours' && styles.unitBtnActive]}
                onPress={() => setUnit('hours')}
              >
                <Text style={[styles.unitText, unit === 'hours' && styles.unitTextActive]}>Horas</Text>
              </Pressable>
              <Pressable
                style={[styles.unitBtn, unit === 'days' && styles.unitBtnActive]}
                onPress={() => setUnit('days')}
              >
                <Text style={[styles.unitText, unit === 'days' && styles.unitTextActive]}>Días</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: spacing.md }} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Requiere aprobación antes de otorgar puntos</Text>
            <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ true: colors.primary }} />
          </View>
          <View style={{ height: spacing.sm }} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Reto recurrente (se repite al completarse)</Text>
            <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: colors.primary }} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ height: spacing.md }} />
          <Button title={isEditing ? 'Guardar cambios' : 'Asignar reto'} onPress={handleSubmit} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notice: { color: colors.textMuted, fontSize: 12 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  unitToggle: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  unitBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.sm },
  unitBtnActive: { backgroundColor: colors.primary },
  unitText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  unitTextActive: { color: colors.textOnPrimary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.text, fontSize: 13, flex: 1, marginRight: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.sm },
});
