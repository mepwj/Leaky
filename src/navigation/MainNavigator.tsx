import React from 'react';
import {View, StyleSheet, TouchableOpacity} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {useTheme} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MaterialCommunityIcons} from '../components/Icon';
import HomeScreen from '../screens/main/HomeScreen';
import StatsScreen from '../screens/main/StatsScreen';
import AssetScreen from '../screens/main/AssetScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import AddTransactionScreen from '../screens/main/AddTransactionScreen';
import DailyDetailScreen from '../screens/main/DailyDetailScreen';
import {Transaction} from '../services/api';

export type MainTabParamList = {
  Home: undefined;
  Stats: undefined;
  AddPlaceholder: undefined;
  Asset: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  AddTransaction: {date?: string; editTransaction?: Transaction} | undefined;
  DailyDetail: {date: string};
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

// "+" 탭의 플레이스홀더 컴포넌트 (실제로 렌더링되지 않음)
function EmptyScreen(): React.JSX.Element {
  return <View />;
}

function AddButton({onPress}: {onPress: () => void}): React.JSX.Element {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.addButton, {backgroundColor: theme.colors.primary}]}
      onPress={onPress}
      activeOpacity={0.8}>
      <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function MainTabs(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 0.5,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 4,
        },
        tabBarIcon: ({color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'calendar-month-outline';
              break;
            case 'Stats':
              iconName = 'chart-bar';
              break;
            case 'Asset':
              iconName = 'wallet-outline';
              break;
            case 'Settings':
              iconName = 'cog-outline';
              break;
            default:
              iconName = 'circle-outline';
          }

          return (
            <MaterialCommunityIcons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
      })}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{tabBarLabel: '홈'}}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{tabBarLabel: '통계'}}
      />
      <Tab.Screen
        name="AddPlaceholder"
        component={EmptyScreen}
        options={({navigation}) => ({
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => (
            <View style={styles.addButtonWrapper}>
              <AddButton
                onPress={() => {
                  const parent =
                    navigation.getParent<
                      NativeStackNavigationProp<MainStackParamList>
                    >();
                  parent?.navigate('AddTransaction');
                }}
              />
            </View>
          ),
        })}
        listeners={({navigation}) => ({
          tabPress: (e: {preventDefault: () => void}) => {
            e.preventDefault();
            const parent =
              navigation.getParent<
                NativeStackNavigationProp<MainStackParamList>
              >();
            parent?.navigate('AddTransaction');
          },
        })}
      />
      <Tab.Screen
        name="Asset"
        component={AssetScreen}
        options={{tabBarLabel: '자산'}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{tabBarLabel: '설정'}}
      />
    </Tab.Navigator>
  );
}

function MainNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="DailyDetail" component={DailyDetailScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  addButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default MainNavigator;
