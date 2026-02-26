import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/env';

// 웹: Vercel rewrite 활용 (/api/* → 백엔드), 네이티브: 직접 연결
const BASE_URL = Platform.OS === 'web' ? '/api' : API_BASE_URL;

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

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
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
    if (response.status === 401) {
      await tokenStorage.remove();
      onUnauthorized?.();
    }
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      await tokenStorage.remove();
      onUnauthorized?.();
    }
    throw new Error(data.error || `HTTP error ${response.status}`);
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
    if (response.status === 401) {
      await tokenStorage.remove();
      onUnauthorized?.();
    }
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data as T;
}

async function del<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      await tokenStorage.remove();
      onUnauthorized?.();
    }
    throw new Error(data.error || `HTTP error ${response.status}`);
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
    onboardingCompleted: boolean;
  };
}

export interface MeResponse {
  user: {
    id: number;
    email: string;
    nickname?: string;
    provider: string;
    emailVerified: boolean;
    onboardingCompleted: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface Category {
  id: number;
  userId: number | null;
  type: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface TransactionCategory {
  id: number;
  userId: number | null;
  type: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'income' | 'expense';
  amount: string; // Prisma에서 Decimal 타입은 문자열로 반환됨
  categoryId: number | null;
  category: TransactionCategory | null;
  accountId: number | null;
  cardId: number | null;
  paymentMethod: string;
  memo: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
}

export interface TransactionSummary {
  [date: string]: { income: number; expense: number };
}

export interface TransactionSummaryResponse {
  summary: TransactionSummary;
}

export interface CreateTransactionData {
  type: 'income' | 'expense';
  amount: number;
  categoryId?: number;
  paymentMethod: 'cash' | 'account' | 'card';
  paymentSourceId?: number | null;
  memo?: string;
  date: string; // YYYY-MM-DD 형식
}

export interface CreateTransactionResponse {
  transaction: Transaction;
}

export interface DeleteTransactionResponse {
  message: string;
}

// ─── 자산 타입 ──────────────────────────────────────────────────

export interface Account {
  id: number;
  userId: number;
  bankName: string;
  alias: string | null;
  balance: string; // Prisma에서 Decimal 타입은 문자열로 반환됨
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: number;
  userId: number;
  cardCompany: string;
  alias: string | null;
  cardType: string;
  paymentDay: number | null;
  linkedAccountId: number | null;
  linkedAccount?: Account | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface CardsResponse {
  cards: Card[];
}

export interface CreateAccountData {
  bankName: string;
  alias?: string;
  balance?: number;
}

export interface UpdateAccountData {
  bankName?: string;
  alias?: string | null;
  balance?: number;
}

export interface CreateCardData {
  cardCompany: string;
  alias?: string;
  cardType?: string;
  paymentDay?: number;
  linkedAccountId?: number;
}

export interface UpdateCardData {
  cardCompany?: string;
  alias?: string | null;
  cardType?: string;
  paymentDay?: number | null;
  linkedAccountId?: number | null;
}

export interface AccountResponse {
  account: Account;
}

export interface CardResponse {
  card: Card;
}

export interface DeleteAssetResponse {
  message: string;
}

export interface AssetSummary {
  totalBalance: number;
  accountCount: number;
  cardCount: number;
  cashBalance: number;
}

export interface CashBalanceResponse {
  cashBalance: number;
}

export interface AssetSummaryResponse {
  summary: AssetSummary;
}

export interface HolidayItem {
  date: string;     // "YYYY-MM-DD"
  name: string;     // 공휴일 이름
  isHoliday: boolean;
}

export interface HolidaysResponse {
  holidays: HolidayItem[];
}

// ─── 예산 타입 ──────────────────────────────────────────────────

export interface Budget {
  id: number;
  userId: number;
  categoryId: number | null;
  category: Category | null;
  amount: string; // Prisma Decimal
  month: string; // YYYY-MM
  createdAt: string;
  updatedAt: string;
}

export interface BudgetsResponse {
  budgets: Budget[];
}

export interface CreateBudgetData {
  categoryId?: number;
  amount: number;
  month: string; // YYYY-MM
}

export interface UpdateBudgetData {
  amount: number;
}

export interface BudgetResponse {
  budget: Budget;
}

export interface DeleteBudgetResponse {
  message: string;
}

// ─── 카테고리 CRUD 타입 ──────────────────────────────────────────

export interface CreateCategoryData {
  type: 'income' | 'expense';
  name: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CategoryResponse {
  category: Category;
}

export interface DeleteCategoryResponse {
  message: string;
}

// ─── 거래 수정 타입 ──────────────────────────────────────────────

export interface UpdateTransactionData {
  type?: 'income' | 'expense';
  amount?: number;
  categoryId?: number;
  paymentMethod?: 'cash' | 'account' | 'card';
  paymentSourceId?: number | null;
  memo?: string;
  date?: string;
}

export interface UpdateTransactionResponse {
  transaction: Transaction;
}

// ─── 거래 통계 타입 ──────────────────────────────────────────────

export interface CategoryStats {
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  total: number;
  percentage: number;
}

export interface MonthlyStatsResponse {
  totalIncome: number;
  totalExpense: number;
  categories: CategoryStats[];
  dailyTrend: { date: string; income: number; expense: number }[];
}

export const api = {
  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    return post<AuthResponse>('/auth/google', {idToken});
  },

  getMe: async (): Promise<MeResponse> => {
    return get<MeResponse>('/auth/me');
  },

  updateProfile: async (nickname: string): Promise<MeResponse> => {
    return patch<MeResponse>('/auth/profile', {nickname});
  },

  // 카테고리 API
  getCategories: async (type?: string): Promise<CategoriesResponse> => {
    const query = type ? `?type=${type}` : '';
    return get<CategoriesResponse>(`/categories${query}`);
  },

  // 거래 API
  getTransactionSummary: async (month: string): Promise<TransactionSummaryResponse> => {
    return get<TransactionSummaryResponse>(`/transactions/summary?month=${month}`);
  },

  getTransactions: async (month: string): Promise<TransactionsResponse> => {
    return get<TransactionsResponse>(`/transactions?month=${month}`);
  },

  createTransaction: async (data: CreateTransactionData): Promise<CreateTransactionResponse> => {
    return post<CreateTransactionResponse>('/transactions', data, true);
  },

  deleteTransaction: async (id: number): Promise<DeleteTransactionResponse> => {
    return del<DeleteTransactionResponse>(`/transactions/${id}`);
  },

  // 자산 API - 계좌
  getAccounts: async (): Promise<AccountsResponse> => {
    return get<AccountsResponse>('/assets/accounts');
  },

  createAccount: async (data: CreateAccountData): Promise<AccountResponse> => {
    return post<AccountResponse>('/assets/accounts', data, true);
  },

  updateAccount: async (id: number, data: UpdateAccountData): Promise<AccountResponse> => {
    return patch<AccountResponse>(`/assets/accounts/${id}`, data);
  },

  deleteAccount: async (id: number): Promise<DeleteAssetResponse> => {
    return del<DeleteAssetResponse>(`/assets/accounts/${id}`);
  },

  // 자산 API - 카드
  getCards: async (): Promise<CardsResponse> => {
    return get<CardsResponse>('/assets/cards');
  },

  createCard: async (data: CreateCardData): Promise<CardResponse> => {
    return post<CardResponse>('/assets/cards', data, true);
  },

  updateCard: async (id: number, data: UpdateCardData): Promise<CardResponse> => {
    return patch<CardResponse>(`/assets/cards/${id}`, data);
  },

  deleteCard: async (id: number): Promise<DeleteAssetResponse> => {
    return del<DeleteAssetResponse>(`/assets/cards/${id}`);
  },

  // 자산 API - 요약
  getAssetSummary: async (): Promise<AssetSummaryResponse> => {
    return get<AssetSummaryResponse>('/assets/summary');
  },

  // 자산 API - 현금
  getCashBalance: async (): Promise<CashBalanceResponse> => {
    return get<CashBalanceResponse>('/assets/cash');
  },

  updateCashBalance: async (balance: number): Promise<CashBalanceResponse> => {
    return patch<CashBalanceResponse>('/assets/cash', {balance});
  },

  // 공휴일 API (대체공휴일 포함)
  getHolidays: async (year: number): Promise<HolidaysResponse> => {
    return get<HolidaysResponse>(`/holidays?year=${year}`);
  },

  // 예산 API
  getBudgets: async (month: string): Promise<BudgetsResponse> => {
    return get<BudgetsResponse>(`/budgets?month=${month}`);
  },

  createBudget: async (data: CreateBudgetData): Promise<BudgetResponse> => {
    return post<BudgetResponse>('/budgets', data, true);
  },

  updateBudget: async (id: number, data: UpdateBudgetData): Promise<BudgetResponse> => {
    return patch<BudgetResponse>(`/budgets/${id}`, data);
  },

  deleteBudget: async (id: number): Promise<DeleteBudgetResponse> => {
    return del<DeleteBudgetResponse>(`/budgets/${id}`);
  },

  // 카테고리 CRUD API
  createCategory: async (data: CreateCategoryData): Promise<CategoryResponse> => {
    return post<CategoryResponse>('/categories', data, true);
  },

  updateCategory: async (id: number, data: UpdateCategoryData): Promise<CategoryResponse> => {
    return patch<CategoryResponse>(`/categories/${id}`, data);
  },

  deleteCategory: async (id: number): Promise<DeleteCategoryResponse> => {
    return del<DeleteCategoryResponse>(`/categories/${id}`);
  },

  // 거래 수정 API
  updateTransaction: async (id: number, data: UpdateTransactionData): Promise<UpdateTransactionResponse> => {
    return patch<UpdateTransactionResponse>(`/transactions/${id}`, data);
  },
};
