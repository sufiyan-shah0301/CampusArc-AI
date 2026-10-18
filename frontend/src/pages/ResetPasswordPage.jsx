import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import AuthLayout, { PasswordField } from '../components/AuthLayout';

export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) return toast.error('Passwords do not match.');
        setLoading(true);
        const toastId = toast.loading('Updating password...');
        try {
            await api.post('/api/auth/reset-password', { token, password });
            toast.success('Password updated. Please log in.', { id: toastId });
            navigate('/login');
        } catch (error) {
            toast.error(error.message || 'Could not reset the password.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <AuthLayout title="Reset password" subtitle="This reset link is incomplete.">
                <Link to="/forgot-password" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-300">Request a new link</Link>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Choose a new password" subtitle="Use at least 8 characters.">
            <form onSubmit={handleSubmit} className="space-y-5">
                <PasswordField label="New password" id="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
                <PasswordField label="Confirm password" id="confirm" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                <button disabled={loading} type="submit" className="btn-primary w-full disabled:opacity-60">{loading ? 'Saving…' : 'Update password'}</button>
            </form>
        </AuthLayout>
    );
}