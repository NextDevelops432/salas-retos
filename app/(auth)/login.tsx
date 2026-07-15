import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Button, Card, Input } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.bgGradientStart, colors.bgGradientEnd]} style={styles.hero}>
          <Text style={styles.emoji}>🏆</Text>
          <Text style={styles.title}>RetaMe</Text>
          <Text style={styles.subtitle}>Crea salas, cumple retos y canjea recompensas.</Text>
        </LinearGradient>

        <View style={{ height: spacing.lg }} />

        <Card>
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
        </Card>

        <View style={{ height: spacing.lg }} />
        <Link href="/(auth)/signup" style={styles.link}>
          ¿No tienes cuenta? Regístrate
        </Link>
        <View style={{ height: spacing.sm }} />
        <Link href="/(auth)/landing" style={styles.backLink}>
          ← Volver al inicio
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
  hero: {
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emoji: { fontSize: 48 },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
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
    fontWeight: '700',
  },
  backLink: {
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
});
