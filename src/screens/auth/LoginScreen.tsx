import React, {useState} from 'react';
import {View, StyleSheet, KeyboardAvoidingView, Platform, Alert} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {api} from '../../services/api';
import {useAuth} from '../../context/AuthContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

function LoginScreen({navigation}: Props): React.JSX.Element {
  const theme = useTheme();
  const {signIn} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const result = await api.login(email.trim(), password);
      await signIn(result.token, result.user.onboardingCompleted, result.user.nickname);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '로그인에 실패했습니다.';
      Alert.alert('로그인 실패', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;

      if (!idToken) {
        throw new Error('Google 인증 토큰을 받지 못했습니다.');
      }

      const result = await api.googleLogin(idToken);
      await signIn(result.token, result.user.onboardingCompleted, result.user.nickname);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.';
      Alert.alert('Google 로그인 실패', message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text
            variant="displayMedium"
            style={[styles.logo, {color: theme.colors.primary}]}>
            Leaky
          </Text>
          <Text
            variant="bodyLarge"
            style={{color: theme.colors.onBackground, opacity: 0.7}}>
            가계부를 스마트하게
          </Text>
        </View>

        <Surface style={styles.form} elevation={1}>
          <TextInput
            label="이메일"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="email-outline" />}
          />

          <TextInput
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setPasswordVisible(v => !v)}
              />
            }
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            disabled={loading || googleLoading}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            {loading ? <ActivityIndicator size={20} color="#fff" /> : '로그인'}
          </Button>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, {backgroundColor: theme.colors.outline}]} />
            <Text
              variant="bodySmall"
              style={[styles.dividerText, {color: theme.colors.outline}]}>
              또는
            </Text>
            <View style={[styles.divider, {backgroundColor: theme.colors.outline}]} />
          </View>

          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            icon="google">
            {googleLoading ? (
              <ActivityIndicator size={20} />
            ) : (
              'Google로 로그인'
            )}
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Signup')}
            disabled={loading || googleLoading}
            style={styles.linkButton}>
            회원가입
          </Button>
        </Surface>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontWeight: '700',
    marginBottom: 8,
  },
  form: {
    borderRadius: 16,
    padding: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
  },
  linkButton: {
    marginTop: 8,
  },
});

export default LoginScreen;
