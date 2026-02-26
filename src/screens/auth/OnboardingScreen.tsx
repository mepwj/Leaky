import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
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
  const [accountBankName, setAccountBankName] = useState('');
  const [accountAlias, setAccountAlias] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [cardCompany, setCardCompany] = useState('');
  const [cardAlias, setCardAlias] = useState('');
  const [cardPaymentDay, setCardPaymentDay] = useState('');
  const [loading, setLoading] = useState(false);

  const hasAccountInput =
    !!accountBankName.trim() || !!accountAlias.trim() || !!accountBalance.trim();
  const hasCardInput =
    !!cardCompany.trim() || !!cardAlias.trim() || !!cardPaymentDay.trim();

  const handleComplete = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      Alert.alert('입력 오류', '닉네임을 입력해주세요.');
      return;
    }
    if (trimmedNickname.length > 20) {
      Alert.alert('입력 오류', '닉네임은 20자 이하로 입력해주세요.');
      return;
    }

    if (hasAccountInput && !accountBankName.trim()) {
      Alert.alert('입력 오류', '계좌를 등록하려면 은행명을 입력해주세요.');
      return;
    }

    if (hasCardInput && !cardCompany.trim()) {
      Alert.alert('입력 오류', '카드를 등록하려면 카드사를 입력해주세요.');
      return;
    }

    if (cardPaymentDay.trim()) {
      const day = Number(cardPaymentDay);
      if (isNaN(day) || day < 1 || day > 31) {
        Alert.alert('입력 오류', '카드 결제일은 1~31 사이 숫자로 입력해주세요.');
        return;
      }
    }

    setLoading(true);
    let createdAccountId: number | null = null;
    let createdCardId: number | null = null;

    try {
      if (hasAccountInput) {
        const accountRes = await api.createAccount({
          bankName: accountBankName.trim(),
          alias: accountAlias.trim() || undefined,
          balance: accountBalance ? Number(accountBalance) : undefined,
        });
        createdAccountId = accountRes.account.id;
      }

      if (hasCardInput) {
        const cardRes = await api.createCard({
          cardCompany: cardCompany.trim(),
          alias: cardAlias.trim() || undefined,
          cardType: 'credit',
          paymentDay: cardPaymentDay ? Number(cardPaymentDay) : undefined,
        });
        createdCardId = cardRes.card.id;
      }

      await api.updateProfile(trimmedNickname);

      completeOnboarding();
    } catch (error: unknown) {
      const rollbackTasks: Promise<unknown>[] = [];
      if (createdCardId !== null) {
        rollbackTasks.push(api.deleteCard(createdCardId));
      }
      if (createdAccountId !== null) {
        rollbackTasks.push(api.deleteAccount(createdAccountId));
      }

      if (rollbackTasks.length > 0) {
        await Promise.allSettled(rollbackTasks);
      }

      const message =
        error instanceof Error
          ? error.message
          : '초기 설정 저장에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('오류', message);
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
            variant="displayMedium"
            style={[styles.logo, {color: theme.colors.primary}]}>
            Leaky
          </Text>
          <Text
            variant="headlineSmall"
            style={[styles.title, {color: theme.colors.onBackground}]}>
            시작하기 전 1분 설정
          </Text>
          <Text
            variant="bodyMedium"
            style={{color: theme.colors.onBackground, opacity: 0.7, textAlign: 'center'}}>
            닉네임은 필수이고 계좌/카드는 지금 입력하거나 나중에 설정할 수 있어요.
          </Text>
        </View>

        <Surface style={styles.form} elevation={1}>
          <TextInput
            label="닉네임"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            maxLength={20}
            left={<TextInput.Icon icon="account-outline" />}
          />

          <Text variant="titleSmall" style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>선택: 계좌</Text>
          <TextInput
            label="은행명"
            value={accountBankName}
            onChangeText={setAccountBankName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="별칭"
            value={accountAlias}
            onChangeText={setAccountAlias}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="현재 잔액"
            value={accountBalance ? Number(accountBalance).toLocaleString('ko-KR') : ''}
            onChangeText={text => setAccountBalance(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            right={<TextInput.Affix text="원" />}
          />

          <Text variant="titleSmall" style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>선택: 카드</Text>
          <TextInput
            label="카드사"
            value={cardCompany}
            onChangeText={setCardCompany}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="별칭"
            value={cardAlias}
            onChangeText={setCardAlias}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="결제일 (1~31)"
            value={cardPaymentDay}
            onChangeText={text => setCardPaymentDay(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleComplete}
            disabled={loading || !nickname.trim()}
            style={styles.button}
            contentStyle={styles.buttonContent}>
            {loading ? (
              <ActivityIndicator size={20} color="#FFFFFF" />
            ) : (
              '완료하고 시작하기'
            )}
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
    marginBottom: 24,
  },
  logo: {
    fontWeight: '700',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
  },
  form: {
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 10,
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});

export default OnboardingScreen;
