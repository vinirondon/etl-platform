import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('etl_token');
    const stored = localStorage.getItem('etl_user');          
    if (token && stored) {
      setUser(JSON.parse(stored));
      authAPI.me().then(r => setUser(r.data.user)).catch(() => {
        localStorage.removeItem('etl_token');
        localStorage.removeItem('etl_user');
        setUser(null);
      }).finally(() => setLoading(false));               
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem('etl_token', res.data.token);
    localStorage.setItem('etl_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('etl_token');
    localStorage.removeItem('etl_user');
    setUser(null);
  };

  const canDo = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canDo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
