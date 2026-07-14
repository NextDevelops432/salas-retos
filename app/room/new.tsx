import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { Button, Card, Input } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';

export default function NewRoomScreen() {
  const router = useRouter();
  const { celebrate } = useToast();
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Ponle un nombre a la sala.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('create_room', {
      room_name: name.trim(),
      room_description: description.trim(),
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    celebrate({
      emoji: '🎉',
      title: '¡Sala creada!',
      message: 'Ahora invita a quien quieras con el código de invitación.',
      onDismiss: () => router.replace({ pathname: '/room/[id]', params: { id: data.id } }),
    });
  };

  const handleJoin = async () => {
    setError(null);
    if (!code.trim()) {
      setError('Ingresa el código de invitación.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('join_room', { code: code.trim() });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    celebrate({
      emoji: '🤝',
      title: '¡Te uniste a la sala!',
      message: `Ahora eres parte de "${data.name}".`,
      onDismiss: () => router.replace({ pathname: '/room/[id]', params: { id: data.id } }),
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Nueva sala' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentBtn, mode === 'create' && styles.segmentBtnActive]}
            onPress={() => setMode('create')}
          >
            <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextActive]}>Crear sala</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, mode === 'join' && styles.segmentBtnActive]}
            onPress={() => setMode('join')}
          >
            <Text style={[styles.segmentText, mode === 'join' && styles.segmentTextActive]}>Unirme con código</Text>
          </Pressable>
        </View>

        <View style={{ height: spacing.md }} />

        <Card>
          {mode === 'create' ? (
            <>
              <Text style={styles.label}>Nombre de la sala</Text>
              <View style={{ height: spacing.xs }} />
              <Input placeholder="Ej. Casa Diaz, Tareas de Juan..." value={name} onChangeText={setName} />
              <View style={{ height: spacing.sm }} />
              <Text style={styles.label}>Descripción (opcional)</Text>
              <View style={{ height: spacing.xs }} />
              <Input
                placeholder="¿Para qué es esta sala?"
                value={description}
                onChangeText={setDescription}
                multiline
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ height: spacing.md }} />
              <Button title="Crear sala" onPress={handleCreate} loading={loading} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Código de invitación</Text>
              <View style={{ height: spacing.xs }} />
              <Input
                placeholder="Ej. A1B2C3"
                autoCapitalize="characters"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ height: spacing.md }} />
              <Button title="Unirme" onPress={handleJoin} loading={loading} />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: colors.textOnPrimary },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.sm },
});
