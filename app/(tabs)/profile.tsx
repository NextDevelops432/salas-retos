import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Button, Card, Input } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const { notify } = useToast();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!session) return;
    setError(null);
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
    notify({ tone: 'success', title: 'Perfil actualizado' });
    await refreshProfile();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={[colors.bgGradientStart, colors.bgGradientEnd]} style={styles.hero}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatar}>👤</Text>
        </View>
        <Text style={styles.username}>{profile?.username}</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
      </LinearGradient>

      <View style={{ height: spacing.md }} />

      <Card>
        <Text style={styles.label}>Nombre de usuario</Text>
        <View style={{ height: spacing.xs }} />
        <Input value={username} onChangeText={setUsername} autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: spacing.sm }} />
        <Button title="Guardar cambios" onPress={handleSave} loading={saving} />
      </Card>

      <View style={{ height: spacing.lg }} />

      <Button title="Cerrar sesión" variant="danger" onPress={() => signOut()} />
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatar: { fontSize: 34 },
  username: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  email: { color: 'rgba(255,255,255,0.8)', marginTop: 2, fontSize: 13 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.xs },
});
