import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { NotFoundPage } from '../pages/OtherPages.jsx';

export default function AdminRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="text-center p-10">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    // This check ensures non-admins see a 404, hiding the admin area's existence.
    if (user.role !== 'admin') {
        return <NotFoundPage />;
    }

    return children;
};

