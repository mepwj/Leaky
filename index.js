import { Platform, AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

if (Platform.OS === 'web') {
  const { registerRootComponent } = require('expo');
  registerRootComponent(App);
} else {
  AppRegistry.registerComponent(appName, () => App);
}
