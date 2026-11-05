import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import EmployeeProfile from './components/EmployeeProfile';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { AuthProvider, RequireAuth } from './components/AuthProvider';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/forgot-password"
            element={<Login key="forgot" mode="forgot" />}
          />
          <Route
            path="/reset-password"
            element={<Login key="reset" mode="reset" />}
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <EmployeeProfile />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth adminOnly={true}>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
