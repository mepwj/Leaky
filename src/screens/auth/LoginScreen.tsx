import React, {useState, useEffect, useCallback} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import {
  Text,
  Button,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {api} from '../../services/api';
import {useAuth} from '../../context/AuthContext';
import {GOOGLE_WEB_CLIENT_ID} from '../../config/env';

function LoginScreen(): React.JSX.Element {
  const theme = useTheme();
  const {signIn} = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignInResult = useCallback(async (idToken: string) => {
    try {
      const result = await api.googleLogin(idToken);
      await signIn(result.token, result.user.onboardingCompleted, result.user.nickname);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.';
      if (Platform.OS === 'web') {
        alert('Google 로그인 실패: ' + message);
      } else {
        const {Alert} = require('react-native');
        Alert.alert('Google 로그인 실패', message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [signIn]);

  // Web: Load Google Identity Services
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        callback: (response: {credential: string}) => {
          setGoogleLoading(true);
          handleSignInResult(response.credential);
        },
      });
      // @ts-ignore
      window.google?.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        {
          theme: 'outline',
          size: 'large',
          width: 300,
          text: 'signin_with',
          locale: 'ko',
        },
      );
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [handleSignInResult]);

  const handleNativeGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const {GoogleSignin} = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;

      if (!idToken) {
        throw new Error('Google 인증 토큰을 받지 못했습니다.');
      }

      await handleSignInResult(idToken);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.';
      const {Alert} = require('react-native');
      Alert.alert('Google 로그인 실패', message);
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
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
          {Platform.OS === 'web' ? (
            <View style={styles.webButtonContainer}>
              {googleLoading && <ActivityIndicator size={20} style={{marginBottom: 12}} />}
              <View nativeID="google-signin-btn" />
            </View>
          ) : (
            <Button
              mode="contained"
              onPress={handleNativeGoogleSignIn}
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
          )}
        </Surface>
      </View>
    </View>
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
  webButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  button: {
    marginTop: 4,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default LoginScreen;
