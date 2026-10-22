import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import apiClient, {
  getStoredToken,
  setStoredTokens,
  clearStoredTokens,
} from '../services/apiClient.js';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('egsa_user') || localStorage.getItem('esa_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => getStoredToken());
  const [refreshToken, setRefreshToken] = useState(
    () => localStorage.getItem('egsa_refresh_token') || localStorage.getItem('egsa_refresh')
  );

  const [isLoading, setIsLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  // Language & Direction (en / ar)
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('egsa_lang') || 'en';
  });

  const setLanguage = useCallback((lang) => {
    const valid = lang === 'ar' ? 'ar' : 'en';
    setLanguageState(valid);
    localStorage.setItem('egsa_lang', valid);
    document.documentElement.dir = valid === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = valid;
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Sync profile on startup
  const reloadUser = useCallback(async () => {
    try {
      const res = await authService.getMe();
      const userData = res?.user || res?.data?.user || res;
      if (userData && (userData.id || userData._id)) {
        setUser(userData);
        localStorage.setItem('egsa_user', JSON.stringify(userData));
        localStorage.setItem('esa_user', JSON.stringify(userData));
        return userData;
      }
    } catch {
      // Ignore if session is invalid
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (token) {
      reloadUser().finally(() => {
        if (active) setBooting(false);
      });
    } else {
      setBooting(false);
    }

    const handleAuthExpired = () => {
      clearStoredTokens();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    };

    window.addEventListener('egsa_auth_expired', handleAuthExpired);
    window.addEventListener('egsa:unauthorized', handleAuthExpired);

    return () => {
      active = false;
      window.removeEventListener('egsa_auth_expired', handleAuthExpired);
      window.removeEventListener('egsa:unauthorized', handleAuthExpired);
    };
  }, [reloadUser]);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      setUser(res.user);
      setAccessToken(res.token);
      setRefreshToken(res.refreshToken);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setIsLoading(true);
    try {
      const res = await authService.register(payload);
      return res;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Continue cleanup
    } finally {
      clearStoredTokens();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, []);

  const role = user?.role?.toLowerCase() || '';
  const isStudent = role === 'student';
  const isInstructor = role === 'instructor';
  const isAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'pre_university_admin' ||
    role === 'university_admin' ||
    role.includes('admin');

  const value = useMemo(
    () => ({
      user,
      setUser,
      token: accessToken,
      accessToken,
      refreshToken,
      isAuthenticated: !!user && !!accessToken,
      isLoading,
      booting,
      language,
      lang: language,
      isRTL: language === 'ar',
      setLanguage,
      setLang: setLanguage,
      toggleLanguage,
      login,
      register,
      logout,
      reloadUser,
      role,
      isStudent,
      isInstructor,
      isAdmin,
    }),
    [
      user,
      accessToken,
      refreshToken,
      isLoading,
      booting,
      language,
      setLanguage,
      toggleLanguage,
      login,
      register,
      logout,
      reloadUser,
      role,
      isStudent,
      isInstructor,
      isAdmin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
