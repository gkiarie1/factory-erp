import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(
    sessionStorage.getItem('factory_role') || '',
  );
  const [token, setToken] = useState(
    sessionStorage.getItem('factory_token') || '',
  );
  const clearSession = useCallback(() => {
    sessionStorage.removeItem('factory_token');
    sessionStorage.removeItem('factory_role');
    setRole('');
    setToken('');
  }, []);
  useEffect(() => {
    // Discard the previous implementation's long-lived browser tokens.
    [
      'factory_token',
      'factory_role',
      'admin_token',
      'employee_token',
      'admin_role',
      'employee_role',
    ].forEach((key) => localStorage.removeItem(key));
    window.addEventListener('session-expired', clearSession);
    return () => window.removeEventListener('session-expired', clearSession);
  }, [clearSession]);
  useEffect(() => {
    if (!token) return;
    let expires;
    try {
      expires =
        JSON.parse(
          atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        ).exp * 1000;
    } catch {
      clearSession();
      return;
    }
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      clearSession();
      return;
    }
    const timer = setTimeout(clearSession, expires - Date.now());
    return () => clearTimeout(timer);
  }, [token, clearSession]);
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }
  function login(value, nextRole) {
    sessionStorage.setItem('factory_token', value);
    sessionStorage.setItem('factory_role', nextRole);
    setToken(value);
    setRole(nextRole);
  }
  return (
    <AuthContext.Provider
      value={{
        role,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function RequireAuth({ children, adminOnly }) {
  const { isAuthenticated, role } = useContext(AuthContext);
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (adminOnly && role !== 'admin') return <Navigate to="/profile" replace />;
  if (!adminOnly && role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}
