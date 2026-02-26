export interface AuthUser {
  id: number;
  email: string;
  nickname?: string;
  provider: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
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
  amount: string;
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

export interface Account {
  id: number;
  userId: number;
  bankName: string;
  alias: string | null;
  balance: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface CardsResponse {
  cards: Card[];
}

export interface AssetSummaryResponse {
  summary: {
    totalBalance: number;
    accountCount: number;
    cardCount: number;
  };
}

export interface Budget {
  id: number;
  userId: number;
  categoryId: number | null;
  amount: string;
  month: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetsResponse {
  budgets: Budget[];
}
