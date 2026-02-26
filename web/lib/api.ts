import type {
  AccountsResponse,
  AssetSummaryResponse,
  AuthResponse,
  BudgetsResponse,
  CardsResponse,
  CategoriesResponse,
  MeResponse,
  TransactionSummaryResponse,
  TransactionsResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || '';

if (typeof window !== 'undefined' && !API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('NEXT_PUBLIC_API_BASE_URL is not configured.');
}

const TOKEN_KEY = 'jwt_token';

export const tokenStorage = {
  get(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(TOKEN_KEY);
  },
  save(token: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  remove(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `HTTP error ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export const api = {
  googleLogin: (idToken: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  getMe: (token: string): Promise<MeResponse> => request<MeResponse>('/auth/me', { method: 'GET' }, token),

  updateProfile: (token: string, nickname: string): Promise<MeResponse> =>
    request<MeResponse>(
      '/auth/profile',
      {
        method: 'PATCH',
        body: JSON.stringify({ nickname }),
      },
      token,
    ),

  getTransactionSummary: (token: string, month: string): Promise<TransactionSummaryResponse> =>
    request<TransactionSummaryResponse>(`/transactions/summary?month=${month}`, { method: 'GET' }, token),

  getTransactions: (token: string, month: string): Promise<TransactionsResponse> =>
    request<TransactionsResponse>(`/transactions?month=${month}`, { method: 'GET' }, token),

  createTransaction: (
    token: string,
    payload: {
      type: 'income' | 'expense';
      amount: number;
      categoryId?: number;
      paymentMethod: 'cash' | 'account' | 'card';
      paymentSourceId?: number | null;
      memo?: string;
      date: string;
    },
  ) =>
    request('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  getCategories: (token: string, type?: 'income' | 'expense'): Promise<CategoriesResponse> => {
    const query = type ? `?type=${type}` : '';
    return request<CategoriesResponse>(`/categories${query}`, { method: 'GET' }, token);
  },

  getAccounts: (token: string): Promise<AccountsResponse> => request<AccountsResponse>('/assets/accounts', { method: 'GET' }, token),

  createAccount: (
    token: string,
    payload: {
      bankName: string;
      alias?: string;
      balance?: number;
    },
  ) =>
    request<{ account: { id: number } }>('/assets/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  deleteAccount: (token: string, id: number) => request(`/assets/accounts/${id}`, { method: 'DELETE' }, token),

  getCards: (token: string): Promise<CardsResponse> => request<CardsResponse>('/assets/cards', { method: 'GET' }, token),

  createCard: (
    token: string,
    payload: {
      cardCompany: string;
      alias?: string;
      cardType?: 'credit' | 'check';
      paymentDay?: number;
      linkedAccountId?: number;
    },
  ) =>
    request<{ card: { id: number } }>('/assets/cards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  deleteCard: (token: string, id: number) => request(`/assets/cards/${id}`, { method: 'DELETE' }, token),

  getAssetSummary: (token: string): Promise<AssetSummaryResponse> =>
    request<AssetSummaryResponse>('/assets/summary', { method: 'GET' }, token),

  getBudgets: (token: string, month: string): Promise<BudgetsResponse> =>
    request<BudgetsResponse>(`/budgets?month=${month}`, { method: 'GET' }, token),
};
