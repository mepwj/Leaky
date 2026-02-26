import React, {useState, useCallback, useMemo} from 'react';
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
  TouchableOpacity,
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
  SegmentedButtons,
} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  api,
  Account,
  Card,
  Transaction,
  AssetSummary,
  CreateAccountData,
  UpdateAccountData,
  CreateCardData,
  UpdateCardData,
} from '../../services/api';

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

type DialogMode = 'add' | 'edit';

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
  cardType: 'credit' | 'check';
  paymentDay: string;
  linkedAccountId: number | null;
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
  cardType: 'credit',
  paymentDay: '',
  linkedAccountId: null,
};

function AssetScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 데이터 상태
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState('');

  // 다이얼로그 상태
  const [dialog, setDialog] = useState<DialogState>(initialAccountDialog);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const month = getCurrentMonthString();
      const [summaryRes, accountsRes, cardsRes, transactionsRes, cashRes] = await Promise.all([
        api.getAssetSummary(),
        api.getAccounts(),
        api.getCards(),
        api.getTransactions(month),
        api.getCashBalance(),
      ]);
      setSummary(summaryRes.summary);
      setAccounts(accountsRes.accounts);
      setCards(cardsRes.cards);
      setTransactions(transactionsRes.transactions);
      setCashBalance(cashRes.cashBalance);
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

  const cardExpenseByCardId = useMemo(() => {
    const totals = new Map<number, number>();

    for (const tx of transactions) {
      if (tx.type !== 'expense' || !tx.cardId) {
        continue;
      }

      const amount = Number(tx.amount);
      totals.set(tx.cardId, (totals.get(tx.cardId) || 0) + amount);
    }

    return totals;
  }, [transactions]);

  const monthlyCardExpense = useMemo(() => {
    let total = 0;
    for (const amount of cardExpenseByCardId.values()) {
      total += amount;
    }
    return total;
  }, [cardExpenseByCardId]);

  const expectedCardPayment = useMemo(() => {
    return cards.reduce((sum, card) => {
      if (card.cardType !== 'credit') {
        return sum;
      }
      return sum + (cardExpenseByCardId.get(card.id) || 0);
    }, 0);
  }, [cards, cardExpenseByCardId]);

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
      cardType: (card.cardType as 'credit' | 'check') || 'credit',
      paymentDay: card.paymentDay ? String(card.paymentDay) : '',
      linkedAccountId: card.linkedAccountId || null,
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

    if (d.cardType === 'check' && !d.linkedAccountId) {
      Alert.alert('알림', '체크카드는 연결할 계좌를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (d.mode === 'add') {
        const data: CreateCardData = {
          cardCompany: d.cardCompany.trim(),
          alias: d.alias.trim() || undefined,
          cardType: d.cardType,
          paymentDay: d.cardType === 'credit' && d.paymentDay ? Number(d.paymentDay) : undefined,
          linkedAccountId: d.cardType === 'check' ? d.linkedAccountId ?? undefined : undefined,
        };
        await api.createCard(data);
      } else if (d.editId !== null) {
        const data: UpdateCardData = {
          cardCompany: d.cardCompany.trim(),
          alias: d.alias.trim() || null,
          cardType: d.cardType,
          paymentDay: d.cardType === 'credit' && d.paymentDay ? Number(d.paymentDay) : null,
          linkedAccountId: d.cardType === 'check' ? d.linkedAccountId : null,
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

  // ─── 현금 저장 핸들러 ────────────────────────────────────────

  const handleSaveCash = useCallback(async () => {
    try {
      setSaving(true);
      const result = await api.updateCashBalance(Number(cashInput) || 0);
      setCashBalance(result.cashBalance);
      setEditingCash(false);
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setSaving(false);
    }
  }, [cashInput, fetchData]);

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
          {/* 카드 타입 선택 */}
          <Text variant="bodyMedium" style={{color: theme.colors.onSurface, marginBottom: 8, fontWeight: '500'}}>
            카드 종류
          </Text>
          <SegmentedButtons
            value={d.cardType}
            onValueChange={value =>
              setDialog(prev => ({
                ...prev,
                cardType: value as 'credit' | 'check',
                linkedAccountId: value === 'credit' ? null : (prev as CardDialogState).linkedAccountId,
              } as CardDialogState))
            }
            buttons={[
              {value: 'credit', label: '신용카드'},
              {value: 'check', label: '체크카드'},
            ]}
            style={{marginBottom: 12}}
          />
          {/* 신용카드: 결제일 입력 */}
          {d.cardType === 'credit' && (
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
          )}
          {/* 체크카드: 연결 계좌 선택 */}
          {d.cardType === 'check' && (
            <View style={{marginBottom: 12}}>
              <Text variant="bodyMedium" style={{color: theme.colors.onSurface, marginBottom: 8, fontWeight: '500'}}>
                연결 계좌 (필수)
              </Text>
              {accounts.length === 0 ? (
                <Text variant="bodySmall" style={{color: theme.colors.outline}}>
                  등록된 계좌가 없습니다. 먼저 계좌를 추가해주세요.
                </Text>
              ) : (
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                  {accounts.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: d.linkedAccountId === acc.id ? theme.colors.primary : theme.colors.outline + '20',
                        backgroundColor: d.linkedAccountId === acc.id ? theme.colors.primaryContainer : 'transparent',
                      }}
                      onPress={() =>
                        setDialog(prev => ({...prev, linkedAccountId: acc.id} as CardDialogState))
                      }>
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: d.linkedAccountId === acc.id ? theme.colors.primary : theme.colors.onSurface,
                          fontWeight: d.linkedAccountId === acc.id ? '600' : '400',
                        }}>
                        {acc.alias || acc.bankName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
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
            <Text
              variant="bodySmall"
              style={{color: theme.colors.outline, marginLeft: 16}}>
              {'현금'} {formatAmount(cashBalance)}
            </Text>
          </View>
        </Surface>

        <View style={styles.metricsRow}>
          <Surface style={styles.metricSurface} elevation={1}>
            <Text variant="bodySmall" style={{color: theme.colors.outline}}>
              이번 달 카드 사용액
            </Text>
            <Text
              variant="titleMedium"
              style={{color: theme.colors.onSurface, fontWeight: '700'}}>
              {formatAmount(monthlyCardExpense)}
            </Text>
          </Surface>

          <Surface style={styles.metricSurface} elevation={1}>
            <Text variant="bodySmall" style={{color: theme.colors.outline}}>
              카드 결제 예정액
            </Text>
            <Text
              variant="titleMedium"
              style={{color: theme.colors.primary, fontWeight: '700'}}>
              {formatAmount(expectedCardPayment)}
            </Text>
          </Surface>
        </View>

        {/* 현금 섹션 */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
              {'현금'}
            </Text>
          </View>
          <View style={{paddingHorizontal: 16, paddingVertical: 8}}>
            {editingCash ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <TextInput
                  value={cashInput ? Number(cashInput).toLocaleString('ko-KR') : ''}
                  onChangeText={text => {
                    const numericOnly = text.replace(/[^0-9]/g, '');
                    setCashInput(numericOnly);
                  }}
                  keyboardType="numeric"
                  mode="outlined"
                  dense
                  style={{flex: 1, backgroundColor: 'transparent'}}
                  outlineColor={theme.colors.outline + '40'}
                  activeOutlineColor={theme.colors.primary}
                  right={<TextInput.Affix text="원" />}
                />
                <Button mode="contained" compact onPress={handleSaveCash} loading={saving} disabled={saving}>
                  {'저장'}
                </Button>
                <Button mode="text" compact onPress={() => setEditingCash(false)} disabled={saving}>
                  {'취소'}
                </Button>
              </View>
            ) : (
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <List.Icon icon="cash" />
                  <Text variant="bodyMedium" style={{color: theme.colors.onSurface, fontWeight: '600', marginLeft: 8}}>
                    {formatAmount(cashBalance)}
                  </Text>
                </View>
                <IconButton
                  icon="pencil-outline"
                  size={18}
                  onPress={() => {
                    setCashInput(String(cashBalance));
                    setEditingCash(true);
                  }}
                />
              </View>
            )}
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
                    (card.cardType === 'check' ? '체크카드' : '신용카드') +
                    (card.alias ? ` · ${card.cardCompany}` : '') +
                    (card.paymentDay ? ` · 결제일 ${card.paymentDay}일` : '') +
                    (card.cardType === 'check' && card.linkedAccount ? ` · ${card.linkedAccount.alias || card.linkedAccount.bankName}` : '')
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
  metricsRow: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  metricSurface: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
