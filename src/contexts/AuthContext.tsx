import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, usersApi } from '@/lib/api';

export type UserRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string | null;
  major: string | null;
  year: string | null;
  avatar: string | null;
  reputation: number;
  role: UserRole;
  onboardingCompleted: boolean;
  needsCourseEnrollment?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  completeOnboarding: (name: string, major: string, year: string, courseId: string) => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const defaultUserFields = {
  major: null,
  year: null,
  avatar: null,
  reputation: 0,
  role: 'STUDENT' as UserRole,
  createdAt: new Date().toISOString(),
};

const normalizeRole = (value: unknown): UserRole =>
  value === 'ADMIN' || value === 'FACULTY' ? value : 'STUDENT';

const normalizeAuthUser = (apiUser: Record<string, unknown>): User => ({
  id: String(apiUser.id),
  email: String(apiUser.email ?? ''),
  name: (apiUser.name as string | null) ?? null,
  major: (apiUser.major as string | null) ?? null,
  year: (apiUser.year as string | null) ?? null,
  avatar: (apiUser.avatar as string | null) ?? null,
  reputation: Number(apiUser.reputation ?? 0),
  role: normalizeRole(apiUser.role),
  onboardingCompleted: Boolean(apiUser.onboardingCompleted),
  needsCourseEnrollment: Boolean(apiUser.needsCourseEnrollment),
  createdAt: String(apiUser.createdAt ?? new Date().toISOString()),
});

const loadSessionUser = async (): Promise<User> => {
  try {
    return await usersApi.getCurrentUser();
  } catch {
    const response = await authApi.verify();
    return normalizeAuthUser({ ...defaultUserFields, ...response.user });
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const sessionUser = await loadSessionUser();
          setUser(sessionUser);
          setToken(savedToken);
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(normalizeAuthUser({ ...defaultUserFields, ...response.user }));
  };

  const register = async (email: string, password: string) => {
    const response = await authApi.register(email, password);
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(normalizeAuthUser({ ...defaultUserFields, ...response.user }));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const completeOnboarding = async (name: string, major: string, year: string, courseId: string) => {
    const updatedUser = await usersApi.completeOnboarding(name, major, year, courseId);
    setUser(updatedUser);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const sessionUser = await loadSessionUser();
        setUser(sessionUser);
      } catch (error) {
        console.error('Failed to refresh user:', error);
      }
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    completeOnboarding,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
