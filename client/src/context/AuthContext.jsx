/**
 * AuthContext.jsx
 * Provides JWT authentication state, login/logout/register functions,
 * and token persistence via localStorage.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
            setToken(storedToken);
            fetchCurrentUser(storedToken);
        } else {
            setLoading(false);
        }
    }, []);

    // Fetch current user profile with token
    const fetchCurrentUser = async (authToken) => {
        try {
            const res = await fetch(`${API_BASE}/api/users/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                setToken(authToken);
            } else {
                // Token invalid/expired
                logout();
            }
        } catch (err) {
            console.error('Failed to fetch user:', err);
            logout();
        } finally {
            setLoading(false);
        }
    };

    // Login with email/password
    const login = async (email, password) => {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    // Register new user
    const register = async (email, password, name) => {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    // Logout
    const logout = () => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
    };

    // Update profile
    const updateProfile = async (updates) => {
        const res = await fetch(`${API_BASE}/api/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');
        setUser(data.user);
        return data.user;
    };

    // Upload avatar
    const uploadAvatar = async (file) => {
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await fetch(`${API_BASE}/api/users/me/avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Avatar upload failed');

        // Refresh user to get new avatar_url
        await fetchCurrentUser(token);
        return data.avatar_url;
    };

    // Helper for authenticated API calls
    const authFetch = useCallback(async (url, options = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
        return fetch(url.startsWith('http') ? url : `${API_BASE}${url}`, { ...options, headers });
    }, [token]);

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user && !!token,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        updateProfile,
        uploadAvatar,
        authFetch,
        refreshUser: () => token && fetchCurrentUser(token)
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
