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
import {api} from '../../services/api';
import {useAuth} from '../../context/AuthContext';

function OnboardingScreen(): React.JSX.Element {
  const theme = useTheme();
  const {completeOnboarding, userNickname} = useAuth();
  const [nickname, setNickname] = useState(userNickname || '');
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert('입력 오류', '닉네임을 입력해주세요.');
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert('입력 오류', '닉네임은 20자 이하로 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      await api.updateProfile(trimmed);
      completeOnboarding();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '프로필 저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setLoading(false);
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
            variant="headlineSmall"
            style={[styles.title, {color: theme.colors.onBackground}]}>
            환영합니다!
          </Text>
          <Text
            variant="bodyLarge"
            style={{color: theme.colors.onBackground, opacity: 0.7}}>
            사용할 닉네임을 설정해주세요
          </Text>
        </View>

        <Surface style={styles.form} elevation={1}>
          <TextInput
            label="닉네임"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            autoFocus
            mode="outlined"
            style={styles.input}
            maxLength={20}
            left={<TextInput.Icon icon="account-outline" />}
          />

          <Button
            mode="contained"
            onPress={handleComplete}
            disabled={loading || !nickname.trim()}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            {loading ? (
              <ActivityIndicator size={20} color="#fff" />
            ) : (
              '시작하기'
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
    marginBottom: 16,
  },
  title: {
    fontWeight: '600',
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
});

export default OnboardingScreen;
