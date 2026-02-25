import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import {
  Text,
  SegmentedButtons,
  TextInput,
  Button,
  useTheme,
  Surface,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import {Calendar, DateData} from 'react-native-calendars';
import {useNavigation} from '@react-navigation/native';
import {api, Category, CreateTransactionData} from '../../services/api';

type TransactionType = 'expense' | 'income';
type PaymentMethod = 'cash' | 'account' | 'card';

function AddTransactionScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation();

  // 폼 상태
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [memo, setMemo] = useState('');

  // 데이터 상태
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  const typeColor = type === 'income' ? '#2196F3' : theme.colors.error;

  const fetchCategories = useCallback(async (categoryType: string) => {
    setLoadingCategories(true);
    try {
      const response = await api.getCategories(categoryType);
      setCategories(response.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories(type);
    setSelectedCategory(null);
  }, [type, fetchCategories]);

  const formatDateToString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekDay = weekDays[d.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekDay})`;
  };

  const formatAmount = (value: string): string => {
    const num = value.replace(/[^0-9]/g, '');
    if (!num) {
      return '';
    }
    return Number(num).toLocaleString('ko-KR');
  };

  const handleAmountChange = (value: string) => {
    const numericOnly = value.replace(/[^0-9]/g, '');
    setAmount(numericOnly);
  };

  const handleDateSelect = (dateData: DateData) => {
    const [year, month, day] = dateData.dateString.split('-').map(Number);
    setDate(new Date(year, month - 1, day));
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!amount || Number(amount) === 0) {
      Alert.alert('알림', '금액을 입력해주세요.');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('알림', '카테고리를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const data: CreateTransactionData = {
        type,
        amount: Number(amount),
        categoryId: selectedCategory.id,
        paymentMethod,
        memo: memo.trim() || undefined,
        date: formatDateToString(date),
      };

      await api.createTransaction(data);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryGrid = () => {
    if (loadingCategories) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }

    if (categories.length === 0) {
      return (
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.outline,
            textAlign: 'center',
            padding: 16,
          }}>
          카테고리가 없습니다.
        </Text>
      );
    }

    const rows: Category[][] = [];
    for (let i = 0; i < categories.length; i += 4) {
      rows.push(categories.slice(i, i + 4));
    }

    return (
      <View style={styles.categoryGrid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.categoryRow}>
            {row.map(category => {
              const isSelected = selectedCategory?.id === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    {
                      backgroundColor: isSelected
                        ? typeColor + '20'
                        : theme.colors.surface,
                      borderColor: isSelected
                        ? typeColor
                        : theme.colors.outline + '40',
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.7}>
                  <Text style={styles.categoryIcon}>
                    {category.icon || '📌'}
                  </Text>
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={{
                      color: isSelected ? typeColor : theme.colors.onSurface,
                      fontWeight: isSelected ? '700' : '400',
                    }}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* 그리드 정렬 유지를 위한 빈 셀 채우기 */}
            {row.length < 4 &&
              Array.from({length: 4 - row.length}).map((_, idx) => (
                <View key={`empty-${idx}`} style={styles.categoryItemEmpty} />
              ))}
          </View>
        ))}
      </View>
    );
  };

  const todayString = formatDateToString(new Date());
  const selectedDateString = formatDateToString(date);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        {/* 헤더 */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.outline + '40',
            },
          ]}>
          <IconButton
            icon="close"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text variant="titleMedium" style={{color: theme.colors.onSurface}}>
            {type === 'income' ? '수입' : '지출'} 등록
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* 수입/지출 토글 */}
          <View style={styles.section}>
            <SegmentedButtons
              value={type}
              onValueChange={value => setType(value as TransactionType)}
              buttons={[
                {
                  value: 'expense',
                  label: '지출',
                  checkedColor: theme.colors.error,
                  style:
                    type === 'expense'
                      ? {backgroundColor: theme.colors.errorContainer}
                      : undefined,
                },
                {
                  value: 'income',
                  label: '수입',
                  checkedColor: '#2196F3',
                  style:
                    type === 'income'
                      ? {backgroundColor: '#BBDEFB'}
                      : undefined,
                },
              ]}
            />
          </View>

          {/* 금액 입력 */}
          <Surface
            style={[
              styles.amountContainer,
              {backgroundColor: theme.colors.surface},
            ]}
            elevation={0}>
            <Text
              variant="titleSmall"
              style={{color: theme.colors.outline, marginBottom: 8}}>
              금액
            </Text>
            <View style={styles.amountRow}>
              <Text
                variant="headlineLarge"
                style={{color: typeColor, fontWeight: '700'}}>
                ₩
              </Text>
              <TextInput
                value={formatAmount(amount)}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.outline}
                style={[styles.amountInput, {color: typeColor}]}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                contentStyle={[styles.amountInputContent, {color: typeColor}]}
              />
            </View>
          </Surface>

          {/* 날짜 선택 */}
          <Surface
            style={[
              styles.dateContainer,
              {backgroundColor: theme.colors.surface},
            ]}
            elevation={0}>
            <Text
              variant="titleSmall"
              style={{color: theme.colors.outline, marginBottom: 8}}>
              날짜
            </Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                {borderColor: theme.colors.outline + '40'},
              ]}
              onPress={() => setShowDatePicker(true)}>
              <Text variant="bodyLarge" style={{color: theme.colors.onSurface}}>
                {formatDisplayDate(date)}
              </Text>
            </TouchableOpacity>
          </Surface>

          {/* 날짜 선택 모달 */}
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}>
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowDatePicker(false)}>
              <Pressable
                style={[
                  styles.calendarModal,
                  {backgroundColor: theme.colors.surface},
                ]}
                onPress={() => {}}>
                <Calendar
                  current={selectedDateString}
                  maxDate={todayString}
                  onDayPress={handleDateSelect}
                  markedDates={{
                    [selectedDateString]: {
                      selected: true,
                      selectedColor: typeColor,
                    },
                  }}
                  theme={{
                    backgroundColor: theme.colors.surface,
                    calendarBackground: theme.colors.surface,
                    textSectionTitleColor: theme.colors.onSurface,
                    selectedDayBackgroundColor: typeColor,
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: theme.colors.primary,
                    dayTextColor: theme.colors.onSurface,
                    textDisabledColor: theme.colors.outline + '60',
                    arrowColor: theme.colors.primary,
                    monthTextColor: theme.colors.onSurface,
                    textMonthFontWeight: 'bold',
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 13,
                  }}
                />
              </Pressable>
            </Pressable>
          </Modal>

          {/* 카테고리 선택 */}
          <Surface
            style={[
              styles.categoryContainer,
              {backgroundColor: theme.colors.surface},
            ]}
            elevation={0}>
            <Text
              variant="titleSmall"
              style={{color: theme.colors.outline, marginBottom: 12}}>
              카테고리
            </Text>
            {renderCategoryGrid()}
          </Surface>

          {/* 결제수단 */}
          <Surface
            style={[
              styles.paymentContainer,
              {backgroundColor: theme.colors.surface},
            ]}
            elevation={0}>
            <Text
              variant="titleSmall"
              style={{color: theme.colors.outline, marginBottom: 8}}>
              결제수단
            </Text>
            <SegmentedButtons
              value={paymentMethod}
              onValueChange={value =>
                setPaymentMethod(value as PaymentMethod)
              }
              buttons={[
                {value: 'cash', label: '현금'},
                {value: 'account', label: '계좌'},
                {value: 'card', label: '카드'},
              ]}
            />
          </Surface>

          {/* 메모 */}
          <Surface
            style={[
              styles.memoContainer,
              {backgroundColor: theme.colors.surface},
            ]}
            elevation={0}>
            <Text
              variant="titleSmall"
              style={{color: theme.colors.outline, marginBottom: 8}}>
              메모
            </Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="메모를 입력하세요 (선택)"
              placeholderTextColor={theme.colors.outline}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.memoInput}
              outlineColor={theme.colors.outline + '40'}
              activeOutlineColor={theme.colors.primary}
            />
          </Surface>

          {/* 저장 버튼 */}
          <View style={styles.saveSection}>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving || !amount || Number(amount) === 0}
              style={[styles.saveButton, {backgroundColor: typeColor}]}
              labelStyle={styles.saveButtonLabel}
              contentStyle={styles.saveButtonContent}>
              저장
            </Button>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
  },
  headerSpacer: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  section: {
    marginTop: 16,
  },
  amountContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 32,
    fontWeight: '700',
    marginLeft: 4,
  },
  amountInputContent: {
    fontSize: 32,
    fontWeight: '700',
    paddingLeft: 0,
  },
  dateContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  dateButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  calendarModal: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 8,
  },
  categoryContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  categoryGrid: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  categoryItemEmpty: {
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  paymentContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  memoContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  memoInput: {
    backgroundColor: 'transparent',
  },
  saveSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  saveButton: {
    borderRadius: 12,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
});

export default AddTransactionScreen;
