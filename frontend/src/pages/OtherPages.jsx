import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/shell/Icon.jsx';
import { PageHeader } from '../components/dashboard/parts.jsx';

const initials = (u) => (u?.displayName || u?.email || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

function Field({ label, id, hint, children, className = '' }) {
    return (
        <div className={className}>
            <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">{label}</label>
            {children}
            {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
    );
}

function SaveBar({ loading }) {
    return (
        <div className="flex justify-end border-t border-slate-100 pt-5 dark:border-slate-800">
            <button type="submit" disabled={loading} className="btn-primary !px-8 disabled:opacity-60">{loading ? 'Saving…' : 'Save changes'}</button>
        </div>
    );
}

/** Name, role badge and (for students/recruiters) a completeness meter. */
function ProfileHeader({ user, filled, total }) {
    const pct = total ? Math.round((100 * filled) / total) : null;
    return (
        <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 font-display text-xl font-bold text-white">{initials(user)}</span>
            <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-bold text-slate-900 dark:text-white">{user.displayName}</p>
                <p className="truncate text-sm text-slate-500">{user.email} · <span className="capitalize">{user.role}</span></p>
            </div>
            {pct !== null && (
                <div className="w-full sm:w-56">
                    <div className="mb-1 flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>Profile completeness</span><span>{pct}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                </div>
            )}
        </div>
    );
}

function AdminProfileForm() {
    const { user, refreshUser } = useAuth();
    const [name, setName] = useState(user.displayName || '');
    const [loading, setLoading] = useState(false);

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);
        const id = toast.loading('Updating profile...');
        try {
            await api.update('users', user.uid, { displayName: name.trim() });
            await refreshUser();
            toast.success('Profile updated successfully!', { id });
        } catch { toast.error('Failed to update profile.', { id }); } finally { setLoading(false); }
    };

    return (
        <form onSubmit={save} className="card space-y-5 p-6">
            <Field label="Full name" id="displayName"><input id="displayName" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Email address" id="email" hint="Your login email cannot be changed here."><input id="email" type="email" className="input-field cursor-not-allowed opacity-70" value={user.email} disabled /></Field>
            <SaveBar loading={loading} />
        </form>
    );
}

function RecruiterProfileForm() {
    const { user, refreshUser } = useAuth();
    const [data, setData] = useState({ displayName: '', title: '', companyName: '', companyWebsite: '', aboutCompany: '', industry: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        setData({
            displayName: user.displayName || '', title: user.profile?.title || '', companyName: user.profile?.companyName || '',
            companyWebsite: user.profile?.companyWebsite || '', aboutCompany: user.profile?.aboutCompany || '', industry: user.profile?.industry || '',
        });
    }, [user]);

    const change = (e) => setData((p) => ({ ...p, [e.target.name]: e.target.value }));
    const filled = ['displayName', 'title', 'companyName', 'companyWebsite', 'aboutCompany', 'industry'].filter((k) => data[k]).length;

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);
        const id = toast.loading('Updating profile...');
        try {
            await api.update('users', user.uid, {
                displayName: data.displayName, 'profile.title': data.title, 'profile.companyName': data.companyName,
                'profile.companyWebsite': data.companyWebsite, 'profile.aboutCompany': data.aboutCompany, 'profile.industry': data.industry,
                isProfileComplete: !!(data.displayName && data.companyName && data.aboutCompany),
            });
            await refreshUser();
            toast.success('Profile updated successfully!', { id });
        } catch { toast.error('Failed to update profile.', { id }); } finally { setLoading(false); }
    };

    return (
        <>
            <ProfileHeader user={user} filled={filled} total={6} />
            <form onSubmit={save} className="card space-y-5 p-6">
                <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Your full name" id="displayName"><input id="displayName" name="displayName" className="input-field" value={data.displayName} onChange={change} /></Field>
                    <Field label="Your title / role" id="title"><input id="title" name="title" className="input-field" value={data.title} onChange={change} placeholder="e.g., HR Manager" /></Field>
                    <Field label="Company name" id="companyName"><input id="companyName" name="companyName" className="input-field" value={data.companyName} onChange={change} /></Field>
                    <Field label="Industry" id="industry"><input id="industry" name="industry" className="input-field" value={data.industry} onChange={change} placeholder="e.g., Information Technology" /></Field>
                </div>
                <Field label="Company website" id="companyWebsite"><input id="companyWebsite" name="companyWebsite" type="url" className="input-field" value={data.companyWebsite} onChange={change} placeholder="https://" /></Field>
                <Field label="About the company" id="aboutCompany"><textarea id="aboutCompany" name="aboutCompany" rows="4" className="input-field" value={data.aboutCompany} onChange={change} /></Field>
                <SaveBar loading={loading} />
            </form>
        </>
    );
}

function StudentProfileForm() {
    const { user, refreshUser } = useAuth();
    const [data, setData] = useState({ displayName: '', email: '', headline: '', location: '', bio: '', linkedinUrl: '', portfolioUrl: '', skills: [] });
    const [skill, setSkill] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        setData({
            displayName: user.displayName || '', email: user.email || '', headline: user.profile?.headline || '', location: user.profile?.location || '',
            bio: user.profile?.bio || '', linkedinUrl: user.profile?.linkedinUrl || '', portfolioUrl: user.profile?.portfolioUrl || '', skills: user.profile?.skills || [],
        });
    }, [user]);

    const change = (e) => setData((p) => ({ ...p, [e.target.name]: e.target.value }));
    const addSkill = (e) => {
        e.preventDefault();
        const s = skill.trim();
        if (!s) return;
        if (data.skills.some((x) => x.toLowerCase() === s.toLowerCase())) return toast.error('Skill already added.');
        setData((p) => ({ ...p, skills: [...p.skills, s] }));
        setSkill('');
    };
    const filled = [data.displayName, data.headline, data.location, data.bio, data.linkedinUrl, data.portfolioUrl].filter(Boolean).length + (data.skills.length >= 5 ? 1 : 0);

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);
        const id = toast.loading('Updating profile...');
        try {
            await api.update('users', user.uid, {
                displayName: data.displayName, 'profile.headline': data.headline, 'profile.location': data.location, 'profile.bio': data.bio,
                'profile.linkedinUrl': data.linkedinUrl, 'profile.portfolioUrl': data.portfolioUrl, 'profile.skills': data.skills,
                isProfileComplete: !!(data.displayName && data.headline && data.skills.length > 0),
            });
            await refreshUser();
            toast.success('Profile updated successfully!', { id });
        } catch { toast.error('Failed to update profile.', { id }); } finally { setLoading(false); }
    };

    return (
        <>
            <ProfileHeader user={user} filled={filled} total={7} />
            <form onSubmit={save} className="space-y-6">
                <section className="card space-y-5 p-6">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Basics</h2>
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Full name" id="displayName"><input id="displayName" name="displayName" className="input-field" value={data.displayName} onChange={change} /></Field>
                        <Field label="Headline" id="headline"><input id="headline" name="headline" className="input-field" value={data.headline} onChange={change} placeholder="e.g., Aspiring Software Engineer" /></Field>
                        <Field label="Email address" id="email"><input id="email" type="email" className="input-field cursor-not-allowed opacity-70" value={data.email} disabled /></Field>
                        <Field label="Location" id="location"><input id="location" name="location" className="input-field" value={data.location} onChange={change} placeholder="e.g., Mumbai, India" /></Field>
                    </div>
                    <Field label="About me" id="bio" hint="Two or three lines about what you build and what role you want."><textarea id="bio" name="bio" rows="4" className="input-field" value={data.bio} onChange={change} /></Field>
                </section>

                <section className="card space-y-4 p-6">
                    <div>
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Skills</h2>
                        <p className="text-xs text-slate-500">Add at least five. Job matching and the AI cover letter use these.</p>
                    </div>
                    <div className="flex gap-2">
                        <input id="skills" aria-label="Add a skill" className="input-field" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g., JavaScript"
                            onKeyDown={(e) => { if (e.key === 'Enter') addSkill(e); }} />
                        <button type="button" onClick={addSkill} className="btn-ghost shrink-0 !px-5">Add</button>
                    </div>
                    {data.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {data.skills.map((s) => (
                                <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                                    {s}
                                    <button type="button" aria-label={`Remove ${s}`} onClick={() => setData((p) => ({ ...p, skills: p.skills.filter((x) => x !== s) }))} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-800/50"><Icon name="x" className="h-3 w-3" /></button>
                                </span>
                            ))}
                        </div>
                    )}
                </section>

                <section className="card space-y-5 p-6">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Links</h2>
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="LinkedIn profile URL" id="linkedinUrl"><input id="linkedinUrl" name="linkedinUrl" type="url" className="input-field" value={data.linkedinUrl} onChange={change} placeholder="https://linkedin.com/in/..." /></Field>
                        <Field label="Portfolio / website URL" id="portfolioUrl"><input id="portfolioUrl" name="portfolioUrl" type="url" className="input-field" value={data.portfolioUrl} onChange={change} placeholder="https://" /></Field>
                    </div>
                    <SaveBar loading={loading} />
                </section>

                <p className="text-sm text-slate-500">Academic details (stream, CGPA, internships) are on the <Link to="/insights" className="font-bold text-brand-600 hover:underline dark:text-brand-300">Career insights</Link> page.</p>
            </form>
        </>
    );
}

export function ProfilePage() {
    const { user } = useAuth();
    return (
        <div className="mx-auto max-w-3xl">
            <PageHeader title="Your profile" subtitle="Keep this up to date: recruiters and the AI tools read it."
                action={<Link to="/security" className="btn-ghost !px-4 !py-2"><Icon name="lock" className="h-4 w-4" />Security &amp; privacy</Link>} />
            {user?.role === 'student' && <StudentProfileForm />}
            {user?.role === 'recruiter' && <RecruiterProfileForm />}
            {user?.role === 'admin' && <><ProfileHeader user={user} /><AdminProfileForm /></>}
        </div>
    );
}

export const NotFoundPage = () => (
    <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-display text-7xl font-bold bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">The page you are looking for does not exist or was moved.</p>
        <Link to="/" className="btn-primary mt-6">Go to home</Link>
    </div>
);
