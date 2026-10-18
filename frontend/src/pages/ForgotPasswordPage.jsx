import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import AuthLayout, { Field } from '../components/AuthLayout';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading('Sending reset email...');
        try {
            await api.post('/api/auth/forgot-password', { email: email.trim() });
            toast.success('If that email is registered, a reset link has been sent.', { id: toastId, duration: 5000 });
        } catch (error) {
            toast.error('Failed to send reset email. Please check the address and try again.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Forgot password?" subtitle="Enter your email and we will send you a reset link.">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email address" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <button disabled={loading} className="btn-primary w-full disabled:opacity-60" type="submit">{loading ? 'Sending…' : 'Send reset link'}</button>
            </form>
            <p className="mt-5 text-center text-[13px] text-slate-600 dark:text-slate-300">
                Remembered it? <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-300">Back to log in</Link>
            </p>
        </AuthLayout>
    );
}