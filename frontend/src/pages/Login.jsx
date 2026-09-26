import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export const Login = () => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('admin@inventory.local');
  const [password, setPassword] = useState('Password@123');
  const [role, setRole] = useState('SALES');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/enquiries" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, role);
      }
      navigate('/enquiries');
    } catch (err) {
      const fieldErrors = err.details?.fieldErrors;
      const validationMessage = fieldErrors
        ? Object.entries(fieldErrors)
          .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
          .join(', ')
        : err.message;
      setError(validationMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 80 }}>
      <div className="card">
        <h2 style={{ marginBottom: 20 }}>
          Inventory System — {mode === 'login' ? 'Login' : 'Create account'}
        </h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password" minLength={mode === 'register' ? 8 : 1} value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {mode === 'register' && (
            <div className="form-row">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="SALES">Sales</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          className="secondary"
          style={{ marginTop: 12, width: '100%' }}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
            setEmail('');
            setPassword('');
          }}
        >
          {mode === 'login' ? 'Create a new account' : 'Back to login'}
        </button>
      </div>
    </div>
  );
};