import React, {useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
  List,
  Button,
  TextInput,
  IconButton,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  api,
  Account,
  Card,
  AssetSummary,
  CreateAccountData,
  UpdateAccountData,
  CreateCardData,
  UpdateCardData,
} from '../../services/api';

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

type DialogMode = 'add' | 'edit';
type DialogTarget = 'account' | 'card';

interface AccountDialogState {
  visible: boolean;
  mode: DialogMode;
  target: 'account';
  editId: number | null;
  bankName: string;
  alias: string;
  balance: string;
}

interface CardDialogState {
  visible: boolean;
  mode: DialogMode;
  target: 'card';
  editId: number | null;
  cardCompany: string;
  alias: string;
  paymentDay: string;
}

type DialogState = AccountDialogState | CardDialogState;

const initialAccountDialog: AccountDialogState = {
  visible: false,
  mode: 'add',
  target: 'account',
  editId: null,
  bankName: '',
  alias: '',
  balance: '',
};

const initialCardDialog: CardDialogState = {
  visible: false,
  mode: 'add',
  target: 'card',
  editId: null,
  cardCompany: '',
  alias: '',
  paymentDay: '',
};

function AssetScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 데이터 상태
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 다이얼로그 상태
  const [dialog, setDialog] = useState<DialogState>(initialAccountDialog);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, accountsRes, cardsRes] = await Promise.all([
        api.getAssetSummary(),
        api.getAccounts(),
        api.getCards(),
      ]);
      setSummary(summaryRes.summary);
      setAccounts(accountsRes.accounts);
      setCards(cardsRes.cards);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : '데이터를 불러오는데 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ─── 계좌 다이얼로그 ───────────────────────────────────────────

  const openAddAccountDialog = useCallback(() => {
    setDialog({...initialAccountDialog, visible: true});
  }, []);

  const openEditAccountDialog = useCallback((account: Account) => {
    setDialog({
      visible: true,
      mode: 'edit',
      target: 'account',
      editId: account.id,
      bankName: account.bankName,
      alias: account.alias || '',
      balance: String(Number(account.balance)),
    });
  }, []);

  // ─── 카드 다이얼로그 ──────────────────────────────────────────

  const openAddCardDialog = useCallback(() => {
    setDialog({...initialCardDialog, visible: true});
  }, []);

  const openEditCardDialog = useCallback((card: Card) => {
    setDialog({
      visible: true,
      mode: 'edit',
      target: 'card',
      editId: card.id,
      cardCompany: card.cardCompany,
      alias: card.alias || '',
      paymentDay: card.paymentDay ? String(card.paymentDay) : '',
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(prev => ({...prev, visible: false} as DialogState));
  }, []);

  // ─── 저장 핸들러 ────────────────────────────────────────────

  const handleSaveAccount = useCallback(async () => {
    if (dialog.target !== 'account') {
      return;
    }
    const d = dialog as AccountDialogState;

    if (!d.bankName.trim()) {
      Alert.alert('알림', '은행명을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (d.mode === 'add') {
        const data: CreateAccountData = {
          bankName: d.bankName.trim(),
          alias: d.alias.trim() || undefined,
          balance: d.balance ? Number(d.balance) : undefined,
        };
        await api.createAccount(data);
      } else if (d.editId !== null) {
        const data: UpdateAccountData = {
          bankName: d.bankName.trim(),
          alias: d.alias.trim() || null,
          balance: d.balance ? Number(d.balance) : 0,
        };
        await api.updateAccount(d.editId, data);
      }
      closeDialog();
      await fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : '저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setSaving(false);
    }
  }, [dialog, closeDialog, fetchData]);

  const handleSaveCard = useCallback(async () => {
    if (dialog.target !== 'card') {
      return;
    }
    const d = dialog as CardDialogState;

    if (!d.cardCompany.trim()) {
      Alert.alert('알림', '카드사를 입력해주세요.');
      return;
    }

    if (d.paymentDay) {
      const day = Number(d.paymentDay);
      if (isNaN(day) || day < 1 || day > 31) {
        Alert.alert('알림', '결제일은 1~31 사이의 숫자를 입력해주세요.');
        return;
      }
    }

    setSaving(true);
    try {
      if (d.mode === 'add') {
        const data: CreateCardData = {
          cardCompany: d.cardCompany.trim(),
          alias: d.alias.trim() || undefined,
          paymentDay: d.paymentDay ? Number(d.paymentDay) : undefined,
        };
        await api.createCard(data);
      } else if (d.editId !== null) {
        const data: UpdateCardData = {
          cardCompany: d.cardCompany.trim(),
          alias: d.alias.trim() || null,
          paymentDay: d.paymentDay ? Number(d.paymentDay) : null,
        };
        await api.updateCard(d.editId, data);
      }
      closeDialog();
      await fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : '저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setSaving(false);
    }
  }, [dialog, closeDialog, fetchData]);

  // ─── 삭제 핸들러 ──────────────────────────────────────────

  const handleDeleteAccount = useCallback(
    (account: Account) => {
      Alert.alert(
        '삭제 확인',
        `"${account.alias || account.bankName}" 계좌를 삭제하시겠습니까?`,
        [
          {text: '취소', style: 'cancel'},
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteAccount(account.id);
                await fetchData();
              } catch (error: unknown) {
                const message =
                  error instanceof Error
                    ? error.message
                    : '삭제에 실패했습니다.';
                Alert.alert('오류', message);
              }
            },
          },
        ],
      );
    },
    [fetchData],
  );

  const handleDeleteCard = useCallback(
    (card: Card) => {
      Alert.alert(
        '삭제 확인',
        `"${card.alias || card.cardCompany}" 카드를 삭제하시겠습니까?`,
        [
          {text: '취소', style: 'cancel'},
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteCard(card.id);
                await fetchData();
              } catch (error: unknown) {
                const message =
                  error instanceof Error
                    ? error.message
                    : '삭제에 실패했습니다.';
                Alert.alert('오류', message);
              }
            },
          },
        ],
      );
    },
    [fetchData],
  );

  // ─── 다이얼로그 내용 렌더러 ──────────────────────────────────

  const renderDialogContent = () => {
    if (dialog.target === 'account') {
      const d = dialog as AccountDialogState;
      return (
        <>
          <Text
            variant="titleLarge"
            style={[styles.dialogTitle, {color: theme.colors.onSurface}]}>
            {d.mode === 'add' ? '계좌 추가' : '계좌 수정'}
          </Text>
          <TextInput
            label="은행명"
            value={d.bankName}
            onChangeText={text =>
              setDialog(prev => ({...prev, bankName: text} as AccountDialogState))
            }
            mode="outlined"
            style={styles.dialogInput}
            outlineColor={theme.colors.outline + '40'}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="별칭 (선택)"
            value={d.alias}
            onChangeText={text =>
              setDialog(prev => ({...prev, alias: text} as AccountDialogState))
            }
            mode="outlined"
            style={styles.dialogInput}
            outlineColor={theme.colors.outline + '40'}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="잔액"
            value={d.balance ? Number(d.balance).toLocaleString('ko-KR') : ''}
            onChangeText={text => {
              const numericOnly = text.replace(/[^0-9]/g, '');
              setDialog(prev => ({...prev, balance: numericOnly} as AccountDialogState));
            }}
            keyboardType="numeric"
            mode="outlined"
            style={styles.dialogInput}
            outlineColor={theme.colors.outline + '40'}
            activeOutlineColor={theme.colors.primary}
          />
        </>
      );
    } else {
      const d = dialog as CardDialogState;
      return (
        <>
          <Text
            variant="titleLarge"
            style={[styles.dialogTitle, {color: theme.colors.onSurface}]}>
            {d.mode === 'add' ? '카드 추가' : '카드 수정'}
          </Text>
          <TextInput
            label="카드사"
            value={d.cardCompany}
            onChangeText={text =>
              setDialog(prev => ({...prev, cardCompany: text} as CardDialogState))
            }
            mode="outlined"
            style={styles.dialogInput}
            outlineColor={theme.colors.outline + '40'}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="별칭 (선택)"
            value={d.alias}
            onChangeText={text =>
              setDialog(prev => ({...prev, alias: text} as CardDialogState))
            }
            mode="outlined"
            style={styles.dialogInput}
            outlineColor={theme.colors.outline + '40'}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="결제일 (1~31, 선택)"
            value={d.paymentDay}
            onChangeText={text => {
              const numericOnly = text.replace(/[^0-9]/g, '');
              setDialog(prev => ({...prev, paymentDay: numericOnly} as CardDialogState));
            }}
            keyboardType="numeric"
            mode="outlined"
            style={styles.dialogInput}
            outlineColor={theme.colors.outline + '40'}
            activeOutlineColor={theme.colors.primary}
          />
        </>
      );
    }
  };

  const handleDialogSave = dialog.target === 'account' ? handleSaveAccount : handleSaveCard;

  // ─── 렌더링 ───────────────────────────────────────────────────

  if (loading && accounts.length === 0 && cards.length === 0) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          {backgroundColor: theme.colors.background},
        ]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingTop: insets.top + 8}]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 총 자산 카드 */}
        <Surface style={styles.totalSurface} elevation={2}>
          <Text
            variant="titleSmall"
            style={{color: theme.colors.outline, marginBottom: 4}}>
            {'총 자산'}
          </Text>
          <Text
            variant="headlineLarge"
            style={{color: theme.colors.primary, fontWeight: '700'}}>
            {summary ? formatAmount(summary.totalBalance) : '0원'}
          </Text>
          <View style={styles.totalMeta}>
            <Text variant="bodySmall" style={{color: theme.colors.outline}}>
              {'계좌'} {summary?.accountCount ?? 0}{'개'}
            </Text>
            <Text
              variant="bodySmall"
              style={{color: theme.colors.outline, marginLeft: 16}}>
              {'카드'} {summary?.cardCount ?? 0}{'개'}
            </Text>
          </View>
        </Surface>

        {/* 계좌 섹션 */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
              {'계좌'}
            </Text>
            <Button
              mode="text"
              compact
              icon="plus"
              onPress={openAddAccountDialog}>
              {'추가'}
            </Button>
          </View>

          {accounts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline}}>
                {'등록된 계좌가 없습니다.'}
              </Text>
            </View>
          ) : (
            accounts.map((account, index) => (
              <React.Fragment key={account.id}>
                {index > 0 && <Divider />}
                <List.Item
                  title={account.alias || account.bankName}
                  description={account.alias ? account.bankName : undefined}
                  left={props => (
                    <List.Icon {...props} icon="bank" />
                  )}
                  right={() => (
                    <View style={styles.listRight}>
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: theme.colors.onSurface,
                          fontWeight: '600',
                          marginRight: 4,
                        }}>
                        {formatAmount(Number(account.balance))}
                      </Text>
                      <IconButton
                        icon="pencil-outline"
                        size={18}
                        onPress={() => openEditAccountDialog(account)}
                      />
                      <IconButton
                        icon="delete-outline"
                        size={18}
                        iconColor={theme.colors.error}
                        onPress={() => handleDeleteAccount(account)}
                      />
                    </View>
                  )}
                  style={styles.listItem}
                />
              </React.Fragment>
            ))
          )}
        </Surface>

        {/* 카드 섹션 */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
              {'카드'}
            </Text>
            <Button
              mode="text"
              compact
              icon="plus"
              onPress={openAddCardDialog}>
              {'추가'}
            </Button>
          </View>

          {cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline}}>
                {'등록된 카드가 없습니다.'}
              </Text>
            </View>
          ) : (
            cards.map((card, index) => (
              <React.Fragment key={card.id}>
                {index > 0 && <Divider />}
                <List.Item
                  title={card.alias || card.cardCompany}
                  description={
                    (card.alias ? card.cardCompany : '') +
                    (card.paymentDay
                      ? (card.alias ? ' · ' : '') +
                        `결제일 ${card.paymentDay}일`
                      : '')
                  }
                  left={props => (
                    <List.Icon {...props} icon="credit-card" />
                  )}
                  right={() => (
                    <View style={styles.listRight}>
                      <IconButton
                        icon="pencil-outline"
                        size={18}
                        onPress={() => openEditCardDialog(card)}
                      />
                      <IconButton
                        icon="delete-outline"
                        size={18}
                        iconColor={theme.colors.error}
                        onPress={() => handleDeleteCard(card)}
                      />
                    </View>
                  )}
                  style={styles.listItem}
                />
              </React.Fragment>
            ))
          )}
        </Surface>
      </ScrollView>

      {/* 추가 / 수정 모달 */}
      <Modal
        visible={dialog.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}>
        <Pressable style={styles.modalOverlay} onPress={closeDialog}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}>
            <Pressable
              style={[
                styles.dialogContainer,
                {backgroundColor: theme.colors.surface},
              ]}
              onPress={() => {}}>
              {renderDialogContent()}
              <View style={styles.dialogActions}>
                <Button
                  mode="text"
                  onPress={closeDialog}
                  disabled={saving}>
                  {'취소'}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleDialogSave}
                  loading={saving}
                  disabled={saving}
                  style={styles.dialogSaveButton}>
                  {'저장'}
                </Button>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  totalSurface: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  totalMeta: {
    flexDirection: 'row',
    marginTop: 8,
  },
  sectionSurface: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  listItem: {
    paddingRight: 4,
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalKeyboard: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  dialogTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  dialogInput: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  dialogSaveButton: {
    borderRadius: 8,
  },
});

export default AssetScreen;
