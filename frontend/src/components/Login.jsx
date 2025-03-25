import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthProvider';

const Login = () => {
  const [staffId, setStaffId] = useState(''); 
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleLogin = () => {
    if (!staffId || !password) {
      setErrorMessage('Please fill out all fields.');
      return;
    }

    fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, password }), 
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.access_token) {
          login(data.access_token, data.role);

          if (data.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/profile');
          }
          
          setErrorMessage('');
        } else {
          setErrorMessage('Invalid login credentials.');
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorMessage('An error occurred. Please try again.');
      });
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>Login</h1>
        {errorMessage && <p className="error-message">{errorMessage}</p>} 
        <input
          type="text"
          placeholder="Staff ID"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value.toUpperCase())}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Login</button>
      </div>
    </div>
  );
};

export default Login;
