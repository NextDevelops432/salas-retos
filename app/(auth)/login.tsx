import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../../components/UI';
import { colors, spacing } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🏆</Text>
        <Text style={styles.title}>Salas de Retos</Text>
        <Text style={styles.subtitle}>Crea salas, cumple retos y canjea recompensas.</Text>

        <View style={{ height: spacing.lg }} />

        <Input
          placeholder="Correo electrónico"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View style={{ height: spacing.sm }} />
        <Input placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ height: spacing.md }} />
        <Button title="Entrar" onPress={handleLogin} loading={loading} />

        <View style={{ height: spacing.lg }} />
        <Link href="/(auth)/signup" style={styles.link}>
          ¿No tienes cuenta? Regístrate
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emoji: { fontSize: 48, textAlign: 'center' },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
