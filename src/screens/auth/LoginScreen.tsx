import React, {useState} from 'react';
import {View, StyleSheet, KeyboardAvoidingView, Platform, Alert} from 'react-native';
import {
  Text,
  Button,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {api} from '../../services/api';
import {useAuth} from '../../context/AuthContext';

function LoginScreen(): React.JSX.Element {
  const theme = useTheme();
  const {signIn} = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

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
            Google 계정으로 빠르게 시작하세요
          </Text>
        </View>

        <Surface style={styles.form} elevation={1}>
          <Button
            mode="contained"
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            icon="google">
            {googleLoading ? (
              <ActivityIndicator size={20} color="#FFFFFF" />
            ) : (
              'Google로 로그인'
            )}
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
  button: {
    marginTop: 4,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default LoginScreen;
