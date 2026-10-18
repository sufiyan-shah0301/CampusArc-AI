import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api';
import Icon from '../components/shell/Icon.jsx';
import { Empty, Panel, SeeAll, Skeleton, STATUS, Stat } from '../components/dashboard/parts.jsx';

const AREA = { profile: 'Profile', learning: 'Learning', interview: 'Interview practice', resume: 'Resume', activity: 'Job applications' };
const BAND = { high: 'High', medium: 'Medium', low: 'Low' };
const TOOLS = [
    ['/resume-scanner', 'Resume scanner', 'ATS score and fixes', 'file', 'from-teal-500 to-emerald-500'],
    ['/mock-interview', 'Mock interview', 'Speak, get scored', 'mic', 'from-indigo-500 to-violet-500'],
    ['/insights', 'Career insights', 'Placement and salary', 'chart', 'from-amber-500 to-orange-500'],
    ['/resume-builder', 'Resume builder', 'Download a PDF', 'pencil', 'from-sky-500 to-blue-600'],
];

const lpa = (inr) => `₹${(inr / 100000).toFixed(inr >= 1000000 ? 1 : 2)} LPA`;
const when = (ts) => ts?.toDate?.();
const dayLabel = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function StudentDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);

    useEffect(() => {
        let alive = true;
        const safe = (p, fallback) => p.catch(() => fallback);
        (async () => {
            const [insights, apps, enrolls, appts, jobs] = await Promise.all([
                safe(api.get('/api/insights/me'), null),
                safe(api.list('applications', { sort: '-appliedAt', limit: 100 }), []),
                safe(api.list('enrollments', { sort: '-enrolledAt', limit: 50 }), []),
                safe(api.list('appointments', { sort: 'scheduledTime' }), []),
                safe(api.list('jobs', { isOpen: true }), []),
            ]);
            if (alive) setData({ insights, apps, enrolls, appts, jobs });
        })();
        return () => { alive = false; };
    }, []);

    if (!data) return <Skeleton />;

    const { insights, apps, enrolls, appts, jobs } = data;
    const readiness = insights?.readiness;
    const placement = insights?.predictions?.placement;
    const salary = insights?.predictions?.salary;
    const active = apps.filter((a) => a.status !== 'Rejected' && a.status !== 'Hired').length;
    const now = Date.now();
    const upcoming = appts.filter((a) => when(a.scheduledTime) && when(a.scheduledTime).getTime() >= now).slice(0, 3);
    const applied = new Set(apps.map((a) => a.jobId));
    const openings = jobs.filter((j) => !applied.has(j.id)).sort((a, b) => (b.postedAt?.toMillis?.() || 0) - (a.postedAt?.toMillis?.() || 0)).slice(0, 4);
    const next = readiness?.nextSteps?.[0];
    const first = (user?.displayName || 'there').split(' ')[0];
    const gap = insights?.skillGap || [];
    const missing = gap.filter((g) => !g.have);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting()}, {first} 👋</h1>
                </div>
                <div className="flex gap-2">
                    <Link to="/jobs" className="btn-primary !px-5 !py-2.5">Browse jobs</Link>
                    <Link to="/resume-scanner" className="btn-ghost !px-5 !py-2.5">Scan resume</Link>
                </div>
            </div>

            {next ? (
                <Link to={next.link} className="flex items-center gap-4 rounded-3xl bg-gradient-to-r from-brand-600 to-indigo-600 p-5 text-white shadow-lg shadow-brand-600/20 transition hover:shadow-xl">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Icon name="sparkle" className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[11px] font-extrabold uppercase tracking-wider text-white/80">Best next step · {AREA[next.area]}</span><span className="block text-sm font-bold sm:text-base">{next.text}</span></span>
                    <Icon name="arrow" className="h-5 w-5 shrink-0" />
                </Link>
            ) : readiness && (
                <div className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-5 text-sm font-bold text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"><Icon name="check" className="h-5 w-5" />You are on track. Keep applying and practising.</div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat to="/insights" label="Readiness" ring={readiness?.score ?? 0} value={readiness ? readiness.score : '-'} sub="out of 100" />
                <Stat to="/insights" label="Placement chance" icon="trending" value={placement ? `${Math.min(95, Math.max(3, Math.round(placement.probability * 100)))}%` : 'Add CGPA'} sub={placement ? `${BAND[placement.band]} (ML estimate)` : 'Add CGPA to unlock'} />
                <Stat to="/my-applications" label="Applications" icon="clipboard" value={apps.length} sub={`${active} active`} />
                <Stat to="/my-courses" label="Courses" icon="book" value={enrolls.length} sub="Enrolled" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Panel title="Your AI toolkit">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {TOOLS.map(([to, name, sub, icon, grad]) => (
                                <Link key={to} to={to} className={`group rounded-2xl bg-gradient-to-br ${grad} p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg`}>
                                    <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Icon name={icon} className="h-5 w-5" /></span>
                                    <p className="text-sm font-bold leading-tight">{name}</p>
                                    <p className="mt-0.5 text-[11px] text-white/80">{sub}</p>
                                </Link>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="Recent applications" action={<SeeAll to="/my-applications" />}>
                        {apps.length ? (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {apps.slice(0, 4).map((a) => (
                                    <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{(a.companyName || '?')[0]}</span>
                                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{a.jobTitle}</p><p className="truncate text-xs text-slate-500">{a.companyName} · {when(a.appliedAt) ? dayLabel(when(a.appliedAt)) : ''}</p></div>
                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[a.status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{a.status}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>No applications yet. <Link to="/jobs" className="font-bold text-brand-600">Find your first job</Link></Empty>}
                    </Panel>

                    <Panel title="New openings for you" action={<SeeAll to="/jobs" label="All jobs" />}>
                        {openings.length ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {openings.map((j) => (
                                    <Link key={j.id} to={`/jobs/${j.id}`} className="rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:shadow-md dark:border-slate-700 dark:hover:border-brand-600">
                                        <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-slate-900 dark:text-white">{j.jobTitle}</p>{j.jobType && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{j.jobType}</span>}</div>
                                        <p className="mt-1 text-xs text-slate-500">{j.companyName}{j.location ? ` · ${j.location}` : ''}</p>
                                    </Link>
                                ))}
                            </div>
                        ) : <Empty>No new openings right now. Check back soon.</Empty>}
                    </Panel>
                </div>

                <div className="space-y-6">
                    <Panel title="Readiness breakdown" action={<SeeAll to="/insights" label="Details" />}>
                        {readiness ? (
                            <ul className="space-y-3">
                                {Object.entries(readiness.components).map(([k, v]) => (
                                    <li key={k}>
                                        <div className="mb-1 flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>{AREA[k]}</span><span>{v}</span></div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-1000" style={{ width: `${v}%` }} /></div>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>Insights are not available right now.</Empty>}
                        {salary && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">Expected starting salary: <b className="text-slate-900 dark:text-white">{lpa(salary.expected)}</b></p>}
                    </Panel>

                    <Panel title="Upcoming interviews" action={<SeeAll to="/my-scheduled-interviews" />}>
                        {upcoming.length ? (
                            <ul className="space-y-3">
                                {upcoming.map((a) => (
                                    <li key={a.id} className="flex items-center gap-3">
                                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><span className="text-sm font-extrabold leading-none">{when(a.scheduledTime).getDate()}</span><span className="text-[9px] font-bold uppercase">{when(a.scheduledTime).toLocaleDateString(undefined, { month: 'short' })}</span></span>
                                        <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{a.companyName}</p><p className="text-xs text-slate-500">{when(a.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>Nothing booked. <Link to="/job-fairs" className="font-bold text-brand-600">Browse job fairs</Link></Empty>}
                    </Panel>

                    <Panel title="Skills employers want" action={<SeeAll to="/insights" label="Skill gap" />}>
                        {gap.length ? (
                            <>
                                <div className="flex flex-wrap gap-1.5">
                                    {gap.slice(0, 8).map((g) => <span key={g.skill} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${g.have ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>{g.have ? '✓ ' : ''}{g.skill}</span>)}
                                </div>
                                {insights.courseSuggestions?.[0] && <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Missing {insights.courseSuggestions[0].skill}? Try <Link to={`/courses/${insights.courseSuggestions[0].courseId}`} className="font-bold text-brand-600 hover:underline dark:text-brand-300">{insights.courseSuggestions[0].title}</Link>.</p>}
                                {!insights.courseSuggestions?.[0] && missing.length > 0 && <p className="mt-3 text-xs text-slate-500">Add these to your profile skills once you have them.</p>}
                            </>
                        ) : <Empty>Skill demand appears once jobs are posted.</Empty>}
                    </Panel>
                </div>
            </div>
        </div>
    );
}
