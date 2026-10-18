import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api, tokens, closeRealtime } from '../lib/api';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        const me = await api.get('/api/auth/me');
        setUser(me);
        return me;
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (tokens.access() || tokens.refresh()) {
                try { const me = await api.get('/api/auth/me'); if (alive) setUser(me); }
                catch { tokens.clear(); }
            }
            if (alive) setLoading(false);
        })();
        const onLogout = () => { setUser(null); closeRealtime(); };
        window.addEventListener('cb:logout', onLogout);
        return () => { alive = false; window.removeEventListener('cb:logout', onLogout); };
    }, []);

    const applySession = (session) => {
        tokens.set(session.accessToken, session.refreshToken);
        setUser(session.user);
        return session.user;
    };

    // returns the user, or { mfaRequired, mfaToken } when the account has two-factor authentication on
    const login = useCallback(async (email, password) => {
        const res = await api.post('/api/auth/login', { email, password });
        return res.mfaRequired ? res : applySession(res);
    }, []);
    const verifyMfa = useCallback(async (mfaToken, code) => applySession(await api.post('/api/auth/mfa/verify', { mfaToken, code })), []);
    const register = useCallback(async (data) => applySession(await api.post('/api/auth/register', data)), []);
    const logout = useCallback(() => { tokens.clear(); closeRealtime(); setUser(null); }, []);

    // Memoised so consumers only re-render when the user or loading state really changes.
    const value = useMemo(() => ({ user, loading, login, verifyMfa, register, logout, refreshUser, setUser }),
        [user, loading, login, verifyMfa, register, logout, refreshUser]);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
