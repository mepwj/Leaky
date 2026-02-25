import React, {useState} from 'react';
import {View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {api} from '../../services/api';
import {useAuth} from '../../context/AuthContext';

type SignupScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Signup'
>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

function SignupScreen({navigation}: Props): React.JSX.Element {
  const theme = useTheme();
  const {signIn} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!email.trim()) {
      return '이메일을 입력해주세요.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return '올바른 이메일 형식이 아닙니다.';
    }
    if (password.length < 6) {
      return '비밀번호는 6자 이상이어야 합니다.';
    }
    if (password !== passwordConfirm) {
      return '비밀번호가 일치하지 않습니다.';
    }
    return null;
  };

  const handleSignup = async () => {
    const error = validate();
    if (error) {
      Alert.alert('입력 오류', error);
      return;
    }

    try {
      setLoading(true);
      const result = await api.signup(email.trim(), password);
      await signIn(result.token, result.user.onboardingCompleted, result.user.nickname);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      Alert.alert('회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text
            variant="headlineMedium"
            style={[styles.title, {color: theme.colors.onBackground}]}>
            회원가입
          </Text>
          <Text
            variant="bodyMedium"
            style={{color: theme.colors.onBackground, opacity: 0.7}}>
            Leaky와 함께 스마트한 가계부를 시작하세요
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

          <TextInput
            label="비밀번호 확인"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry={!passwordConfirmVisible}
            mode="outlined"
            style={styles.input}
            error={
              passwordConfirm.length > 0 && password !== passwordConfirm
            }
            left={<TextInput.Icon icon="lock-check-outline" />}
            right={
              <TextInput.Icon
                icon={
                  passwordConfirmVisible ? 'eye-off-outline' : 'eye-outline'
                }
                onPress={() => setPasswordConfirmVisible(v => !v)}
              />
            }
          />

          <Button
            mode="contained"
            onPress={handleSignup}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            {loading ? <ActivityIndicator size={20} color="#fff" /> : '회원가입'}
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            disabled={loading}
            style={styles.linkButton}>
            로그인으로 돌아가기
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
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
  linkButton: {
    marginTop: 8,
  },
});

export default SignupScreen;
