import Config from 'react-native-config';

type EnvMap = Record<string, string | undefined>;

const env = Config as unknown as EnvMap;

const DEFAULT_API_BASE_URL = 'http://mepwj.iptime.org:3000';
const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '230616603857-r0lv9i8fjbtt04if1pcv875e7plj8aoa.apps.googleusercontent.com';

export const API_BASE_URL =
  env.API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export const GOOGLE_WEB_CLIENT_ID =
  env.GOOGLE_WEB_CLIENT_ID?.trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID;
