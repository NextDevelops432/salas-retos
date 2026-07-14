import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Button, Card, Input } from '../../../components/UI';
import { colors, radius, spacing } from '../../../constants/theme';
import { durationToHours } from '../../../lib/format';

export default function CreateTaskScreen() {
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const router = useRouter();
  const isEditing = !!taskId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [amount, setAmount] = useState('24');
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loadingTask, setLoadingTask] = useState(isEditing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!taskId) return;
      supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
        .then(({ data }) => {
          if (data) {
            setTitle(data.title);
            setDescription(data.description ?? '');
            setPoints(String(data.points));
            setRequiresApproval(data.requires_approval);
            setIsRecurring(data.is_recurring);
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
          setLoadingTask(false);
        });
    }, [taskId])
  );

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError('Ponle un título al reto.');
    const pointsNum = parseInt(points, 10);
    if (!pointsNum || pointsNum <= 0) return setError('Los puntos deben ser un número mayor a 0.');
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) return setError('El plazo debe ser un número mayor a 0.');

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
        });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.back();
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
              ? 'Al guardar, este reto vuelve a quedar pendiente de aprobación por otro integrante.'
              : 'Este reto quedará pendiente hasta que otro integrante de la sala lo apruebe.'}
          </Text>
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
          <Button title={isEditing ? 'Guardar cambios' : 'Crear reto'} onPress={handleSubmit} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notice: { color: colors.textMuted, fontSize: 12 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  unitToggle: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  unitBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.sm },
  unitBtnActive: { backgroundColor: colors.primary },
  unitText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  unitTextActive: { color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.text, fontSize: 13, flex: 1, marginRight: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.sm },
});
