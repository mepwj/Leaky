import React, {useEffect} from 'react';
import {Platform, StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PaperProvider} from 'react-native-paper';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {lightTheme} from './src/config/theme';
import {GOOGLE_WEB_CLIENT_ID} from './src/config/env';
import RootNavigator from './src/navigation/RootNavigator';
import {AuthProvider} from './src/context/AuthContext';

function App(): React.JSX.Element {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Dynamic import to avoid bundling native module on web
      const {GoogleSignin} = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
      });
    }
  }, []);

  const theme = lightTheme;
  const isDark = colorScheme === 'dark';

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={theme.colors.background}
          />
          <AuthProvider>
            <NavigationContainer
              documentTitle={{formatter: () => 'Leaky'}}>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
