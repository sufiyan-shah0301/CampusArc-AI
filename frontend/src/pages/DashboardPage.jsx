import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import StudentDashboard from './StudentDashboard.jsx';
import RecruiterDashboard from './RecruiterDashboard.jsx';

/** Sends each role to its own dashboard. */
export default function DashboardPage() {
    const { user, loading } = useAuth();

    if (loading) return <div className="p-10 text-center text-slate-500">Loading...</div>;
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'student') return <StudentDashboard />;
    if (user?.role === 'recruiter') return <RecruiterDashboard />;
    return <Navigate to="/login" />;
}
