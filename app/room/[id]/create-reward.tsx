import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, Input } from '../../../components/UI';
import { colors, spacing } from '../../../constants/theme';

export default function CreateRewardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('50');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!title.trim()) return setError('Ponle un nombre a la recompensa.');
    const costNum = parseInt(cost, 10);
    if (!costNum || costNum <= 0) return setError('El costo debe ser un número mayor a 0.');
    if (!session) return;

    setLoading(true);
    const { error } = await supabase.from('rewards').insert({
      room_id: id,
      title: title.trim(),
      description: description.trim(),
      cost_points: costNum,
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
      <Stack.Screen options={{ title: 'Nueva recompensa' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
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
          <Button title="Crear recompensa" onPress={handleCreate} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.sm },
});
