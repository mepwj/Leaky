import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {Text, Surface, useTheme, Divider, ActivityIndicator, IconButton} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {
  api,
  Transaction,
} from '../../services/api';

export type DailyDetailParams = {
  DailyDetail: {
    date: string; // YYYY-MM-DD 형식
  };
};

type DailyDetailScreenNavigationProp = NativeStackNavigationProp<
  DailyDetailParams,
  'DailyDetail'
>;

type DailyDetailScreenRouteProp = RouteProp<DailyDetailParams, 'DailyDetail'>;

interface Props {
  navigation: DailyDetailScreenNavigationProp;
  route: DailyDetailScreenRouteProp;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function DailyDetailScreen({navigation, route}: Props): React.JSX.Element {
  const theme = useTheme();
  const {date} = route.params;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const month = date.substring(0, 7); // YYYY-MM 형식

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getTransactions(month);
      const filtered = res.transactions.filter(
        tx => tx.date.split('T')[0] === date,
      );
      setTransactions(filtered);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setLoading(false);
    }
  }, [month, date]);

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

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('삭제 확인', '이 거래내역을 삭제하시겠습니까?', [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(id);
              await api.deleteTransaction(id);
              await fetchData();
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : '삭제에 실패했습니다.';
              Alert.alert('오류', message);
            } finally {
              setDeleting(null);
            }
          },
        },
      ]);
    },
    [fetchData],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        income += amount;
      } else {
        expense += amount;
      }
    }
    return {income, expense};
  }, [transactions]);

  const dateLabel = date.replace(/-/g, '.');

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={{color: theme.colors.onBackground, fontWeight: '600'}}>
          {dateLabel}
        </Text>
        <View style={{width: 48}} />
      </View>

      {/* 요약 */}
      <Surface style={styles.summarySurface} elevation={1}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text variant="bodySmall" style={{color: theme.colors.outline}}>
              {'수입'}
            </Text>
            <Text variant="titleMedium" style={{color: theme.colors.primary, fontWeight: '700'}}>
              {formatAmount(totals.income)}
            </Text>
          </View>
          <View style={[styles.summaryDivider, {backgroundColor: theme.colors.outline}]} />
          <View style={styles.summaryItem}>
            <Text variant="bodySmall" style={{color: theme.colors.outline}}>
              {'지출'}
            </Text>
            <Text variant="titleMedium" style={{color: theme.colors.error, fontWeight: '700'}}>
              {formatAmount(totals.expense)}
            </Text>
          </View>
        </View>
      </Surface>

      {/* 거래내역 목록 */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {loading && transactions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={{color: theme.colors.outline}}>
              {'거래 내역이 없습니다.'}
            </Text>
          </View>
        ) : (
          <Surface style={styles.listSurface} elevation={1}>
            {transactions.map((tx, index) => (
              <React.Fragment key={tx.id}>
                {index > 0 && <Divider />}
                <TouchableOpacity
                  style={styles.transactionItem}
                  onLongPress={() => handleDelete(tx.id)}
                  activeOpacity={0.7}>
                  <View style={styles.transactionLeft}>
                    <View
                      style={[
                        styles.categoryIcon,
                        {backgroundColor: theme.colors.primaryContainer},
                      ]}>
                      <Text style={styles.categoryIconText}>
                        {tx.category?.icon || (tx.type === 'income' ? '💵' : '💸')}
                      </Text>
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text
                        variant="bodyMedium"
                        style={{color: theme.colors.onSurface, fontWeight: '500'}}>
                        {tx.category?.name || '미분류'}
                      </Text>
                      {tx.memo ? (
                        <Text
                          variant="bodySmall"
                          style={{color: theme.colors.outline}}
                          numberOfLines={1}>
                          {tx.memo}
                        </Text>
                      ) : null}
                      <Text variant="labelSmall" style={{color: theme.colors.outline, marginTop: 2}}>
                        {tx.paymentMethod === 'cash'
                          ? '현금'
                          : tx.paymentMethod === 'account'
                          ? '계좌'
                          : '카드'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    {deleting === tx.id ? (
                      <ActivityIndicator size={16} />
                    ) : (
                      <Text
                        variant="bodyLarge"
                        style={{
                          color:
                            tx.type === 'income'
                              ? theme.colors.primary
                              : theme.colors.error,
                          fontWeight: '600',
                        }}>
                        {tx.type === 'income' ? '+' : '-'}
                        {formatAmount(Number(tx.amount))}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </Surface>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  summarySurface: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    opacity: 0.3,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  listSurface: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 20,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionRight: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
});

export default DailyDetailScreen;
