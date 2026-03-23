import { createContext, useContext, useState } from 'react';
import API from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('ssnc_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const [role, setRole] = useState(() => localStorage.getItem('ssnc_role'));
    const [token, setToken] = useState(() => localStorage.getItem('ssnc_token'));

    const login = async (endpoint, credentials) => {
        const res = await API.post(endpoint, credentials);
        const { token: t, role: r, user: u } = res.data;
        localStorage.setItem('ssnc_token', t);
        localStorage.setItem('ssnc_role', r);
        localStorage.setItem('ssnc_user', JSON.stringify(u));
        setToken(t);
        setRole(r);
        setUser(u);
        return { role: r };
    };

    const logout = () => {
        localStorage.removeItem('ssnc_token');
        localStorage.removeItem('ssnc_role');
        localStorage.removeItem('ssnc_user');
        setToken(null);
        setRole(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, role, token, login, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
