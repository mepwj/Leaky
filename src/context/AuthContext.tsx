import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {tokenStorage, setOnUnauthorized, api} from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean | null;
  needsOnboarding: boolean;
  userNickname: string | null;
  signIn: (token: string, onboardingCompleted?: boolean, nickname?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: null,
  needsOnboarding: false,
  userNickname: null,
  signIn: async () => {},
  signOut: async () => {},
  completeOnboarding: () => {},
});

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [userNickname, setUserNickname] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStorage.get();
        if (token) {
          // 토큰 존재 - 서버에서 온보딩 상태 확인
          try {
            const {user} = await api.getMe();
            setNeedsOnboarding(!user.onboardingCompleted);
            setUserNickname(user.nickname || null);
            setIsAuthenticated(true);
          } catch {
            // 토큰 유효하지 않음 - 제거
            await tokenStorage.remove();
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (token: string, onboardingCompleted?: boolean, nickname?: string | null) => {
    await tokenStorage.save(token);
    setNeedsOnboarding(!onboardingCompleted);
    setUserNickname(nickname || null);
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(async () => {
    await tokenStorage.remove();
    setIsAuthenticated(false);
    setNeedsOnboarding(false);
  }, []);

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => signOut());
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{isAuthenticated, needsOnboarding, userNickname, signIn, signOut, completeOnboarding}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
