import React, {useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
  Button,
  TextInput,
  IconButton,
  ActivityIndicator,
  Divider,
  List,
  SegmentedButtons,
} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {useAuth} from '../../context/AuthContext';
import {api, Category} from '../../services/api';

// ─── 아이콘 피커에 표시할 이모지 목록 ──────────────────────────────
const ICON_OPTIONS = [
  '🍚', '☕', '🚌', '🛍️', '🏠', '📱', '🏥', '🎬', '📚', '💐', '📋', '💰', '➕',
  '💵', '💼', '🎁', '📈', '🔄', '🎮', '🏋️', '✈️', '🐕', '👶', '💊', '🎵', '📦',
  '🍺', '🍕', '🎂', '🌿', '🔧', '💻', '📞', '🚗', '⛽', '🏪', '✂️', '👔',
];

// ─── 카테고리 모달 상태 타입 ─────────────────────────────────────
interface CategoryDialogState {
  visible: boolean;
  mode: 'add' | 'edit';
  editId: number | null;
  name: string;
  icon: string;
  type: 'expense' | 'income';
}

const initialCategoryDialog: CategoryDialogState = {
  visible: false,
  mode: 'add',
  editId: null,
  name: '',
  icon: '',
  type: 'expense',
};

// ─── 프로필 수정 모달 상태 타입 ──────────────────────────────────
interface ProfileDialogState {
  visible: boolean;
  nickname: string;
}

const initialProfileDialog: ProfileDialogState = {
  visible: false,
  nickname: '',
};

function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {signOut, userNickname} = useAuth();

  // ─── 데이터 상태 ─────────────────────────────────────────────
  const [email, setEmail] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── 카테고리 탭 상태 ────────────────────────────────────────
  const [categoryType, setCategoryType] = useState<string>('expense');

  // ─── 모달 상태 ───────────────────────────────────────────────
  const [categoryDialog, setCategoryDialog] =
    useState<CategoryDialogState>(initialCategoryDialog);
  const [profileDialog, setProfileDialog] =
    useState<ProfileDialogState>(initialProfileDialog);

  // ─── 데이터 로드 ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [meRes, catRes] = await Promise.all([
        api.getMe(),
        api.getCategories(),
      ]);
      setEmail(meRes.user.email);
      setNickname(meRes.user.nickname || '');
      setCategories(catRes.categories);
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

  // 화면 포커스 시 데이터 로드
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  // ─── 현재 탭에 해당하는 카테고리 필터링 ──────────────────────
  const filteredCategories = categories.filter(
    cat => cat.type === categoryType,
  );

  // ─── 카테고리가 기본(수정 불가)인지 판별 ─────────────────────
  const isDefaultCategory = (cat: Category): boolean => {
    return cat.isDefault || cat.userId === null;
  };

  // ─── 프로필 수정 ─────────────────────────────────────────────
  const openProfileDialog = useCallback(() => {
    setProfileDialog({visible: true, nickname});
  }, [nickname]);

  const closeProfileDialog = useCallback(() => {
    setProfileDialog(prev => ({...prev, visible: false}));
  }, []);

  const handleSaveProfile = useCallback(async () => {
    const trimmed = profileDialog.nickname.trim();
    if (!trimmed) {
      Alert.alert('알림', '닉네임을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateProfile(trimmed);
      setNickname(res.user.nickname || '');
      closeProfileDialog();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : '프로필 저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setSaving(false);
    }
  }, [profileDialog.nickname, closeProfileDialog]);

  // ─── 카테고리 추가/수정 다이얼로그 ──────────────────────────
  const openAddCategoryDialog = useCallback(() => {
    setCategoryDialog({
      visible: true,
      mode: 'add',
      editId: null,
      name: '',
      icon: '',
      type: categoryType as 'expense' | 'income',
    });
  }, [categoryType]);

  const openEditCategoryDialog = useCallback((cat: Category) => {
    setCategoryDialog({
      visible: true,
      mode: 'edit',
      editId: cat.id,
      name: cat.name,
      icon: cat.icon || '',
      type: cat.type as 'expense' | 'income',
    });
  }, []);

  const closeCategoryDialog = useCallback(() => {
    setCategoryDialog(prev => ({...prev, visible: false}));
  }, []);

  const handleSaveCategory = useCallback(async () => {
    const trimmedName = categoryDialog.name.trim();
    if (!trimmedName) {
      Alert.alert('알림', '카테고리 이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      if (categoryDialog.mode === 'add') {
        await api.createCategory({
          type: categoryDialog.type,
          name: trimmedName,
          icon: categoryDialog.icon || undefined,
        });
      } else if (categoryDialog.editId !== null) {
        await api.updateCategory(categoryDialog.editId, {
          name: trimmedName,
          icon: categoryDialog.icon || undefined,
        });
      }
      closeCategoryDialog();
      // 카테고리 목록 새로고침
      const catRes = await api.getCategories();
      setCategories(catRes.categories);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : '저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setSaving(false);
    }
  }, [categoryDialog, closeCategoryDialog]);

  // ─── 카테고리 삭제 ───────────────────────────────────────────
  const handleDeleteCategory = useCallback(
    (cat: Category) => {
      Alert.alert(
        '삭제 확인',
        `"${cat.name}" 카테고리를 삭제하시겠습니까?`,
        [
          {text: '취소', style: 'cancel'},
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteCategory(cat.id);
                const catRes = await api.getCategories();
                setCategories(catRes.categories);
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
    [],
  );

  // ─── 로그아웃 ────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {
            await GoogleSignin.signOut();
          } catch {
            // Google 로그아웃 실패 시 무시
          }
          signOut();
        },
      },
    ]);
  }, [signOut]);

  // ─── 아바타 첫 글자 추출 ─────────────────────────────────────
  const avatarLetter = (nickname || userNickname || email || '?')
    .charAt(0)
    .toUpperCase();

  // ─── 로딩 화면 ──────────────────────────────────────────────
  if (loading && categories.length === 0 && !nickname) {
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

  // ─── 렌더링 ─────────────────────────────────────────────────
  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingTop: insets.top + 8},
        ]}>
        {/* ─── 프로필 섹션 ──────────────────────────────────── */}
        <Surface style={styles.profileSurface} elevation={2}>
          {/* 아바타 */}
          <View
            style={[
              styles.avatar,
              {backgroundColor: theme.colors.primaryContainer},
            ]}>
            <Text
              variant="headlineLarge"
              style={{color: theme.colors.primary, fontWeight: '700'}}>
              {avatarLetter}
            </Text>
          </View>

          {/* 닉네임 */}
          <Text
            variant="titleLarge"
            style={[styles.profileNickname, {color: theme.colors.onSurface}]}>
            {nickname || userNickname || '사용자'}
          </Text>

          {/* 이메일 */}
          <Text
            variant="bodyMedium"
            style={{color: theme.colors.outline, marginBottom: 16}}>
            {email}
          </Text>

          {/* 프로필 수정 버튼 */}
          <Button
            mode="outlined"
            compact
            onPress={openProfileDialog}
            style={styles.profileEditButton}>
            {'프로필 수정'}
          </Button>
        </Surface>

        {/* ─── 카테고리 관리 섹션 ──────────────────────────── */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
              {'카테고리 관리'}
            </Text>
          </View>

          {/* 지출/수입 탭 토글 */}
          <View style={styles.segmentedContainer}>
            <SegmentedButtons
              value={categoryType}
              onValueChange={setCategoryType}
              buttons={[
                {value: 'expense', label: '지출 카테고리'},
                {value: 'income', label: '수입 카테고리'},
              ]}
            />
          </View>

          {/* 카테고리 목록 */}
          {filteredCategories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={{color: theme.colors.outline}}>
                {'등록된 카테고리가 없습니다.'}
              </Text>
            </View>
          ) : (
            filteredCategories.map((cat, index) => (
              <React.Fragment key={cat.id}>
                {index > 0 && <Divider />}
                <List.Item
                  title={cat.name}
                  left={() => (
                    <View style={styles.categoryIconContainer}>
                      <Text style={styles.categoryIconText}>
                        {cat.icon || (cat.type === 'expense' ? '💸' : '💵')}
                      </Text>
                    </View>
                  )}
                  right={() =>
                    isDefaultCategory(cat) ? (
                      // 기본 카테고리 - 잠금 아이콘
                      <View style={styles.listRight}>
                        <IconButton
                          icon="lock-outline"
                          size={18}
                          iconColor={theme.colors.outline}
                          onPress={() => {}}
                          disabled
                        />
                      </View>
                    ) : (
                      // 사용자 정의 카테고리 - 수정/삭제 버튼
                      <View style={styles.listRight}>
                        <IconButton
                          icon="pencil-outline"
                          size={18}
                          onPress={() => openEditCategoryDialog(cat)}
                        />
                        <IconButton
                          icon="delete-outline"
                          size={18}
                          iconColor={theme.colors.error}
                          onPress={() => handleDeleteCategory(cat)}
                        />
                      </View>
                    )
                  }
                  style={styles.listItem}
                />
              </React.Fragment>
            ))
          )}

          {/* 카테고리 추가 버튼 */}
          <Divider />
          <Button
            mode="text"
            icon="plus"
            onPress={openAddCategoryDialog}
            style={styles.addCategoryButton}>
            {'카테고리 추가'}
          </Button>
        </Surface>

        {/* ─── 앱 설정 섹션 ────────────────────────────────── */}
        <Surface style={styles.sectionSurface} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text
              variant="titleSmall"
              style={[styles.sectionTitle, {color: theme.colors.onSurface}]}>
              {'앱 설정'}
            </Text>
          </View>
          <List.Item
            title="버전 정보"
            description="1.0.0"
            left={props => <List.Icon {...props} icon="information-outline" />}
            style={styles.listItem}
          />
        </Surface>

        {/* ─── 로그아웃 버튼 ───────────────────────────────── */}
        <View style={styles.logoutContainer}>
          <Button
            mode="outlined"
            onPress={handleLogout}
            textColor={theme.colors.error}
            style={[styles.logoutButton, {borderColor: theme.colors.error}]}>
            {'로그아웃'}
          </Button>
        </View>
      </ScrollView>

      {/* ─── 프로필 수정 모달 ──────────────────────────────── */}
      <Modal
        visible={profileDialog.visible}
        transparent
        animationType="fade"
        onRequestClose={closeProfileDialog}>
        <Pressable style={styles.modalOverlay} onPress={closeProfileDialog}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}>
            <Pressable
              style={[
                styles.dialogContainer,
                {backgroundColor: theme.colors.surface},
              ]}
              onPress={() => {}}>
              <Text
                variant="titleLarge"
                style={[styles.dialogTitle, {color: theme.colors.onSurface}]}>
                {'프로필 수정'}
              </Text>
              <TextInput
                label="닉네임"
                value={profileDialog.nickname}
                onChangeText={text =>
                  setProfileDialog(prev => ({...prev, nickname: text}))
                }
                mode="outlined"
                style={styles.dialogInput}
                outlineColor={theme.colors.outline + '40'}
                activeOutlineColor={theme.colors.primary}
                autoFocus
              />
              <View style={styles.dialogActions}>
                <Button
                  mode="text"
                  onPress={closeProfileDialog}
                  disabled={saving}>
                  {'취소'}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveProfile}
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

      {/* ─── 카테고리 추가/수정 모달 ──────────────────────── */}
      <Modal
        visible={categoryDialog.visible}
        transparent
        animationType="fade"
        onRequestClose={closeCategoryDialog}>
        <Pressable style={styles.modalOverlay} onPress={closeCategoryDialog}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}>
            <Pressable
              style={[
                styles.dialogContainer,
                {backgroundColor: theme.colors.surface},
              ]}
              onPress={() => {}}>
              <Text
                variant="titleLarge"
                style={[styles.dialogTitle, {color: theme.colors.onSurface}]}>
                {categoryDialog.mode === 'add'
                  ? '카테고리 추가'
                  : '카테고리 수정'}
              </Text>

              {/* 카테고리 이름 입력 */}
              <TextInput
                label="카테고리 이름"
                value={categoryDialog.name}
                onChangeText={text =>
                  setCategoryDialog(prev => ({...prev, name: text}))
                }
                mode="outlined"
                style={styles.dialogInput}
                outlineColor={theme.colors.outline + '40'}
                activeOutlineColor={theme.colors.primary}
                autoFocus
              />

              {/* 아이콘 선택 라벨 */}
              <Text
                variant="bodyMedium"
                style={[styles.iconPickerLabel, {color: theme.colors.onSurface}]}>
                {'아이콘 선택'}
              </Text>

              {/* 아이콘 그리드 */}
              <ScrollView
                style={styles.iconScrollView}
                nestedScrollEnabled>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map(icon => {
                    const isSelected = categoryDialog.icon === icon;
                    return (
                      <Pressable
                        key={icon}
                        onPress={() =>
                          setCategoryDialog(prev => ({
                            ...prev,
                            icon: isSelected ? '' : icon,
                          }))
                        }
                        style={[
                          styles.iconCell,
                          isSelected && {
                            backgroundColor: theme.colors.primaryContainer,
                            borderColor: theme.colors.primary,
                            borderWidth: 2,
                          },
                        ]}>
                        <Text style={styles.iconCellText}>{icon}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* 저장/취소 버튼 */}
              <View style={styles.dialogActions}>
                <Button
                  mode="text"
                  onPress={closeCategoryDialog}
                  disabled={saving}>
                  {'취소'}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveCategory}
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
    paddingBottom: 40,
  },

  // ─── 프로필 섹션 ────────────────────────────────────────────
  profileSurface: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileNickname: {
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEditButton: {
    borderRadius: 8,
  },

  // ─── 섹션 공통 ──────────────────────────────────────────────
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

  // ─── 카테고리 탭 ────────────────────────────────────────────
  segmentedContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // ─── 카테고리 목록 ──────────────────────────────────────────
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  categoryIconText: {
    fontSize: 20,
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
  addCategoryButton: {
    marginVertical: 4,
  },

  // ─── 로그아웃 ────────────────────────────────────────────────
  logoutContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  logoutButton: {
    borderRadius: 8,
  },

  // ─── 모달 공통 ──────────────────────────────────────────────
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

  // ─── 아이콘 피커 ─────────────────────────────────────────────
  iconPickerLabel: {
    fontWeight: '500',
    marginBottom: 8,
  },
  iconScrollView: {
    maxHeight: 180,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  iconCellText: {
    fontSize: 22,
  },
});

export default SettingsScreen;
