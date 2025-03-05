import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  const login = (token, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    console.log(token, role);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const RequireAuth = ({ children, adminOnly = false }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
    if (adminOnly && role !== 'admin') {
      navigate('/unauthorized'); 
    }
  }, [isAuthenticated, role, adminOnly, navigate]);

  if (!isAuthenticated || (adminOnly && role !== 'admin')) {
    return null; // Render nothing until the navigation is complete
  }

  return children;
};
