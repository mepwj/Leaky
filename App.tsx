import React, {useEffect} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PaperProvider} from 'react-native-paper';
import {NavigationContainer} from '@react-navigation/native';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {lightTheme} from './src/config/theme';
import {GOOGLE_WEB_CLIENT_ID} from './src/config/env';
import RootNavigator from './src/navigation/RootNavigator';
import {AuthProvider} from './src/context/AuthContext';

function App(): React.JSX.Element {
  const colorScheme = useColorScheme();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  // 테마 선택: 시스템 설정 존중
  // 현재는 lightTheme 사용; 준비되면 darkTheme으로 확장
  const theme = lightTheme;
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
        />
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
