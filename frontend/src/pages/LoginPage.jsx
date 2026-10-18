import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';
import AuthLayout, { Field, PasswordField } from '../components/AuthLayout.jsx';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { login, verifyMfa } = useAuth();
    const [mfaToken, setMfaToken] = useState(null);
    const [code, setCode] = useState('');

    const handleMfaSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await verifyMfa(mfaToken, code.trim());
            toast.success('Signed in successfully!');
            navigate('/dashboard');
        } catch (error) {
            toast.error(error.status === 429 ? 'Too many wrong codes. Wait a few minutes.' : error.status === 401 && /expired/i.test(error.message) ? 'This sign-in expired. Please log in again.' : 'That code is not valid.');
            if (/expired/i.test(error.message)) setMfaToken(null);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading('Signing in...');
        try {
            const res = await login(email.trim(), password);
            if (res.mfaRequired) {
                toast.dismiss(toastId);
                setMfaToken(res.mfaToken);
                return;
            }
            toast.success('Signed in successfully!', { id: toastId });
            navigate('/dashboard');
        } catch (error) {
            toast.error(error.status === 429 ? 'Too many attempts. Please wait a minute.' : 'Invalid email or password.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    if (mfaToken) {
        return (
            <AuthLayout title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app, or a recovery code.">
                <form onSubmit={handleMfaSubmit} className="space-y-4">
                    <input autoFocus required inputMode="text" autoComplete="one-time-code" aria-label="Authentication code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={16}
                        className="input-field text-center text-xl tracking-widest" placeholder="123456" />
                    <button disabled={loading} className="btn-primary w-full disabled:opacity-60" type="submit">{loading ? 'Verifying…' : 'Verify and sign in'}</button>
                    <button type="button" onClick={() => { setMfaToken(null); setCode(''); }} className="w-full text-sm font-semibold text-slate-500 hover:text-brand-600">Back to login</button>
                </form>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Welcome back" subtitle="Log in to continue to your dashboard.">
            <form onSubmit={handleEmailSubmit} className="space-y-4">
                <Field label="Email address" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <PasswordField label="Password" id="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    right={<Link className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-300" to="/forgot-password">Forgot password?</Link>} />
                <button disabled={loading} className="btn-primary w-full disabled:opacity-60" type="submit">{loading ? 'Signing in…' : 'Log in'}</button>
            </form>
            <p className="mt-5 text-center text-[13px] text-slate-600 dark:text-slate-300">
                New to CampusArc? <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-300">Create an account</Link>
            </p>
        </AuthLayout>
    );
}