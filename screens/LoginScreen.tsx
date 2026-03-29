import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../App';

type LoginScreenNavigation = StackNavigationProp<RootStackParamList, 'Login'>;

type Theme = {
  background: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  primaryBg: string;
  primaryText: string;
  divider: string;
  dividerLabel: string;
  appleBg: string;
  appleIcon: string;
  googleBg: string;
  googleBorder: string;
  googleText: string;
  linkAccent: string;
};

const light: Theme = {
  background: '#FAF9F6',
  text: '#2C2C2A',
  textMuted: '#6B6965',
  textSubtle: '#8A8783',
  inputBg: '#FFFFFF',
  inputBorder: '#E5E2DC',
  placeholder: '#A9A6A0',
  primaryBg: '#2C2C2A',
  primaryText: '#FAF9F6',
  divider: '#E5E2DC',
  dividerLabel: '#9C9893',
  appleBg: '#000000',
  appleIcon: '#FFFFFF',
  googleBg: '#FAF9F6',
  googleBorder: '#D8D4CD',
  googleText: '#2C2C2A',
  linkAccent: '#6B6965',
};

const dark: Theme = {
  background: '#1C1C1A',
  text: '#F0EFEB',
  textMuted: '#B5B3AD',
  textSubtle: '#8E8C86',
  inputBg: '#252523',
  inputBorder: '#3A3A37',
  placeholder: '#6E6C68',
  primaryBg: '#FAF9F6',
  primaryText: '#2C2C2A',
  divider: '#3A3A37',
  dividerLabel: '#7A7873',
  appleBg: '#000000',
  appleIcon: '#FFFFFF',
  googleBg: '#252523',
  googleBorder: '#454542',
  googleText: '#F0EFEB',
  linkAccent: '#9C9893',
};

function createStyles(t: Theme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: t.background,
    },
    keyboard: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: '500',
      letterSpacing: -0.3,
      color: t.text,
      marginBottom: 12,
    },
    tagline: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
      color: t.textMuted,
      textAlign: 'center',
      paddingHorizontal: 16,
      letterSpacing: -0.1,
    },
    fieldGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: t.textSubtle,
      marginBottom: 8,
      marginLeft: 2,
      letterSpacing: 0.2,
    },
    inputShell: {
      backgroundColor: t.inputBg,
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: 14,
      minHeight: 52,
      justifyContent: 'center',
    },
    input: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      fontSize: 16,
      color: t.text,
      letterSpacing: -0.2,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingLeft: 18,
      paddingRight: 6,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 14,
      paddingRight: 8,
      fontSize: 16,
      color: t.text,
      letterSpacing: -0.2,
    },
    toggle: {
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    toggleText: {
      fontSize: 14,
      fontWeight: '500',
      color: t.linkAccent,
    },
    primaryButton: {
      backgroundColor: t.primaryBg,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    primaryLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: t.primaryText,
      letterSpacing: -0.2,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 28,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.divider,
    },
    dividerOr: {
      marginHorizontal: 16,
      fontSize: 13,
      fontWeight: '500',
      color: t.dividerLabel,
      letterSpacing: 0.5,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      paddingVertical: 15,
      marginBottom: 12,
    },
    appleButton: {
      backgroundColor: t.appleBg,
    },
    googleButton: {
      backgroundColor: t.googleBg,
      borderWidth: 1,
      borderColor: t.googleBorder,
    },
    socialLabel: {
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 10,
      letterSpacing: -0.2,
    },
    appleLabel: {
      color: '#FFFFFF',
    },
    googleLabel: {
      color: t.googleText,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 36,
      paddingBottom: 8,
    },
    footerText: {
      fontSize: 14,
      color: t.textSubtle,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '500',
      color: t.linkAccent,
    },
  });
}

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigation>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = isDark ? dark : light;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const goToOnboarding = () => navigation.navigate('Onboarding');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.edu$/i.test(email)) {
      setError('Only university .edu email addresses are allowed.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
    // Navigation is handled by the auth guard in App.tsx
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Crashly</Text>
            <Text style={styles.tagline}>
              find your place, wherever you land
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputShell}>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                />
                <Pressable
                  style={styles.toggle}
                  onPress={() => setShowPassword((s) => !s)}
                  hitSlop={8}
                >
                  <Text style={styles.toggleText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {error && (
            <Text style={{ color: 'red', marginBottom: 8, textAlign: 'center' }}>{error}</Text>
          )}

          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            <Text style={styles.primaryLabel}>{loading ? 'Signing in…' : 'Continue'}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerOr}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={[styles.socialButton, styles.appleButton]}
            onPress={goToOnboarding}
          >
            <FontAwesome5 name="apple" size={20} color={theme.appleIcon} brand />
            <Text style={[styles.socialLabel, styles.appleLabel]}>
              Continue with Apple
            </Text>
          </Pressable>

          <Pressable
            style={[styles.socialButton, styles.googleButton]}
            onPress={goToOnboarding}
          >
            <FontAwesome5
              name="google"
              size={18}
              color={theme.googleText}
              brand
            />
            <Text style={[styles.socialLabel, styles.googleLabel]}>
              Continue with Google
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="link"
              onPress={goToOnboarding}
            >
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
