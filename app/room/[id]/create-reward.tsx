import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../context/ToastContext';
import { Button, Card, Input } from '../../../components/UI';
import { colors, spacing } from '../../../constants/theme';

export default function CreateRewardScreen() {
  const { id, rewardId } = useLocalSearchParams<{ id: string; rewardId?: string }>();
  const router = useRouter();
  const { celebrate } = useToast();
  const isEditing = !!rewardId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('50');
  const [loadingReward, setLoadingReward] = useState(isEditing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!rewardId) return;
      supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .single()
        .then(({ data }) => {
          if (data) {
            setTitle(data.title);
            setDescription(data.description ?? '');
            setCost(String(data.cost_points));
          }
          setLoadingReward(false);
        });
    }, [rewardId])
  );

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError('Ponle un nombre a la recompensa.');
    const costNum = parseInt(cost, 10);
    if (!costNum || costNum <= 0) return setError('El costo debe ser un número mayor a 0.');

    setLoading(true);
    const { error } = isEditing
      ? await supabase.rpc('propose_reward_edit', {
          p_reward_id: rewardId,
          p_title: title.trim(),
          p_description: description.trim(),
          p_cost_points: costNum,
        })
      : await supabase.rpc('create_reward', {
          p_room_id: id,
          p_title: title.trim(),
          p_description: description.trim(),
          p_cost_points: costNum,
        });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    celebrate({
      emoji: '🎁',
      title: isEditing ? '¡Cambios guardados!' : '¡Recompensa propuesta!',
      message: 'Queda pendiente hasta que otro integrante de la sala la apruebe.',
      onDismiss: () => router.back(),
    });
  };

  if (loadingReward) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Editar recompensa' : 'Nueva recompensa' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.notice}>
            {isEditing
              ? 'Al guardar, esta recompensa vuelve a quedar pendiente de aprobación por otro integrante.'
              : 'Esta recompensa quedará pendiente hasta que otro integrante de la sala la apruebe.'}
          </Text>
          <View style={{ height: spacing.sm }} />

          <Text style={styles.label}>Nombre</Text>
          <View style={{ height: spacing.xs }} />
          <Input placeholder="Ej. Noche de videojuegos" value={title} onChangeText={setTitle} />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Descripción (opcional)</Text>
          <View style={{ height: spacing.xs }} />
          <Input placeholder="Detalles de la recompensa" value={description} onChangeText={setDescription} multiline />

          <View style={{ height: spacing.sm }} />
          <Text style={styles.label}>Costo en puntos</Text>
          <View style={{ height: spacing.xs }} />
          <Input placeholder="50" keyboardType="number-pad" value={cost} onChangeText={setCost} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ height: spacing.md }} />
          <Button title={isEditing ? 'Guardar cambios' : 'Crear recompensa'} onPress={handleSubmit} loading={loading} />
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
  error: { color: colors.danger, marginTop: spacing.sm },
});
