'use client';

import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, isUnauthorizedError, tokenStorage } from '../lib/api';
import type { Account, AssetSummaryResponse, Card, Category, Transaction, TransactionSummary } from '../lib/types';

type TabKey = 'home' | 'add' | 'stats' | 'asset' | 'settings';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function parseAmount(amount: string): number {
  return Number(amount || '0');
}

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [email, setEmail] = useState('');

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [month, setMonth] = useState(formatMonth(new Date()));

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({});
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [assetSummary, setAssetSummary] = useState<AssetSummaryResponse['summary'] | null>(null);

  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategoryId, setTxCategoryId] = useState<number | null>(null);
  const [txPaymentMethod, setTxPaymentMethod] = useState<'cash' | 'account' | 'card'>('cash');
  const [txPaymentSourceId, setTxPaymentSourceId] = useState<number | null>(null);
  const [txMemo, setTxMemo] = useState('');
  const [txDate, setTxDate] = useState(formatDateInput(new Date()));

  const [onboardingAccountBankName, setOnboardingAccountBankName] = useState('');
  const [onboardingAccountAlias, setOnboardingAccountAlias] = useState('');
  const [onboardingAccountBalance, setOnboardingAccountBalance] = useState('');
  const [onboardingCardCompany, setOnboardingCardCompany] = useState('');
  const [onboardingCardAlias, setOnboardingCardAlias] = useState('');
  const [onboardingCardPaymentDay, setOnboardingCardPaymentDay] = useState('');

  const logout = useCallback(() => {
    tokenStorage.remove();
    setToken(null);
    setNeedsOnboarding(false);
    setEmail('');
    setNickname('');
    setTransactions([]);
    setSummary({});
  }, []);

  const loadMainData = useCallback(async (authToken: string, selectedMonth: string) => {
    const [summaryRes, txRes, accountRes, cardRes, assetRes, incomeCatsRes, expenseCatsRes] = await Promise.all([
      api.getTransactionSummary(authToken, selectedMonth),
      api.getTransactions(authToken, selectedMonth),
      api.getAccounts(authToken),
      api.getCards(authToken),
      api.getAssetSummary(authToken),
      api.getCategories(authToken, 'income'),
      api.getCategories(authToken, 'expense'),
    ]);

    setSummary(summaryRes.summary);
    setTransactions(txRes.transactions);
    setAccounts(accountRes.accounts);
    setCards(cardRes.cards);
    setAssetSummary(assetRes.summary);
    setIncomeCategories(incomeCatsRes.categories);
    setExpenseCategories(expenseCatsRes.categories);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const stored = tokenStorage.get();
    if (!stored) {
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const me = await api.getMe(stored);
      setToken(stored);
      setEmail(me.user.email);
      setNickname(me.user.nickname || '');
      setNeedsOnboarding(!me.user.onboardingCompleted);
      if (me.user.onboardingCompleted) {
        await loadMainData(stored, month);
      }
    } catch (e) {
      tokenStorage.remove();
      setToken(null);
      setError(e instanceof Error ? e.message : '인증 상태를 확인하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [loadMainData, month]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!token || needsOnboarding) {
      return;
    }
    void loadMainData(token, month).catch((e) => {
      if (isUnauthorizedError(e)) {
        logout();
        return;
      }
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.');
    });
  }, [month, token, needsOnboarding, loadMainData, logout]);

  const onGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError('Google 인증 토큰을 받지 못했습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const auth = await api.googleLogin(idToken);
      tokenStorage.save(auth.token);
      setToken(auth.token);
      setEmail(auth.user.email);
      setNickname(auth.user.nickname || '');
      setNeedsOnboarding(!auth.user.onboardingCompleted);
      if (auth.user.onboardingCompleted) {
        await loadMainData(auth.token, month);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google 로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitOnboarding = async () => {
    if (!token) {
      return;
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (trimmedNickname.length > 20) {
      setError('닉네임은 20자 이하로 입력해주세요.');
      return;
    }

    const hasAccountInput =
      onboardingAccountBankName.trim() || onboardingAccountAlias.trim() || onboardingAccountBalance.trim();
    const hasCardInput =
      onboardingCardCompany.trim() || onboardingCardAlias.trim() || onboardingCardPaymentDay.trim();

    if (hasAccountInput && !onboardingAccountBankName.trim()) {
      setError('계좌를 등록하려면 은행명을 입력해주세요.');
      return;
    }

    if (hasCardInput && !onboardingCardCompany.trim()) {
      setError('카드를 등록하려면 카드사를 입력해주세요.');
      return;
    }

    if (onboardingCardPaymentDay.trim()) {
      const day = Number(onboardingCardPaymentDay);
      if (Number.isNaN(day) || day < 1 || day > 31) {
        setError('카드 결제일은 1~31 사이 숫자여야 합니다.');
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    let createdAccountId: number | null = null;
    let createdCardId: number | null = null;

    try {
      if (hasAccountInput) {
        const accountRes = await api.createAccount(token, {
          bankName: onboardingAccountBankName.trim(),
          alias: onboardingAccountAlias.trim() || undefined,
          balance: onboardingAccountBalance ? Number(onboardingAccountBalance) : undefined,
        });
        createdAccountId = accountRes.account.id;
      }

      if (hasCardInput) {
        const cardRes = await api.createCard(token, {
          cardCompany: onboardingCardCompany.trim(),
          alias: onboardingCardAlias.trim() || undefined,
          cardType: 'credit',
          paymentDay: onboardingCardPaymentDay ? Number(onboardingCardPaymentDay) : undefined,
        });
        createdCardId = cardRes.card.id;
      }

      await api.updateProfile(token, trimmedNickname);
      setNeedsOnboarding(false);
      await loadMainData(token, month);
    } catch (e) {
      const rollbackTasks: Promise<unknown>[] = [];
      if (createdCardId !== null) {
        rollbackTasks.push(api.deleteCard(token, createdCardId));
      }
      if (createdAccountId !== null) {
        rollbackTasks.push(api.deleteAccount(token, createdAccountId));
      }
      if (rollbackTasks.length > 0) {
        await Promise.allSettled(rollbackTasks);
      }
      setError(e instanceof Error ? e.message : '온보딩 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + parseAmount(t.amount), 0),
    [transactions],
  );
  const totalExpense = useMemo(
    () => transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + parseAmount(t.amount), 0),
    [transactions],
  );

  const topExpenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense') {
        continue;
      }
      const key = tx.category?.name || '기타';
      map.set(key, (map.get(key) || 0) + parseAmount(tx.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  const submitTransaction = async () => {
    if (!token) {
      return;
    }
    if (!txAmount || Number(txAmount) <= 0) {
      setError('금액을 입력해주세요.');
      return;
    }
    if ((txPaymentMethod === 'account' || txPaymentMethod === 'card') && !txPaymentSourceId) {
      setError('계좌/카드 결제는 결제 수단을 선택해야 합니다.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await api.createTransaction(token, {
        type: txType,
        amount: Number(txAmount),
        categoryId: txCategoryId || undefined,
        paymentMethod: txPaymentMethod,
        paymentSourceId: txPaymentSourceId,
        memo: txMemo.trim() || undefined,
        date: txDate,
      });

      setTxAmount('');
      setTxMemo('');
      setTxCategoryId(null);
      setTxPaymentMethod('cash');
      setTxPaymentSourceId(null);
      setActiveTab('home');
      await loadMainData(token, month);
    } catch (e) {
      setError(e instanceof Error ? e.message : '거래를 저장하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeCategories = txType === 'income' ? incomeCategories : expenseCategories;
  const dailyRows = Object.entries(summary)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 10);

  if (isLoading && !token) {
    return <main className="center"><p>불러오는 중...</p></main>;
  }

  if (!token) {
    return (
      <main className="center">
        <section className="card auth">
          <h1>Leaky</h1>
          <p>Google 계정으로 로그인해서 웹에서도 동일하게 사용하세요.</p>
          {!GOOGLE_CLIENT_ID ? (
            <p className="error">NEXT_PUBLIC_GOOGLE_CLIENT_ID 설정이 필요합니다.</p>
          ) : (
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleLogin onSuccess={onGoogleSuccess} onError={() => setError('Google 로그인에 실패했습니다.')} />
            </GoogleOAuthProvider>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (needsOnboarding) {
    return (
      <main className="center">
        <section className="card onboarding">
          <h2>시작하기 전 1분 설정</h2>
          <p>닉네임은 필수, 계좌/카드는 선택 입력입니다.</p>
          <label>닉네임</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />

          <h3>선택: 계좌</h3>
          <label>은행명</label>
          <input value={onboardingAccountBankName} onChange={(e) => setOnboardingAccountBankName(e.target.value)} />
          <label>별칭</label>
          <input value={onboardingAccountAlias} onChange={(e) => setOnboardingAccountAlias(e.target.value)} />
          <label>현재 잔액</label>
          <input
            value={onboardingAccountBalance}
            onChange={(e) => setOnboardingAccountBalance(e.target.value.replace(/[^0-9]/g, ''))}
          />

          <h3>선택: 카드</h3>
          <label>카드사</label>
          <input value={onboardingCardCompany} onChange={(e) => setOnboardingCardCompany(e.target.value)} />
          <label>별칭</label>
          <input value={onboardingCardAlias} onChange={(e) => setOnboardingCardAlias(e.target.value)} />
          <label>결제일 (1~31)</label>
          <input
            value={onboardingCardPaymentDay}
            onChange={(e) => setOnboardingCardPaymentDay(e.target.value.replace(/[^0-9]/g, ''))}
          />

          <button type="button" onClick={() => void submitOnboarding()} disabled={isLoading}>
            {isLoading ? '저장 중...' : '완료하고 시작하기'}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-wrap">
      <header className="topbar">
        <div>
          <h1>Leaky</h1>
          <p>{month} 가계 흐름</p>
        </div>
        <div className="month-picker">
          <label htmlFor="month">월</label>
          <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </header>

      <nav className="tabs">
        {(['home', 'add', 'stats', 'asset', 'settings'] as TabKey[]).map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {error && <p className="error inline">{error}</p>}

      {activeTab === 'home' && (
        <section className="grid two">
          <article className="card">
            <h2>이번 달 요약</h2>
            <p>수입 {formatCurrency(totalIncome)}원</p>
            <p>지출 {formatCurrency(totalExpense)}원</p>
            <p>순이익 {formatCurrency(totalIncome - totalExpense)}원</p>
          </article>
          <article className="card">
            <h2>일별 흐름 (최근 10일)</h2>
            {dailyRows.length === 0 ? <p>데이터가 없습니다.</p> : dailyRows.map(([date, s]) => <p key={date}>{date} · +{formatCurrency(s.income)} / -{formatCurrency(s.expense)}</p>)}
          </article>
          <article className="card full">
            <h2>최근 거래</h2>
            {transactions.slice(0, 12).map((tx) => (
              <p key={tx.id}>
                {tx.date.split('T')[0]} · {tx.category?.name || '기타'} · {tx.type === 'income' ? '+' : '-'}
                {formatCurrency(parseAmount(tx.amount))}
              </p>
            ))}
          </article>
        </section>
      )}

      {activeTab === 'add' && (
        <section className="card add-form">
          <h2>거래 추가</h2>
          <div className="grid two">
            <div>
              <label>유형</label>
              <select value={txType} onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}>
                <option value="expense">지출</option>
                <option value="income">수입</option>
              </select>
            </div>
            <div>
              <label>금액</label>
              <input value={txAmount} onChange={(e) => setTxAmount(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <div>
              <label>카테고리</label>
              <select value={txCategoryId || ''} onChange={(e) => setTxCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">선택 안 함</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>날짜</label>
              <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            </div>
            <div>
              <label>결제 수단</label>
              <select value={txPaymentMethod} onChange={(e) => setTxPaymentMethod(e.target.value as 'cash' | 'account' | 'card')}>
                <option value="cash">현금</option>
                <option value="account">계좌</option>
                <option value="card">카드</option>
              </select>
            </div>
            <div>
              <label>{txPaymentMethod === 'account' ? '계좌' : txPaymentMethod === 'card' ? '카드' : '결제 수단 상세'}</label>
              <select
                value={txPaymentSourceId || ''}
                onChange={(e) => setTxPaymentSourceId(e.target.value ? Number(e.target.value) : null)}
                disabled={txPaymentMethod === 'cash'}>
                <option value="">선택 안 함</option>
                {txPaymentMethod === 'account' && accounts.map((a) => <option key={a.id} value={a.id}>{a.alias || a.bankName}</option>)}
                {txPaymentMethod === 'card' && cards.map((c) => <option key={c.id} value={c.id}>{c.alias || c.cardCompany}</option>)}
              </select>
            </div>
          </div>
          <label>메모</label>
          <input value={txMemo} onChange={(e) => setTxMemo(e.target.value)} />
          <button type="button" onClick={() => void submitTransaction()} disabled={isLoading}>{isLoading ? '저장 중...' : '저장'}</button>
        </section>
      )}

      {activeTab === 'stats' && (
        <section className="grid two">
          <article className="card">
            <h2>통계</h2>
            <p>총 수입: {formatCurrency(totalIncome)}원</p>
            <p>총 지출: {formatCurrency(totalExpense)}원</p>
            <p>저축률: {totalIncome > 0 ? `${Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100))}%` : '0%'}</p>
          </article>
          <article className="card">
            <h2>지출 상위 카테고리</h2>
            {topExpenseCategories.length === 0 ? <p>데이터가 없습니다.</p> : topExpenseCategories.map(([name, amount]) => <p key={name}>{name} · {formatCurrency(amount)}원</p>)}
          </article>
        </section>
      )}

      {activeTab === 'asset' && (
        <section className="grid two">
          <article className="card">
            <h2>자산 요약</h2>
            <p>총 잔액: {formatCurrency(assetSummary?.totalBalance || 0)}원</p>
            <p>계좌 수: {assetSummary?.accountCount || 0}</p>
            <p>카드 수: {assetSummary?.cardCount || 0}</p>
          </article>
          <article className="card">
            <h2>계좌</h2>
            {accounts.length === 0 ? <p>등록된 계좌가 없습니다.</p> : accounts.map((a) => <p key={a.id}>{a.alias || a.bankName} · {formatCurrency(parseAmount(a.balance))}원</p>)}
          </article>
          <article className="card full">
            <h2>카드</h2>
            {cards.length === 0 ? <p>등록된 카드가 없습니다.</p> : cards.map((c) => <p key={c.id}>{c.alias || c.cardCompany} · {c.cardType} {c.paymentDay ? `(결제일 ${c.paymentDay})` : ''}</p>)}
          </article>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="card">
          <h2>설정</h2>
          <p>이메일: {email}</p>
          <p>닉네임: {nickname || '미설정'}</p>
          <button type="button" onClick={logout}>로그아웃</button>
        </section>
      )}
    </main>
  );
}
