import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
  Button,
  TextInput,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PieChart, BarChart} from 'react-native-gifted-charts';
import {
  api,
  Transaction,
  TransactionSummary,
  Budget,
  Account,
  Card,
} from '../../services/api';

// ─── 카테고리별 파이차트 색상 팔레트 ──────────────────────────────
const CATEGORY_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#FF6384', '#C9CBCF', '#7BC8A4', '#E7E9ED',
  '#4DC9F6', '#F67019', '#F53794', '#ACC236',
];

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── 유틸 함수 ──────────────────────────────────────────────────

/** 금액을 한국어 형식으로 포맷 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

/** Date -> "YYYY-MM" 형식 문자열 */
function getMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Date -> "2026년 2월" 형식 라벨 */
function getMonthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface WeekRange {
  start: string;
  end: string;
  label: string;
}

function buildWeekRangesInMonth(currentMonth: Date): WeekRange[] {
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const ranges: WeekRange[] = [];

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const clampedStart = weekStart < monthStart ? monthStart : weekStart;
    const clampedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

    const startLabel = `${clampedStart.getMonth() + 1}/${clampedStart.getDate()}`;
    const endLabel = `${clampedEnd.getMonth() + 1}/${clampedEnd.getDate()}`;

    ranges.push({
      start: toDateKey(clampedStart),
      end: toDateKey(clampedEnd),
      label: `${startLabel} - ${endLabel}`,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return ranges;
}

function findInitialWeekIndex(weekRanges: WeekRange[], currentMonth: Date): number {
  if (weekRanges.length === 0) {
    return 0;
  }

  const today = new Date();
  const isCurrentMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth() === today.getMonth();

  if (!isCurrentMonth) {
    return 0;
  }

  const todayKey = toDateKey(today);
  const found = weekRanges.findIndex(
    range => todayKey >= range.start && todayKey <= range.end,
  );
  return found >= 0 ? found : 0;
}

// ─── 카테고리별 지출 통계 타입 ────────────────────────────────────
interface CategoryExpenseStat {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  total: number;
  percentage: number;
  color: string;
}

interface PaymentUsageStat {
  key: string;
  label: string;
  total: number;
  count: number;
  percentage: number;
  color: string;
}

type CategoryDetailSort = 'date' | 'amount';

interface CategoryTransactionItem {
  id: number;
  title: string;
  memo: string | null;
  amount: number;
  date: string;
}

// ─── 예산 진행률 색상 결정 ─────────────────────────────────────────
function getBudgetColor(percentage: number): string {
  if (percentage > 90) return '#F44336';    // 빨강 (위험)
  if (percentage > 70) return '#FF9800';    // 주황 (경고)
  return '#4CAF50';                          // 초록 (안전)
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────

function StatsScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // ─── 상태 ───────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [period, setPeriod] = useState<'month' | 'week'>('month');
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 현재 월 데이터
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({});
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  // 전월 데이터 (비교용)
  const [prevSummary, setPrevSummary] = useState<TransactionSummary>({});

  // 월 선택기 모달 상태
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentMonth.getFullYear());

  // 예산 설정 모달 상태
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryDetailSort, setCategoryDetailSort] = useState<CategoryDetailSort>('date');

  // ─── 월 문자열 계산 ─────────────────────────────────────────
  const monthString = useMemo(() => getMonthString(currentMonth), [currentMonth]);

  /** 전월 Date 객체 */
  const prevMonthDate = useMemo(() => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [currentMonth]);

  const prevMonthString = useMemo(() => getMonthString(prevMonthDate), [prevMonthDate]);
  const weekRanges = useMemo(() => buildWeekRangesInMonth(currentMonth), [currentMonth]);

  const weekRange = useMemo(() => {
    if (weekRanges.length === 0) {
      return null;
    }
    const safeIndex = Math.max(0, Math.min(selectedWeekIndex, weekRanges.length - 1));
    return weekRanges[safeIndex];
  }, [weekRanges, selectedWeekIndex]);

  // 월 선택기 모달 열릴 때 pickerYear 동기화
  useEffect(() => {
    if (showMonthPicker) {
      setPickerYear(currentMonth.getFullYear());
    }
  }, [showMonthPicker, currentMonth]);

  useEffect(() => {
    setSelectedWeekIndex(findInitialWeekIndex(weekRanges, currentMonth));
  }, [weekRanges, currentMonth]);

  // ─── 데이터 fetch ───────────────────────────────────────────
  const fetchData = useCallback(async (month: string, prevMonth: string) => {
    try {
      setLoading(true);
      const [transRes, summaryRes, budgetRes, prevSummaryRes, accountRes, cardRes] = await Promise.all([
        api.getTransactions(month),
        api.getTransactionSummary(month),
        api.getBudgets(month),
        api.getTransactionSummary(prevMonth),
        api.getAccounts(),
        api.getCards(),
      ]);
      setTransactions(transRes.transactions);
      setSummary(summaryRes.summary);
      setBudgets(budgetRes.budgets);
      setPrevSummary(prevSummaryRes.summary);
      setAccounts(accountRes.accounts);
      setCards(cardRes.cards);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 화면 포커스 시 데이터 로드
  useFocusEffect(
    useCallback(() => {
      fetchData(monthString, prevMonthString);
    }, [fetchData, monthString, prevMonthString]),
  );

  // 새로고침
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(monthString, prevMonthString);
    setRefreshing(false);
  }, [fetchData, monthString, prevMonthString]);

  // ─── 월 이동 핸들러 ─────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  const goToPrevWeek = useCallback(() => {
    setSelectedWeekIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const goToNextWeek = useCallback(() => {
    setSelectedWeekIndex(prev => Math.min(prev + 1, Math.max(weekRanges.length - 1, 0)));
  }, [weekRanges.length]);

  // ─── 월간 합계 계산 ─────────────────────────────────────────
  const monthlyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const day of Object.values(summary)) {
      income += day.income;
      expense += day.expense;
    }
    return {income, expense, balance: income - expense};
  }, [summary]);

  const weeklyTransactions = useMemo(() => {
    if (!weekRange) {
      return [];
    }
    return transactions.filter(tx => {
      const dateKey = tx.date.split('T')[0];
      return dateKey >= weekRange.start && dateKey <= weekRange.end;
    });
  }, [transactions, weekRange]);

  const weeklySummary = useMemo(() => {
    if (!weekRange) {
      return {};
    }
    const scoped: TransactionSummary = {};
    for (const [key, value] of Object.entries(summary)) {
      if (key >= weekRange.start && key <= weekRange.end) {
        scoped[key] = value;
      }
    }
    return scoped;
  }, [summary, weekRange]);

  const weeklyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const day of Object.values(weeklySummary)) {
      income += day.income;
      expense += day.expense;
    }
    return {income, expense, balance: income - expense};
  }, [weeklySummary]);

  // 전월 합계
  const prevMonthlyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const day of Object.values(prevSummary)) {
      income += day.income;
      expense += day.expense;
    }
    return {income, expense, balance: income - expense};
  }, [prevSummary]);

  // 전월 대비 비교 문자열
  const comparisonText = useMemo(() => {
    const diff = monthlyTotals.balance - prevMonthlyTotals.balance;
    const prevBalance = prevMonthlyTotals.balance;

    // 전월 데이터가 없으면 비교 불가
    if (prevBalance === 0 && diff === 0) return null;

    const sign = diff >= 0 ? '+' : '';
    const amount = `${sign}${formatAmount(diff)}`;

    if (prevBalance !== 0) {
      const pct = Math.round((diff / Math.abs(prevBalance)) * 100);
      const pctSign = pct >= 0 ? '+' : '';
      return `전월 대비 ${amount} (${pctSign}${pct}%)`;
    }
    return `전월 대비 ${amount}`;
  }, [monthlyTotals, prevMonthlyTotals]);

  // ─── 카테고리별 지출 통계 계산 ─────────────────────────────────
  const categoryExpenseStats = useMemo((): CategoryExpenseStat[] => {
    // 지출 거래만 필터링 후 카테고리별 집계
    const catMap = new Map<number, {name: string; icon: string; total: number}>();
    const expenseTransactions = transactions.filter(tx => tx.type === 'expense');

    for (const tx of expenseTransactions) {
      const catId = tx.categoryId ?? 0;
      const catName = tx.category?.name ?? '미분류';
      const catIcon = tx.category?.icon ?? '💸';
      const amount = Number(tx.amount);

      const existing = catMap.get(catId);
      if (existing) {
        existing.total += amount;
      } else {
        catMap.set(catId, {name: catName, icon: catIcon, total: amount});
      }
    }

    // 총 지출 금액
    const totalExpense = monthlyTotals.expense;

    // 배열로 변환 후 금액 내림차순 정렬
    const stats: CategoryExpenseStat[] = Array.from(catMap.entries())
      .map(([catId, data], index) => ({
        categoryId: catId,
        categoryName: data.name,
        categoryIcon: data.icon,
        total: data.total,
        percentage: totalExpense > 0 ? Math.round((data.total / totalExpense) * 100) : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.total - a.total);

    return stats;
  }, [transactions, monthlyTotals.expense]);

  const weeklyCategoryExpenseStats = useMemo((): CategoryExpenseStat[] => {
    const catMap = new Map<number, {name: string; icon: string; total: number}>();
    const expenseTransactions = weeklyTransactions.filter(tx => tx.type === 'expense');

    for (const tx of expenseTransactions) {
      const catId = tx.categoryId ?? 0;
      const catName = tx.category?.name ?? '미분류';
      const catIcon = tx.category?.icon ?? '💸';
      const amount = Number(tx.amount);

      const existing = catMap.get(catId);
      if (existing) {
        existing.total += amount;
      } else {
        catMap.set(catId, {name: catName, icon: catIcon, total: amount});
      }
    }

    const totalExpense = weeklyTotals.expense;
    return Array.from(catMap.entries())
      .map(([catId, data], index) => ({
        categoryId: catId,
        categoryName: data.name,
        categoryIcon: data.icon,
        total: data.total,
        percentage: totalExpense > 0 ? Math.round((data.total / totalExpense) * 100) : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.total - a.total);
  }, [weeklyTransactions, weeklyTotals.expense]);

  const activeTotals = period === 'month' ? monthlyTotals : weeklyTotals;
  const activeCategoryExpenseStats =
    period === 'month' ? categoryExpenseStats : weeklyCategoryExpenseStats;
  const activeTransactions = period === 'month' ? transactions : weeklyTransactions;

  useEffect(() => {
    if (activeCategoryExpenseStats.length === 0) {
      setSelectedCategoryId(null);
      return;
    }

    const exists = activeCategoryExpenseStats.some(stat => stat.categoryId === selectedCategoryId);
    if (!exists) {
      setSelectedCategoryId(activeCategoryExpenseStats[0].categoryId);
    }
  }, [activeCategoryExpenseStats, selectedCategoryId]);

  const selectedCategoryTransactions = useMemo((): CategoryTransactionItem[] => {
    if (selectedCategoryId === null) {
      return [];
    }

    const items = activeTransactions
      .filter(tx => tx.type === 'expense' && ((tx.categoryId ?? 0) === selectedCategoryId))
      .map(tx => ({
        id: tx.id,
        title: tx.title || tx.category?.name || '제목 없음',
        memo: tx.memo,
        amount: Number(tx.amount),
        date: tx.date,
      }));

    return [...items].sort((a, b) => {
      if (categoryDetailSort === 'amount') {
        return b.amount - a.amount;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [activeTransactions, selectedCategoryId, categoryDetailSort]);

  // ─── 파이차트 데이터 ───────────────────────────────────────────
  const pieData = useMemo(() => {
    if (activeCategoryExpenseStats.length === 0) return [];
    return activeCategoryExpenseStats.map(stat => ({
      value: stat.total,
      color: stat.color,
      text: `${stat.percentage}%`,
    }));
  }, [activeCategoryExpenseStats]);

  // ─── 바차트 데이터 ────────────────────────────────────────────
  const barData = useMemo(() => {
    if (activeCategoryExpenseStats.length === 0) return [];
    return activeCategoryExpenseStats.map(stat => ({
      value: stat.total,
      label: stat.categoryName,
      frontColor: stat.color,
      barBorderRadius: 4,
      topLabelComponent: () => (
        <Text style={chartStyles.barTopLabel}>
          {stat.total >= 10000
            ? Math.floor(stat.total / 10000).toLocaleString() + '만'
            : stat.total.toLocaleString()}
        </Text>
      ),
    }));
  }, [activeCategoryExpenseStats]);

  const paymentMethodStats = useMemo((): PaymentUsageStat[] => {
    const expenseTransactions = activeTransactions.filter(tx => tx.type === 'expense');
    const totalExpense = expenseTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    const usageMap = new Map<string, {label: string; total: number; count: number; color: string}>([
      ['cash', {label: '현금', total: 0, count: 0, color: '#4CAF50'}],
      ['account', {label: '계좌', total: 0, count: 0, color: '#2196F3'}],
      ['card', {label: '카드', total: 0, count: 0, color: '#FF9800'}],
    ]);

    for (const tx of expenseTransactions) {
      const amount = Number(tx.amount);
      const stat = usageMap.get(tx.paymentMethod);
      if (stat) {
        stat.total += amount;
        stat.count += 1;
      }
    }

    return Array.from(usageMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        total: value.total,
        count: value.count,
        percentage: totalExpense > 0 ? Math.round((value.total / totalExpense) * 100) : 0,
        color: value.color,
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [activeTransactions]);

  const paymentSourceStats = useMemo((): PaymentUsageStat[] => {
    const accountNameMap = new Map(accounts.map(acc => [acc.id, acc.alias || acc.bankName]));
    const cardNameMap = new Map(cards.map(card => [card.id, card.alias || card.cardCompany]));

    const expenseTransactions = activeTransactions.filter(tx => tx.type === 'expense');
    const totalExpense = expenseTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const usageMap = new Map<string, Omit<PaymentUsageStat, 'percentage'>>();

    for (const tx of expenseTransactions) {
      const amount = Number(tx.amount);
      let key = 'cash';
      let label = '현금';
      let color = '#4CAF50';

      if (tx.paymentMethod === 'account') {
        key = `account:${tx.accountId ?? 'unknown'}`;
        label = tx.accountId ? accountNameMap.get(tx.accountId) || '계좌(삭제됨)' : '계좌(미지정)';
        color = '#2196F3';
      } else if (tx.paymentMethod === 'card') {
        key = `card:${tx.cardId ?? 'unknown'}`;
        label = tx.cardId ? cardNameMap.get(tx.cardId) || '카드(삭제됨)' : '카드(미지정)';
        color = '#FF9800';
      }

      const existing = usageMap.get(key);
      if (existing) {
        existing.total += amount;
        existing.count += 1;
      } else {
        usageMap.set(key, {key, label, total: amount, count: 1, color});
      }
    }

    return Array.from(usageMap.values())
      .map(item => ({
        ...item,
        percentage: totalExpense > 0 ? Math.round((item.total / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [activeTransactions, accounts, cards]);

  // ─── 전체 예산 (categoryId가 null인 예산) ─────────────────────
  const overallBudget = useMemo(() => {
    return budgets.find(b => b.categoryId === null) ?? null;
  }, [budgets]);

  // 예산 사용률 계산
  const budgetUsage = useMemo(() => {
    if (!overallBudget) return null;
    const budgetAmt = Number(overallBudget.amount);
    const used = monthlyTotals.expense;
    const percentage = budgetAmt > 0 ? Math.round((used / budgetAmt) * 100) : 0;
    return {total: budgetAmt, used, percentage};
  }, [overallBudget, monthlyTotals.expense]);

  // ─── 예산 모달 핸들러 ───────────────────────────────────────
  const openBudgetModal = useCallback(() => {
    if (overallBudget) {
      // 기존 예산 수정
      setEditingBudgetId(overallBudget.id);
      setBudgetAmount(String(Number(overallBudget.amount)));
    } else {
      // 새 예산 추가
      setEditingBudgetId(null);
      setBudgetAmount('');
    }
    setBudgetModalVisible(true);
  }, [overallBudget]);

  const closeBudgetModal = useCallback(() => {
    setBudgetModalVisible(false);
    setBudgetAmount('');
    setEditingBudgetId(null);
  }, []);

  const handleSaveBudget = useCallback(async () => {
    const amount = Number(budgetAmount);
    if (!budgetAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('알림', '올바른 예산 금액을 입력해주세요.');
      return;
    }

    setBudgetSaving(true);
    try {
      if (editingBudgetId) {
        await api.updateBudget(editingBudgetId, {amount});
      } else {
        await api.createBudget({amount, month: monthString});
      }
      closeBudgetModal();
      await fetchData(monthString, prevMonthString);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '예산 저장에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setBudgetSaving(false);
    }
  }, [budgetAmount, editingBudgetId, monthString, closeBudgetModal, fetchData, prevMonthString]);

  const handleDeleteBudget = useCallback(async () => {
    if (!overallBudget) return;
    Alert.alert('삭제 확인', '예산을 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteBudget(overallBudget.id);
            await fetchData(monthString, prevMonthString);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '삭제에 실패했습니다.';
            Alert.alert('오류', msg);
          }
        },
      },
    ]);
  }, [overallBudget, fetchData, monthString, prevMonthString]);

  // ─── 차트 너비 계산 ────────────────────────────────────────
  const chartWidth = SCREEN_WIDTH - 64; // 양쪽 마진 + 패딩

  // ─── 로딩 상태 ─────────────────────────────────────────────
  if (loading && transactions.length === 0) {
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

        {/* ─── 1. 월 선택기 ────────────────────────────────────── */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={goToPrevMonth} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={[styles.monthArrow, {color: theme.colors.onSurface}]}>{'<'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMonthPicker(true)}>
            <Text
              variant="titleMedium"
              style={[styles.monthTitle, {color: theme.colors.onSurface, fontFamily: 'NanumGothic-Bold'}]}>
              {getMonthLabel(currentMonth)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextMonth} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={[styles.monthArrow, {color: theme.colors.onSurface}]}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.periodSelector}>
          <SegmentedButtons
            value={period}
            onValueChange={value => setPeriod(value as 'month' | 'week')}
            buttons={[
              {value: 'month', label: '월간'},
              {value: 'week', label: '주간'},
            ]}
          />
          {period === 'week' && weekRange && (
            <View style={styles.weekSelectorRow}>
              <TouchableOpacity
                onPress={goToPrevWeek}
                disabled={selectedWeekIndex === 0}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text
                  style={[
                    styles.weekArrow,
                    {
                      color:
                        selectedWeekIndex === 0
                          ? theme.colors.outline
                          : theme.colors.onSurface,
                    },
                  ]}>
                  {'<'}
                </Text>
              </TouchableOpacity>

              <Text variant="bodySmall" style={[styles.periodLabel, {color: theme.colors.outline}]}> 
                {weekRange.label}
              </Text>

              <TouchableOpacity
                onPress={goToNextWeek}
                disabled={selectedWeekIndex >= weekRanges.length - 1}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text
                  style={[
                    styles.weekArrow,
                    {
                      color:
                        selectedWeekIndex >= weekRanges.length - 1
                          ? theme.colors.outline
                          : theme.colors.onSurface,
                    },
                  ]}>
                  {'>'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── 2. 월간 요약 카드 ───────────────────────────────── */}
        <Surface style={styles.cardSurface} elevation={1}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
            월간 요약
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                수입
              </Text>
              <Text variant="titleMedium" style={{color: theme.colors.primary, fontWeight: '700', fontFamily: 'NanumGothic-Bold'}}>
                {formatAmount(activeTotals.income)}
              </Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: theme.colors.outline}]} />
            <View style={styles.summaryItem}>
              <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                지출
              </Text>
              <Text variant="titleMedium" style={{color: theme.colors.error, fontWeight: '700', fontFamily: 'NanumGothic-Bold'}}>
                {formatAmount(activeTotals.expense)}
              </Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: theme.colors.outline}]} />
            <View style={styles.summaryItem}>
              <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                순수익
              </Text>
              <Text
                variant="titleMedium"
                style={{
                  color: activeTotals.balance >= 0 ? theme.colors.primary : theme.colors.error,
                  fontWeight: '700',
                  fontFamily: 'NanumGothic-Bold',
                }}>
                {formatAmount(activeTotals.balance)}
              </Text>
            </View>
          </View>

          {/* 전월 대비 비교 */}
          {period === 'month' && comparisonText && (
            <View style={styles.comparisonContainer}>
              <Text
                variant="bodySmall"
                style={{
                  color: monthlyTotals.balance >= prevMonthlyTotals.balance
                    ? theme.colors.primary
                    : theme.colors.error,
                  fontFamily: 'NanumGothic-Regular',
                }}>
                {comparisonText}
              </Text>
            </View>
          )}
        </Surface>

        {/* ─── 3. 카테고리별 지출 파이차트 ──────────────────────── */}
        <Surface style={styles.cardSurface} elevation={1}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
            카테고리별 지출
          </Text>

          {activeCategoryExpenseStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                지출 내역이 없습니다.
              </Text>
            </View>
          ) : (
            <>
              {/* 파이차트 */}
              <View style={styles.chartCenter}>
                <PieChart
                  data={pieData}
                  radius={90}
                  donut
                  innerRadius={55}
                  innerCircleColor={theme.colors.surface}
                  centerLabelComponent={() => (
                    <View style={styles.pieCenter}>
                      <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                        총 지출
                      </Text>
                      <Text variant="titleSmall" style={{color: theme.colors.error, fontWeight: '700', fontFamily: 'NanumGothic-Bold'}}>
                        {activeTotals.expense >= 10000
                          ? Math.floor(activeTotals.expense / 10000).toLocaleString() + '만원'
                          : formatAmount(activeTotals.expense)}
                      </Text>
                    </View>
                  )}
                />
              </View>

              {/* 범례 */}
              <View style={styles.legendContainer}>
                {activeCategoryExpenseStats.map(stat => (
                  <View key={stat.categoryId} style={styles.legendItem}>
                    <View style={styles.legendLeft}>
                      <View style={[styles.legendDot, {backgroundColor: stat.color}]} />
                      <Text style={styles.legendIcon}>{stat.categoryIcon}</Text>
                      <Text
                        variant="bodyMedium"
                        style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Regular'}}
                        numberOfLines={1}>
                        {stat.categoryName}
                      </Text>
                    </View>
                    <View style={styles.legendRight}>
                      <Text
                        variant="bodyMedium"
                        style={{color: theme.colors.onSurface, fontWeight: '600', fontFamily: 'NanumGothic-Bold'}}>
                        {formatAmount(stat.total)}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{color: theme.colors.outline, marginLeft: 6, fontFamily: 'NanumGothic-Regular'}}>
                        {stat.percentage}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* 카테고리별 상세 내역 */}
              <View style={[styles.categoryDetailSection, {borderTopColor: theme.colors.outline + '20'}]}>
                <Text
                  variant="bodyMedium"
                  style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Bold', marginBottom: 8}}>
                  카테고리 상세 내역
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryChipRow}>
                  {activeCategoryExpenseStats.map(stat => {
                    const selected = selectedCategoryId === stat.categoryId;
                    return (
                      <TouchableOpacity
                        key={`cat-chip-${stat.categoryId}`}
                        style={[
                          styles.categoryChip,
                          {
                            borderColor: selected ? stat.color : theme.colors.outline + '30',
                            backgroundColor: selected ? stat.color + '20' : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedCategoryId(stat.categoryId)}>
                        <Text style={styles.legendIcon}>{stat.categoryIcon}</Text>
                        <Text
                          variant="bodySmall"
                          style={{
                            color: selected ? theme.colors.onSurface : theme.colors.outline,
                            fontFamily: selected ? 'NanumGothic-Bold' : 'NanumGothic-Regular',
                          }}>
                          {stat.categoryName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <SegmentedButtons
                  value={categoryDetailSort}
                  onValueChange={value => setCategoryDetailSort(value as CategoryDetailSort)}
                  buttons={[
                    {value: 'date', label: '날짜순'},
                    {value: 'amount', label: '금액순'},
                  ]}
                  style={styles.categorySortSegment}
                />

                {selectedCategoryTransactions.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                      해당 카테고리 지출 내역이 없습니다.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.categoryTransactionList}>
                    {selectedCategoryTransactions.slice(0, 10).map(item => (
                      <View key={`cat-tx-${item.id}`} style={styles.categoryTransactionItem}>
                        <View style={styles.categoryTransactionLeft}>
                          <Text
                            variant="bodyMedium"
                            style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Bold'}}
                            numberOfLines={1}>
                            {item.title}
                          </Text>
                          {item.memo ? (
                            <Text
                              variant="bodySmall"
                              style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}
                              numberOfLines={1}>
                              메모: {item.memo}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.categoryTransactionRight}>
                          <Text
                            variant="bodyMedium"
                            style={{color: theme.colors.error, fontFamily: 'NanumGothic-Bold'}}>
                            -{formatAmount(item.amount)}
                          </Text>
                          <Text
                            variant="bodySmall"
                            style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                            {new Date(item.date).toLocaleDateString('ko-KR')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {selectedCategoryTransactions.length > 10 && (
                  <Text
                    variant="bodySmall"
                    style={{color: theme.colors.outline, marginTop: 6, fontFamily: 'NanumGothic-Regular'}}>
                    최근 상위 10건만 표시됩니다.
                  </Text>
                )}
              </View>
            </>
          )}
        </Surface>

        {/* ─── 4. 카테고리별 지출 바차트 ────────────────────────── */}
        {activeCategoryExpenseStats.length > 0 && (
          <Surface style={styles.cardSurface} elevation={1}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
              카테고리별 비교
            </Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={barData}
                width={chartWidth}
                height={180}
                barWidth={28}
                spacing={16}
                noOfSections={4}
                barBorderRadius={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={theme.colors.outline + '40'}
                yAxisTextStyle={{
                  color: theme.colors.outline,
                  fontSize: 10,
                  fontFamily: 'NanumGothic-Regular',
                }}
                xAxisLabelTextStyle={{
                  color: theme.colors.outline,
                  fontSize: 9,
                  fontFamily: 'NanumGothic-Regular',
                }}
                hideRules
                isAnimated
              />
            </View>
          </Surface>
        )}

        {/* ─── 5. 결제수단/사용처 통계 ──────────────────────────── */}
        <Surface style={styles.cardSurface} elevation={1}>
          <Text
            variant="titleSmall"
            style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
            결제수단별 사용 통계
          </Text>

          {paymentMethodStats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                지출 내역이 없습니다.
              </Text>
            </View>
          ) : (
            <View style={styles.paymentStatsContainer}>
              {paymentMethodStats.map(item => (
                <View key={item.key} style={styles.paymentStatItem}>
                  <View style={styles.paymentStatHeader}>
                    <Text variant="bodyMedium" style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Bold'}}>
                      {item.label}
                    </Text>
                    <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                      {formatAmount(item.total)} · {item.count}건 ({item.percentage}%)
                    </Text>
                  </View>
                  <View style={[styles.paymentBarTrack, {backgroundColor: theme.colors.outline + '20'}]}>
                    <View
                      style={[
                        styles.paymentBarFill,
                        {width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color},
                      ]}
                    />
                  </View>
                </View>
              ))}

              <View style={[styles.paymentSourceSection, {borderTopColor: theme.colors.outline + '20'}]}>
                <Text variant="bodyMedium" style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Bold', marginBottom: 8}}>
                  사용처 상세
                </Text>
                {paymentSourceStats.map(item => (
                  <View key={item.key} style={styles.paymentSourceRow}>
                    <View style={styles.legendLeft}>
                      <View style={[styles.legendDot, {backgroundColor: item.color}]} />
                      <Text variant="bodyMedium" style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Regular'}}>
                        {item.label}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={{color: theme.colors.outline, fontFamily: 'NanumGothic-Regular'}}>
                      {formatAmount(item.total)} · {item.count}건 ({item.percentage}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Surface>

        {/* ─── 6. 예산 섹션 ──────────────────────────────────── */}
        <Surface style={styles.cardSurface} elevation={1}>
          <View style={styles.budgetHeader}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface, marginBottom: 0}]}>
              월간 예산
            </Text>
            {overallBudget && (
              <View style={styles.budgetActions}>
                <TouchableOpacity onPress={openBudgetModal} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text variant="bodySmall" style={{color: theme.colors.primary, fontFamily: 'NanumGothic-Regular'}}>
                    수정
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteBudget}
                  style={{marginLeft: 12}}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text variant="bodySmall" style={{color: theme.colors.error, fontFamily: 'NanumGothic-Regular'}}>
                    삭제
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {budgetUsage ? (
            <View style={styles.budgetContent}>
              {/* 예산 금액 표시 */}
              <View style={styles.budgetAmountRow}>
                <Text variant="bodyMedium" style={{color: theme.colors.onSurface, fontFamily: 'NanumGothic-Regular'}}>
                  {formatAmount(budgetUsage.used)} / {formatAmount(budgetUsage.total)}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: getBudgetColor(budgetUsage.percentage),
                    fontWeight: '700',
                    fontFamily: 'NanumGothic-Bold',
                  }}>
                  {budgetUsage.percentage}% 사용
                </Text>
              </View>

              {/* 프로그레스바 */}
              <View style={[styles.progressBarBg, {backgroundColor: theme.colors.outline + '20'}]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(budgetUsage.percentage, 100)}%`,
                      backgroundColor: getBudgetColor(budgetUsage.percentage),
                    },
                  ]}
                />
              </View>

              {/* 예산 초과 경고 */}
              {budgetUsage.percentage > 100 && (
                <View style={[styles.budgetWarning, {backgroundColor: '#FFF3E0'}]}>
                  <Text variant="bodySmall" style={{color: '#E65100', fontFamily: 'NanumGothic-Bold'}}>
                    {'예산을 초과했습니다! ('}{formatAmount(budgetUsage.used - budgetUsage.total)}{' 초과)'}
                  </Text>
                </View>
              )}

              {/* 남은 예산 */}
              {budgetUsage.percentage <= 100 && (
                <Text
                  variant="bodySmall"
                  style={{color: theme.colors.outline, marginTop: 8, fontFamily: 'NanumGothic-Regular'}}>
                  남은 예산: {formatAmount(budgetUsage.total - budgetUsage.used)}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.noBudgetContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline, marginBottom: 12, fontFamily: 'NanumGothic-Regular'}}>
                설정된 예산이 없습니다.
              </Text>
              <Button
                mode="outlined"
                onPress={openBudgetModal}
                style={styles.setBudgetButton}
                labelStyle={{fontFamily: 'NanumGothic-Bold'}}>
                예산 설정
              </Button>
            </View>
          )}
        </Surface>

      </ScrollView>

      {/* 월 선택기 모달 */}
      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={monthPickerStyles.overlay} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={[monthPickerStyles.container, {backgroundColor: theme.colors.surface}]} onPress={() => {}}>
            {/* 연도 선택 */}
            <View style={monthPickerStyles.yearRow}>
              <TouchableOpacity onPress={() => setPickerYear(prev => prev - 1)}>
                <Text style={[monthPickerStyles.yearArrow, {color: theme.colors.onSurface}]}>{'<'}</Text>
              </TouchableOpacity>
              <Text variant="titleLarge" style={{color: theme.colors.onSurface, fontWeight: '700'}}>{pickerYear}년</Text>
              <TouchableOpacity onPress={() => setPickerYear(prev => prev + 1)}>
                <Text style={[monthPickerStyles.yearArrow, {color: theme.colors.onSurface}]}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            {/* 월 그리드 */}
            <View style={monthPickerStyles.monthGrid}>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => {
                const isSelected = pickerYear === currentMonth.getFullYear() && m === currentMonth.getMonth() + 1;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      monthPickerStyles.monthCell,
                      isSelected && {backgroundColor: theme.colors.primaryContainer},
                    ]}
                    onPress={() => {
                      setCurrentMonth(new Date(pickerYear, m - 1, 1));
                      setShowMonthPicker(false);
                    }}>
                    <Text style={{color: isSelected ? theme.colors.primary : theme.colors.onSurface, fontWeight: isSelected ? '700' : '400'}}>
                      {m}월
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── 예산 설정 모달 ───────────────────────────────────── */}
      <Modal
        visible={budgetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBudgetModal}>
        <Pressable style={styles.modalOverlay} onPress={closeBudgetModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}>
            <Pressable
              style={[styles.dialogContainer, {backgroundColor: theme.colors.surface}]}
              onPress={() => {}}>
              <Text
                variant="titleLarge"
                style={[styles.dialogTitle, {color: theme.colors.onSurface}]}>
                {editingBudgetId ? '예산 수정' : '예산 설정'}
              </Text>
              <Text
                variant="bodySmall"
                style={{color: theme.colors.outline, marginBottom: 16, fontFamily: 'NanumGothic-Regular'}}>
                {getMonthLabel(currentMonth)} 전체 예산을 입력해주세요.
              </Text>
              <TextInput
                label="예산 금액"
                value={budgetAmount}
                onChangeText={text => {
                  const numericOnly = text.replace(/[^0-9]/g, '');
                  setBudgetAmount(numericOnly);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.dialogInput}
                outlineColor={theme.colors.outline + '40'}
                activeOutlineColor={theme.colors.primary}
                right={<TextInput.Affix text="원" />}
              />
              <View style={styles.dialogActions}>
                <Button mode="text" onPress={closeBudgetModal} disabled={budgetSaving}>
                  취소
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveBudget}
                  loading={budgetSaving}
                  disabled={budgetSaving}
                  style={styles.dialogSaveButton}>
                  저장
                </Button>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── 차트 내부 스타일 (인라인 방지용) ─────────────────────────────
const chartStyles = StyleSheet.create({
  barTopLabel: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'NanumGothic-Regular',
  },
});

// ─── 스타일시트 ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // 월 선택기
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  monthArrow: {
    fontSize: 22,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  monthTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  periodSelector: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  periodLabel: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'NanumGothic-Regular',
  },
  weekSelectorRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  weekArrow: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  // 공통 카드 Surface
  cardSurface: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: 'NanumGothic-Bold',
  },

  // 월간 요약
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
  comparisonContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },

  // 차트 공통
  chartCenter: {
    alignItems: 'center',
    marginVertical: 12,
  },
  chartContainer: {
    marginTop: 8,
    overflow: 'hidden',
  },

  // 파이차트 중앙 레이블
  pieCenter: {
    alignItems: 'center',
  },

  // 범례
  legendContainer: {
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  categoryDetailSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryChipRow: {
    paddingBottom: 4,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categorySortSegment: {
    marginTop: 10,
  },
  categoryTransactionList: {
    marginTop: 10,
  },
  categoryTransactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  categoryTransactionLeft: {
    flex: 1,
    paddingRight: 10,
  },
  categoryTransactionRight: {
    alignItems: 'flex-end',
  },

  // 빈 상태
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  // 결제수단 통계
  paymentStatsContainer: {
    marginTop: 4,
  },
  paymentStatItem: {
    marginBottom: 12,
  },
  paymentStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  paymentBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  paymentSourceSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  paymentSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  // 예산 섹션
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  budgetActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetContent: {
    marginTop: 4,
  },
  budgetAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  budgetWarning: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  noBudgetContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  setBudgetButton: {
    borderRadius: 8,
  },

  // 모달
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
    marginBottom: 8,
    fontFamily: 'NanumGothic-Bold',
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

const monthPickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 24,
  },
  yearArrow: {
    fontSize: 22,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '25%',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
  },
});

export default StatsScreen;
