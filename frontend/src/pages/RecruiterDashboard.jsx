import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api';
import Icon from '../components/shell/Icon.jsx';
import { ExportButton } from '../components/Analytics.jsx';
import { Empty, Panel, SeeAll, Skeleton, STATUS, Stat } from '../components/dashboard/parts.jsx';

const PIPE = [['Applied', 'bg-slate-400'], ['Under Review', 'bg-amber-400'], ['Interviewing', 'bg-indigo-500'], ['Hired', 'bg-emerald-500'], ['Rejected', 'bg-rose-400']];
const ACTIONS = [
    ['/post-job', 'Post a job', 'plus', 'from-teal-500 to-emerald-500'],
    ['/candidate-search', 'Find candidates', 'search', 'from-indigo-500 to-violet-500'],
    ['/create-job-fair', 'Create job fair', 'calendar', 'from-amber-500 to-orange-500'],
    ['/create-qna', 'Schedule Q&A', 'mic', 'from-sky-500 to-blue-600'],
];

const when = (ts) => ts?.toDate?.();
const dayLabel = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function jobState(j) {
    if (j.reviewStatus === 'pending') return ['Under admin review', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'];
    if (j.reviewStatus === 'rejected') return ['Rejected', 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'];
    return j.isOpen ? ['Open', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'] : ['Closed', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'];
}

export default function RecruiterDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);

    useEffect(() => {
        let alive = true;
        const safe = (p, fallback) => p.catch(() => fallback);
        (async () => {
            const [jobs, funnel, recent, appts, fairs] = await Promise.all([
                safe(api.get('/api/recruiter/jobs'), []),
                safe(api.get('/api/reports/funnel'), null),
                safe(api.list('applications', { sort: '-appliedAt', limit: 6 }), []),
                safe(api.list('appointments', { sort: 'scheduledTime' }), []),
                safe(api.list('jobFairs', { sort: 'startDate' }), []),
            ]);
            if (alive) setData({ jobs, funnel, recent, appts, fairs });
        })();
        return () => { alive = false; };
    }, []);

    const chat = async (studentId) => {
        if (!studentId) return toast.error('Applicant details are missing.');
        const id = toast.loading('Starting chat...');
        try { const c = await api.startChat(studentId); toast.dismiss(id); navigate(`/chat/${c.id}`); }
        catch { toast.error('Could not start chat.', { id }); }
    };

    if (!data) return <Skeleton />;

    const { jobs, funnel, recent, appts, fairs } = data;
    const by = funnel?.byStatus || {};
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    const toReview = (by.Applied || 0) + (by['Under Review'] || 0);
    const openJobs = jobs.filter((j) => j.isOpen && j.reviewStatus !== 'rejected').length;
    const flagged = jobs.filter((j) => j.reviewStatus === 'pending' || j.reviewStatus === 'rejected');
    const now = Date.now();
    const upcoming = appts.filter((a) => when(a.scheduledTime) && when(a.scheduledTime).getTime() >= now).slice(0, 3);
    const fairsSoon = fairs.filter((f) => when(f.endDate) && when(f.endDate).getTime() >= now).slice(0, 3);
    const first = (user?.displayName || 'there').split(' ')[0];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting()}, {first} 👋</h1>
                </div>
                <div className="flex gap-2">
                    <Link to="/post-job" className="btn-primary !px-5 !py-2.5">Post a job</Link>
                    <Link to="/candidate-search" className="btn-ghost !px-5 !py-2.5">Find candidates</Link>
                </div>
            </div>

            {flagged.length > 0 && (
                <Link to="/manage-jobs" className="flex items-center gap-3 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-900 transition hover:shadow-md dark:bg-amber-900/20 dark:text-amber-100">
                    <Icon name="flag" className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{flagged.length} job{flagged.length > 1 ? 's need' : ' needs'} attention: {flagged.map((j) => j.jobTitle).slice(0, 2).join(', ')}{flagged.length > 2 ? '…' : ''}</span>
                    <Icon name="arrow" className="h-4 w-4 shrink-0" />
                </Link>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat to="/manage-jobs" label="Open jobs" icon="briefcase" value={openJobs} sub={`${jobs.length} posted in total`} />
                <Stat to="/manage-jobs" label="Applicants" icon="users" value={total} sub="Across all your jobs" />
                <Stat to="/manage-jobs" label="To review" icon="clipboard" value={toReview} sub="Applied or under review" />
                <Stat to="/manage-jobs" label="Hired" icon="check" value={by.Hired || 0} sub={total ? `${Math.round(100 * (by.Hired || 0) / total)}% of applicants` : 'No applicants yet'} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ACTIONS.map(([to, label, icon, grad]) => (
                    <Link key={to} to={to} className={`flex items-center gap-3 rounded-2xl bg-gradient-to-br ${grad} p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg`}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20"><Icon name={icon} className="h-5 w-5" /></span>
                        <span className="text-sm font-bold leading-tight">{label}</span>
                    </Link>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Panel title="Hiring pipeline" action={<ExportButton path="/api/reports/applications.csv" filename="applicants.csv">⬇ Export CSV</ExportButton>}>
                        {total ? (
                            <>
                                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label="Applicants by stage">
                                    {PIPE.map(([s, c]) => by[s] ? <div key={s} className={`${c} transition-all duration-700`} style={{ width: `${(100 * by[s]) / total}%` }} title={`${s}: ${by[s]}`} /> : null)}
                                </div>
                                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    {PIPE.map(([s, c]) => (
                                        <li key={s} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${c}`} />{s}</span>
                                            <span className="font-display text-xl font-bold text-slate-900 dark:text-white">{by[s] || 0}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : <Empty>No applications yet. Post a job and candidates will show up here.</Empty>}
                    </Panel>

                    <Panel title="Recent applicants" action={<SeeAll to="/manage-jobs" label="Manage jobs" />}>
                        {recent.length ? (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recent.map((a) => (
                                    <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-xs font-extrabold text-white">{(a.studentName || '?')[0].toUpperCase()}</span>
                                        <div className="min-w-0 flex-1">
                                            <Link to={`/student/${a.studentId}`} className="block truncate text-sm font-bold text-slate-900 hover:underline dark:text-white">{a.studentName}</Link>
                                            <p className="truncate text-xs text-slate-500"><Link to={`/jobs/${a.jobId}/applicants`} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">{a.jobTitle}</Link>{when(a.appliedAt) ? ` · ${dayLabel(when(a.appliedAt))}` : ''}</p>
                                        </div>
                                        {a.matchScore !== undefined && <span className="hidden shrink-0 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-extrabold text-brand-700 sm:inline dark:bg-brand-900/30 dark:text-brand-200" title="Skill match">{Math.round(a.matchScore)}% match</span>}
                                        <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline ${STATUS[a.status] || STATUS.Applied}`}>{a.status}</span>
                                        <button onClick={() => chat(a.studentId)} aria-label={`Chat with ${a.studentName}`} className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"><Icon name="chat" className="h-4 w-4" /></button>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>No applicants yet.</Empty>}
                    </Panel>
                </div>

                <div className="space-y-6">
                    <Panel title="Your jobs" action={<SeeAll to="/manage-jobs" />}>
                        {jobs.length ? (
                            <ul className="space-y-3">
                                {jobs.slice(0, 5).map((j) => {
                                    const [label, cls] = jobState(j);
                                    return (
                                        <li key={j.id}>
                                            <Link to={`/jobs/${j.id}/applicants`} className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{j.jobTitle}</p><p className="text-xs text-slate-500">{j.applicantCount} applicant{j.applicantCount === 1 ? '' : 's'}</p></div>
                                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : <Empty>No jobs yet. <Link to="/post-job" className="font-bold text-brand-600">Post your first job</Link></Empty>}
                    </Panel>

                    <Panel title="Upcoming interviews" action={<SeeAll to="/my-appointments" />}>
                        {upcoming.length ? (
                            <ul className="space-y-3">
                                {upcoming.map((a) => (
                                    <li key={a.id} className="flex items-center gap-3">
                                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><span className="text-sm font-extrabold leading-none">{when(a.scheduledTime).getDate()}</span><span className="text-[9px] font-bold uppercase">{when(a.scheduledTime).toLocaleDateString(undefined, { month: 'short' })}</span></span>
                                        <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{a.studentName}</p><p className="text-xs text-slate-500">{when(a.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>No interviews booked.</Empty>}
                    </Panel>

                    <Panel title="Job fairs" action={<SeeAll to="/job-fairs" />}>
                        {fairsSoon.length ? (
                            <ul className="space-y-3">
                                {fairsSoon.map((f) => (
                                    <li key={f.id}><Link to={`/job-fair/${f.id}`} className="block rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{f.title}</p><p className="text-xs text-slate-500">{dayLabel(when(f.startDate))} to {dayLabel(when(f.endDate))}</p></Link></li>
                                ))}
                            </ul>
                        ) : <Empty>No upcoming fairs. <Link to="/create-job-fair" className="font-bold text-brand-600">Create one</Link></Empty>}
                    </Panel>

                    {funnel?.perJob?.length > 0 && (
                        <Panel title="Best matches by job">
                            <ul className="space-y-3">
                                {funnel.perJob.slice(0, 4).map((j) => (
                                    <li key={j.jobId}>
                                        <div className="mb-1 flex justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="truncate">{j.title}</span><span className="shrink-0">{j.avgMatch}% avg</span></div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500" style={{ width: `${j.avgMatch}%` }} /></div>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
