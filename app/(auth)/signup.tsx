import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Card, Input } from '../../components/UI';
import { colors, spacing } from '../../constants/theme';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignup = async () => {
    setError(null);
    setInfo(null);
    if (!username || !email || !password) {
      setError('Completa todos los campos.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setInfo('Revisa tu correo para confirmar la cuenta y luego inicia sesión.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Únete a RetaMe</Text>
        <Text style={styles.subtitle}>Crea tu cuenta y arma tu primera sala de retos.</Text>

        <View style={{ height: spacing.lg }} />

        <Card>
          <Input placeholder="Nombre de usuario" autoCapitalize="none" value={username} onChangeText={setUsername} />
          <View style={{ height: spacing.sm }} />
          <Input
            placeholder="Correo electrónico"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <View style={{ height: spacing.sm }} />
          <Input placeholder="Contraseña (mín. 6 caracteres)" secureTextEntry value={password} onChangeText={setPassword} />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <View style={{ height: spacing.md }} />
          <Button title="Registrarme" onPress={handleSignup} loading={loading} />
        </Card>

        <View style={{ height: spacing.lg }} />
        <Link href="/(auth)/login" style={styles.link}>
          ¿Ya tienes cuenta? Inicia sesión
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
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  emoji: { fontSize: 40, textAlign: 'center' },
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
  info: {
    color: colors.accent,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
});
