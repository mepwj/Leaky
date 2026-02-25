import AsyncStorage from '@react-native-async-storage/async-storage';

// adb reverse tcp:3000 tcp:3000 으로 물리기기/에뮬레이터 모두 localhost 사용
const BASE_URL = 'http://localhost:3000';

const JWT_KEY = 'jwt_token';

export const tokenStorage = {
  save: async (token: string): Promise<void> => {
    await AsyncStorage.setItem(JWT_KEY, token);
  },
  get: async (): Promise<string | null> => {
    return AsyncStorage.getItem(JWT_KEY);
  },
  remove: async (): Promise<void> => {
    await AsyncStorage.removeItem(JWT_KEY);
  },
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function post<T>(path: string, body: unknown, auth = false): Promise<T> {
  const headers = auth
    ? await getAuthHeaders()
    : {'Content-Type': 'application/json'};

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data as T;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    nickname?: string;
    provider: string;
    emailVerified: boolean;
  };
}

export interface User {
  id: number;
  email: string;
  name?: string;
}

export const api = {
  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    return post<AuthResponse>('/auth/google', {idToken});
  },

  signup: async (email: string, password: string): Promise<AuthResponse> => {
    return post<AuthResponse>('/auth/signup', {email, password});
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    return post<AuthResponse>('/auth/login', {email, password});
  },

  getMe: async (): Promise<User> => {
    return get<User>('/auth/me');
  },
};
