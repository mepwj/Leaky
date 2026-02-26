import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'http://mepwj.iptime.org:3000';
const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '230616603857-r0lv9i8fjbtt04if1pcv875e7plj8aoa.apps.googleusercontent.com';

function getEnv(key: string): string | undefined {
  if (Platform.OS === 'web') {
    // Expo web supports process.env for EXPO_PUBLIC_ prefixed vars
    const expoKey = `EXPO_PUBLIC_${key}`;
    // @ts-ignore - process.env available at build time
    return typeof process !== 'undefined' ? process.env[expoKey] : undefined;
  }
  // On native, use fallback values (previously from react-native-config)
  return undefined;
}

export const API_BASE_URL =
  getEnv('API_BASE_URL')?.trim() || DEFAULT_API_BASE_URL;

export const GOOGLE_WEB_CLIENT_ID =
  getEnv('GOOGLE_WEB_CLIENT_ID')?.trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID;
