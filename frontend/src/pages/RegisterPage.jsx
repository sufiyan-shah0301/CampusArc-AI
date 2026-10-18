import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import AuthLayout, { Field, PasswordField } from '../components/AuthLayout';

export default function RegisterPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('student');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { register } = useAuth();

    const handleEmailSubmit = async (e) => {
        e.preventDefault();

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match!");
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Creating account...');
        try {
            await register({ displayName: fullName.trim(), email: email.trim(), password, role });
            toast.success('Account created successfully!', { id: toastId });
            navigate('/dashboard');
        } catch (error) {
            const errorMessage = error.status === 409
                ? 'This email is already in use.'
                : error.status === 422 ? (error.message || 'Please check your details.') : 'Failed to create an account. Please try again.';
            toast.error(errorMessage, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const roleCard = (value, name, desc) => (
        <label className={`cursor-pointer rounded-xl border-2 px-2 py-2 text-center transition ${role === value ? 'border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-900/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
            <input type="radio" name="role" value={value} className="sr-only" onChange={(e) => setRole(e.target.value)} checked={role === value} />
            <span className="block text-sm font-extrabold text-slate-900 dark:text-white">{name}</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
        </label>
    );

    return (
        <AuthLayout title="Create your account" subtitle="Find your next opportunity or the perfect candidate.">
            <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                    <span className="mb-1 block text-[13px] font-bold text-slate-700 dark:text-slate-200">I am a</span>
                    <div className="grid grid-cols-2 gap-2">
                        {roleCard('student', 'Student', 'Jobs, training and AI tools.')}
                        {roleCard('recruiter', 'Recruiter', 'Hire verified talent.')}
                    </div>
                </div>
                <Field label="Full name" id="fullName" type="text" autoComplete="name" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                <Field label="Email address" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2"><PasswordField label="Password" id="password" autoComplete="new-password" placeholder="Min. 8 chars" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <PasswordField label="Confirm" id="confirmPassword" autoComplete="new-password" placeholder="Repeat it" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} /></div>
                <button disabled={loading} className="btn-primary w-full disabled:opacity-60" type="submit">{loading ? 'Creating account…' : 'Create account'}</button>
            </form>
            <p className="mt-5 text-center text-[13px] text-slate-600 dark:text-slate-300">
                Already have an account? <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-300">Log in</Link>
            </p>
        </AuthLayout>
    );
}