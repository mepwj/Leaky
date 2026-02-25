import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {tokenStorage} from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await tokenStorage.get();
        setIsAuthenticated(!!token);
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (token: string) => {
    await tokenStorage.save(token);
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(async () => {
    await tokenStorage.remove();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{isAuthenticated, signIn, signOut}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
