import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import useLive from '../hooks/useLive.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Icon from '../components/shell/Icon.jsx';
import { Avatar, Chips, Empty, PageHeader, SearchBox } from '../components/dashboard/parts.jsx';

const TYPES = ['All', 'Full-time', 'Part-time', 'Internship'];
const ago = (ts) => {
    if (!ts?.toMillis) return '';
    const d = Math.floor((Date.now() - ts.toMillis()) / 86400000);
    return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : ts.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function ViewJobsPage() {
    const { user } = useAuth();
    const [jobs, setJobs] = useState(null);
    const [recs, setRecs] = useState(null);
    const [applied, setApplied] = useState(new Set());
    const [q, setQ] = useState('');
    const [jobType, setJobType] = useState('All');
    const [family, setFamily] = useState('All');

    useLive(async () => {
        try { setJobs(await api.list('jobs', { isOpen: true })); } catch (e) { console.error('Error fetching jobs:', e); setJobs((j) => j || []); }
    }, 'jobs');

    useEffect(() => {
        if (user?.role !== 'student') return;
        api.get('/api/ai/recommendations').then(setRecs).catch(() => setRecs(null));
        api.list('applications').then((a) => setApplied(new Set(a.map((x) => x.jobId)))).catch(() => {});
    }, [user?.uid, user?.role]);

    const families = useMemo(() => [...new Set((jobs || []).map((j) => j.family).filter(Boolean))].sort(), [jobs]);
    const shown = (jobs || []).filter((j) => {
        if (jobType !== 'All' && j.jobType !== jobType) return false;
        if (family !== 'All' && j.family !== family) return false;
        const s = q.toLowerCase();
        return !s || j.jobTitle.toLowerCase().includes(s) || j.companyName.toLowerCase().includes(s) || (j.skills || []).some((k) => k.toLowerCase().includes(s));
    });

    return (
        <div>
            <PageHeader title="Browse jobs" subtitle="Fraud-screened openings from verified recruiters."
                action={user?.role === 'student' && <Link to="/my-applications" className="btn-ghost !px-4 !py-2">My applications</Link>} />

            {recs?.jobs?.length > 0 && (
                <section className="mb-7">
                    <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white"><Icon name="sparkle" className="h-4 w-4 text-brand-600" />Recommended for you</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {recs.jobs.slice(0, 3).map((j) => (
                            <Link key={j.id} to={`/jobs/${j.id}`} className="card p-4 hover:-translate-y-0.5 hover:shadow-lg">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{j.jobTitle}</h3>
                                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-extrabold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{j.match.score}% match</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{j.companyName} · {j.location}</p>
                                {j.match.missing.length > 0 && <p className="mt-2 text-[11px] text-slate-500">To learn: {j.match.missing.slice(0, 3).join(', ')}</p>}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <div className="mb-5 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                    <SearchBox value={q} onChange={setQ} placeholder="Search by title, company or skill..." className="flex-1" />
                    {families.length > 0 && (
                        <select value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Job family" className="input-field sm:w-56">
                            <option value="All">All job families</option>
                            {families.map((f) => <option key={f}>{f}</option>)}
                        </select>
                    )}
                </div>
                <Chips options={TYPES} value={jobType} onChange={setJobType} />
            </div>

            {jobs === null ? (
                <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : shown.length ? (
                <>
                    <p className="mb-3 text-xs font-bold text-slate-500">{shown.length} job{shown.length === 1 ? '' : 's'}</p>
                    <div className="space-y-4">
                        {shown.map((job) => (
                            <Link key={job.id} to={`/jobs/${job.id}`} className="card group flex gap-4 p-5 hover:border-brand-300 hover:shadow-lg dark:hover:border-brand-600">
                                <Avatar name={job.companyName} className="h-12 w-12 text-lg sm:h-14 sm:w-14" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                        <h2 className="font-display text-lg font-bold leading-snug text-slate-900 dark:text-white">{job.jobTitle}</h2>
                                        <span className="text-xs font-semibold text-slate-400">{ago(job.postedAt)}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{job.companyName}</p>
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Icon name="building" className="h-3.5 w-3.5" />{job.location}</p>
                                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{job.jobType}</span>
                                        {job.family && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200" title="Job family (K-Means clustering)">{job.family}</span>}
                                        {(job.skills || []).slice(0, 4).map((s) => <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s}</span>)}
                                    </div>
                                </div>
                                <div className="hidden shrink-0 flex-col items-end justify-between sm:flex">
                                    {applied.has(job.id) ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Applied</span> : <span />}
                                    <span className="text-sm font-bold text-brand-600 group-hover:underline dark:text-brand-300">View →</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            ) : <Empty>No jobs match your search and filters.</Empty>}
        </div>
    );
}
