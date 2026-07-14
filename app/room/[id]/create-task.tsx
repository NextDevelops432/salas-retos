import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, Input } from '../../../components/UI';
import { colors, radius, spacing } from '../../../constants/theme';
import { durationToHours } from '../../../lib/format';

export default function CreateTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [amount, setAmount] = useState('24');
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!title.trim()) return setError('Ponle un título al reto.');
    const pointsNum = parseInt(points, 10);
    if (!pointsNum || pointsNum <= 0) return setError('Los puntos deben ser un número mayor a 0.');
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) return setError('El plazo debe ser un número mayor a 0.');
    if (!session) return;

    const hours = durationToHours(amountNum, unit);
    setLoading(true);
    const { error } = await supabase.from('tasks').insert({
      room_id: id,
      title: title.trim(),
      description: description.trim(),
      points: pointsNum,
      due_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      requires_approval: requiresApproval,
      is_recurring: isRecurring,
      recurrence_hours: isRecurring ? hours : null,
      created_by: session.user.id,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Nuevo reto' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
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
          <Text style={styles.label}>Vence en</Text>
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
          <Button title="Crear reto" onPress={handleCreate} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
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
