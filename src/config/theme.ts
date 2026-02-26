import {MD3LightTheme, MD3DarkTheme, configureFonts} from 'react-native-paper';

const fontConfig = {
  fontFamily: 'NanumGothic-Regular',
};

const fonts = configureFonts({config: fontConfig});

export const lightTheme = {
  ...MD3LightTheme,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    primaryContainer: '#BBDEFB',
    secondary: '#4CAF50',
    secondaryContainer: '#C8E6C9',
    error: '#F44336',
    errorContainer: '#FFCDD2',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onError: '#FFFFFF',
    onBackground: '#1C1B1F',
    onSurface: '#1C1B1F',
    outline: '#79747E',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#90CAF9',
    primaryContainer: '#1565C0',
    secondary: '#A5D6A7',
    secondaryContainer: '#2E7D32',
    error: '#EF9A9A',
    errorContainer: '#B71C1C',
    background: '#121212',
    surface: '#1E1E1E',
    onPrimary: '#003258',
    onSecondary: '#003909',
    onError: '#5F1412',
    onBackground: '#E6E1E5',
    onSurface: '#E6E1E5',
    outline: '#938F99',
  },
};

export type AppTheme = typeof lightTheme;
