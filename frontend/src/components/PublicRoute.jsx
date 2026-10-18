import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        // While we're checking the auth status, render a simple loading indicator
        // to prevent content flashing.
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (user) {
        // If the user is logged in, redirect them away from public pages (like login/register)
        // to their main dashboard.
        return <Navigate to="/dashboard" replace />;
    }

    // If the user is not logged in, show the requested page (e.g., the Login form).
    return children;
};

