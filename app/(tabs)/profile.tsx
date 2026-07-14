import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button, Card, Input } from '../../components/UI';
import { colors, spacing } from '../../constants/theme';

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!session) return;
    setError(null);
    setSaved(false);
    if (!username.trim()) {
      setError('El nombre de usuario no puede estar vacío.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    await refreshProfile();
  };

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.avatar}>👤</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
      </Card>

      <View style={{ height: spacing.md }} />

      <Card>
        <Text style={styles.label}>Nombre de usuario</Text>
        <View style={{ height: spacing.xs }} />
        <Input value={username} onChangeText={setUsername} autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Guardado ✓</Text> : null}
        <View style={{ height: spacing.sm }} />
        <Button title="Guardar cambios" onPress={handleSave} loading={saving} />
      </Card>

      <View style={{ height: spacing.lg }} />

      <Button title="Cerrar sesión" variant="danger" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  avatar: { fontSize: 40, textAlign: 'center' },
  email: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.xs },
  saved: { color: colors.accent, marginTop: spacing.xs },
});
