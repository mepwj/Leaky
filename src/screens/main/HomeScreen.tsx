import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {Text, Surface, useTheme, Divider, ActivityIndicator} from 'react-native-paper';
import {Calendar, DateData, LocaleConfig} from 'react-native-calendars';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  api,
  Transaction,
  TransactionSummary,
} from '../../services/api';

// react-native-calendars 한국어 로케일 설정
LocaleConfig.locales['ko'] = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

// 요일별 색상 상수
const DAY_COLORS = {
  sunday: '#F44336',   // 일요일 - 빨간색
  saturday: '#2196F3', // 토요일 - 파란색
};


function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function getMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayString(): string {
  return getDateString(new Date());
}

// 날짜 문자열(YYYY-MM-DD)로부터 요일(0=일~6=토)을 구하는 함수
function getDayOfWeek(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

// 요일에 따른 날짜 텍스트 색상 반환 (공휴일이면 일요일과 같은 빨간색 적용)
function getDayTextColor(
  dateString: string,
  defaultColor: string,
  holidays: Record<string, string>,
): string {
  // 공휴일이면 빨간색
  if (holidays[dateString]) {
    return DAY_COLORS.sunday;
  }
  const dow = getDayOfWeek(dateString);
  if (dow === 0) return DAY_COLORS.sunday;  // 일요일
  if (dow === 6) return DAY_COLORS.saturday; // 토요일
  return defaultColor; // 평일
}

// 캘린더 커스텀 날짜 컴포넌트
interface DayComponentProps {
  date?: DateData;
  state?: string;
  marking?: {
    income?: number;
    expense?: number;
  };
  selectedDate: string;
  onPress: (dateString: string) => void;
  themeColors: {
    primary: string;
    error: string;
    surface: string;
    onSurface: string;
    outline: string;
    primaryContainer: string;
  };
  holidays: Record<string, string>;
}

function DayComponent({
  date,
  state,
  marking,
  selectedDate,
  onPress,
  themeColors,
  holidays,
}: DayComponentProps): React.JSX.Element | null {
  if (!date) {
    return null;
  }

  const isToday = date.dateString === getTodayString();
  const isSelected = date.dateString === selectedDate;
  const isDisabled = state === 'disabled';

  const income = marking?.income || 0;
  const expense = marking?.expense || 0;

  // 공휴일 여부 및 이름 확인
  const holidayName = holidays[date.dateString];
  const isHoliday = !!holidayName;

  // 날짜 텍스트 색상 결정 (비활성화된 날은 outline 색상 유지)
  const dayTextColor = isDisabled
    ? themeColors.outline
    : getDayTextColor(date.dateString, themeColors.onSurface, holidays);

  return (
    <TouchableOpacity
      onPress={() => !isDisabled && onPress(date.dateString)}
      activeOpacity={0.6}
      style={[
        dayStyles.container,
        isSelected && {backgroundColor: themeColors.primaryContainer},
        isToday && !isSelected && {borderColor: themeColors.primary, borderWidth: 1},
      ]}>
      <Text
        style={[
          dayStyles.dayText,
          {color: dayTextColor},
          isDisabled && {opacity: 0.4},
          isSelected && {fontWeight: '700'},
          isToday && !isSelected && {fontWeight: '600'},
        ]}>
        {date.day}
      </Text>
      {/* 공휴일 빨간 점 표시 */}
      {isHoliday && !isDisabled && (
        <View style={dayStyles.holidayDot} />
      )}
      {income > 0 && (
        <Text
          style={[dayStyles.amountText, {color: themeColors.primary}]}
          numberOfLines={1}>
          +{income >= 10000 ? Math.floor(income / 10000) + '만' : income.toLocaleString()}
        </Text>
      )}
      {expense > 0 && (
        <Text
          style={[dayStyles.amountText, {color: themeColors.error}]}
          numberOfLines={1}>
          -{expense >= 10000 ? Math.floor(expense / 10000) + '만' : expense.toLocaleString()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const dayStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 48,
    height: 56,
    borderRadius: 8,
    paddingTop: 4,
  },
  dayText: {
    fontSize: 14,
    marginBottom: 1,
    fontFamily: 'NanumGothic-Regular',
  },
  amountText: {
    fontSize: 8,
    fontFamily: 'NanumGothic-Regular',
  },
  // 공휴일 표시용 빨간 점
  holidayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: DAY_COLORS.sunday,
    marginBottom: 1,
  },
});

// 요일 헤더 행 컴포넌트 - 기본 헤더(월 이름)를 대체하고 요일별 색상 적용
interface WeekdayHeaderProps {
  defaultColor: string;
}

function WeekdayHeader({defaultColor}: WeekdayHeaderProps): React.JSX.Element {
  // 일, 월, 화, 수, 목, 금, 토 순서
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={weekdayHeaderStyles.container}>
      {days.map((day, index) => {
        // 요일별 색상: 0=일(빨강), 6=토(파랑), 나머지 평일
        let color = defaultColor;
        if (index === 0) color = DAY_COLORS.sunday;
        else if (index === 6) color = DAY_COLORS.saturday;

        return (
          <View key={day} style={weekdayHeaderStyles.cell}>
            <Text style={[weekdayHeaderStyles.text, {color}]}>{day}</Text>
          </View>
        );
      })}
    </View>
  );
}

const weekdayHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  cell: {
    width: 48,
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'NanumGothic-Regular',
  },
});

function HomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const initialMonth = useRef(getMonthString(new Date()) + '-01').current;
  const [summary, setSummary] = useState<TransactionSummary>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // 공휴일 캐시: 연도별로 저장 { "2026": { "2026-01-01": "신정", ... } }
  const holidayCache = useRef<Record<string, Record<string, string>>>({});
  // 현재 표시 중인 연도의 공휴일 목록
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  const monthString = useMemo(() => getMonthString(currentMonth), [currentMonth]);

  // 공휴일 데이터 fetch 함수 - 같은 연도는 캐시에서 반환
  const fetchHolidays = useCallback(async (year: number) => {
    const yearKey = String(year);

    // 캐시에 이미 있으면 재사용
    if (holidayCache.current[yearKey]) {
      setHolidays(holidayCache.current[yearKey]);
      return;
    }

    try {
      const result = await api.getHolidays(year);

      // { "YYYY-MM-DD": "공휴일 이름" } 형태로 변환
      const map: Record<string, string> = {};
      for (const item of result.holidays) {
        map[item.date] = item.name;
      }

      holidayCache.current[yearKey] = map;
      setHolidays(map);
    } catch {
      // 공휴일 fetch 실패 시 무시 (필수 기능이 아님)
    }
  }, []);

  // 월 변경 시 해당 연도의 공휴일 로드
  useEffect(() => {
    fetchHolidays(currentMonth.getFullYear());
  }, [currentMonth, fetchHolidays]);

  const fetchData = useCallback(async (month: string) => {
    try {
      setLoading(true);
      const [summaryRes, transactionsRes] = await Promise.all([
        api.getTransactionSummary(month),
        api.getTransactions(month),
      ]);
      setSummary(summaryRes.summary);
      setTransactions(transactionsRes.transactions);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData(monthString);
    }, [fetchData, monthString]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(monthString);
    setRefreshing(false);
  }, [fetchData, monthString]);

  const handleDayPress = useCallback((dateString: string) => {
    setSelectedDate(dateString);
  }, []);

  const handleDelete = useCallback(
    async (id: number) => {
      Alert.alert('삭제 확인', '이 거래내역을 삭제하시겠습니까?', [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(id);
              await api.deleteTransaction(id);
              await fetchData(monthString);
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
    [fetchData, monthString],
  );

  // 월간 합계
  const monthlyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const day of Object.values(summary)) {
      income += day.income;
      expense += day.expense;
    }
    return {income, expense, balance: income - expense};
  }, [summary]);

  // 선택된 날짜의 거래내역 필터링
  const selectedTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = tx.date.split('T')[0];
      return txDate === selectedDate;
    });
  }, [transactions, selectedDate]);

  // 캘린더 마킹 데이터 생성
  const markedDates = useMemo(() => {
    const marks: Record<string, {income?: number; expense?: number}> = {};
    for (const [dateKey, values] of Object.entries(summary)) {
      marks[dateKey] = {
        income: values.income,
        expense: values.expense,
      };
    }
    return marks;
  }, [summary]);

  const themeColors = useMemo(() => ({
    primary: theme.colors.primary,
    error: theme.colors.error,
    surface: theme.colors.surface,
    onSurface: theme.colors.onSurface,
    outline: theme.colors.outline,
    primaryContainer: theme.colors.primaryContainer,
  }), [theme]);

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingTop: insets.top + 8}]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* 월 타이틀 */}
        <Text
          variant="titleMedium"
          style={[styles.monthTitle, {color: theme.colors.onBackground, fontFamily: 'NanumGothic-Bold'}]}>
          {getMonthLabel(currentMonth)}
        </Text>

        {/* 캘린더 - 좌우 스와이프로 월 이동 */}
        <Surface style={styles.calendarSurface} elevation={1}>
          <Calendar
            current={initialMonth}
            enableSwipeMonths
            showSixWeeks
            hideDayNames
            hideArrows
            onMonthChange={(month: DateData) => {
              setCurrentMonth(new Date(month.year, month.month - 1, 1));
            }}
            renderHeader={() => (
              <WeekdayHeader defaultColor={theme.colors.onSurface} />
            )}
            dayComponent={({date, state}) => (
              <DayComponent
                date={date}
                state={state}
                marking={date ? markedDates[date.dateString] : undefined}
                selectedDate={selectedDate}
                onPress={handleDayPress}
                themeColors={themeColors}
                holidays={holidays}
              />
            )}
            theme={{
              calendarBackground: theme.colors.surface,
              textSectionTitleColor: theme.colors.onSurface,
              todayTextColor: theme.colors.primary,
              dayTextColor: theme.colors.onSurface,
              textDisabledColor: theme.colors.outline,
              monthTextColor: theme.colors.onSurface,
            } as Record<string, unknown>}
            style={styles.calendar}
          />
        </Surface>

        {/* 월간 요약 */}
        <Surface style={styles.summarySurface} elevation={1}>
          <Text variant="titleSmall" style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
            {getMonthLabel(currentMonth)} 요약
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="bodySmall" style={{color: theme.colors.outline}}>
                수입
              </Text>
              <Text variant="titleMedium" style={{color: theme.colors.primary, fontWeight: '700'}}>
                {formatAmount(monthlyTotals.income)}
              </Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: theme.colors.outline}]} />
            <View style={styles.summaryItem}>
              <Text variant="bodySmall" style={{color: theme.colors.outline}}>
                지출
              </Text>
              <Text variant="titleMedium" style={{color: theme.colors.error, fontWeight: '700'}}>
                {formatAmount(monthlyTotals.expense)}
              </Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: theme.colors.outline}]} />
            <View style={styles.summaryItem}>
              <Text variant="bodySmall" style={{color: theme.colors.outline}}>
                잔액
              </Text>
              <Text
                variant="titleMedium"
                style={{
                  color: monthlyTotals.balance >= 0 ? theme.colors.primary : theme.colors.error,
                  fontWeight: '700',
                }}>
                {formatAmount(monthlyTotals.balance)}
              </Text>
            </View>
          </View>
        </Surface>

        {/* 선택된 날짜의 거래내역 */}
        <Surface style={styles.transactionsSurface} elevation={1}>
          <Text variant="titleSmall" style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
            {selectedDate.replace(/-/g, '.')} 내역
          </Text>

          {selectedTransactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline}}>
                거래 내역이 없습니다.
              </Text>
            </View>
          ) : (
            selectedTransactions.map((tx, index) => (
              <React.Fragment key={tx.id}>
                {index > 0 && <Divider />}
                <TouchableOpacity
                  style={styles.transactionItem}
                  onLongPress={() => handleDelete(tx.id)}
                  activeOpacity={0.7}>
                  <View style={styles.transactionLeft}>
                    <View style={[styles.categoryIcon, {backgroundColor: theme.colors.primaryContainer}]}>
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
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    {deleting === tx.id ? (
                      <ActivityIndicator size={16} />
                    ) : (
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: tx.type === 'income' ? theme.colors.primary : theme.colors.error,
                          fontWeight: '600',
                        }}>
                        {tx.type === 'income' ? '+' : '-'}
                        {formatAmount(Number(tx.amount))}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))
          )}
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  monthTitle: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
  },
  calendarSurface: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  calendar: {
    paddingBottom: 8,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summarySurface: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
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
  transactionsSurface: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionRight: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
});

export default HomeScreen;
