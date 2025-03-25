import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('admin_token') || !!localStorage.getItem('employee_token')
  );
  const [role, setRole] = useState(localStorage.getItem('admin_role') || localStorage.getItem('employee_role') || '');

  const login = (token, role) => {
    if (role === 'admin') {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_role', role);
    } else {
      localStorage.setItem('employee_token', token);
      localStorage.setItem('employee_role', role);
    }
    setIsAuthenticated(true);
    setRole(role);
  };

  const logout = () => {
    if (role === 'admin') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
    } else {
      localStorage.removeItem('employee_token');
      localStorage.removeItem('employee_role');
    }
    setIsAuthenticated(false);
    setRole('');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const RequireAuth = ({ children, adminOnly = false }) => {
  const { isAuthenticated, role } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
    if (adminOnly && role !== 'admin') {
      navigate('/unauthorized'); 
    }
  }, [isAuthenticated, role, adminOnly, navigate]);

  if (!isAuthenticated || (adminOnly && role !== 'admin')) {
    return null; // Prevent rendering until redirection happens
  }

  return children;
};
