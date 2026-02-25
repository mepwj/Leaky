import React from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useAuth} from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

function RootNavigator(): React.JSX.Element {
  const theme = useTheme();
  const {isAuthenticated} = useAuth();

  if (isAuthenticated === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
}

export default RootNavigator;
