import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Icon from '../components/shell/Icon.jsx';
import { ExportButton } from '../components/Analytics.jsx';
import { Bars, Empty, Panel, SeeAll, Skeleton, Stat, Trend } from '../components/dashboard/parts.jsx';

const PIPE = [['Applied', 'bg-slate-400'], ['Under Review', 'bg-amber-400'], ['Interviewing', 'bg-indigo-500'], ['Hired', 'bg-emerald-500'], ['Rejected', 'bg-rose-400']];
const MANAGE = [
    ['/admin/users', 'Users', 'users'], ['/admin/jobs', 'Jobs', 'briefcase'], ['/admin/courses', 'Courses', 'book'],
    ['/admin/resources', 'Resources', 'library'], ['/admin/companies', 'Companies', 'building'], ['/admin/ml', 'ML models', 'cpu'],
];
const FLAG = { resume_similarity: 'Near-duplicate resume' };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const num = (n) => (typeof n === 'number' ? n.toLocaleString() : n);

/** Headline numbers from the trained models (read from the model cards, never made up). */
function modelHealth(cards) {
    if (!cards) return [];
    const best = (cmp, deployed) => cmp?.[deployed] || Object.entries(cmp || {}).find(([n]) => /ensemble|stacked/i.test(n))?.[1];
    const rows = [];
    if (cards.fakejob?.random_forest) rows.push(['Fake-job detector', 'Random Forest', cards.fakejob.random_forest.roc_auc]);
    if (cards.placement) rows.push(['Placement predictor', cards.placement.deployed_model, best(cards.placement.comparison_on_holdout, cards.placement.deployed_model)?.roc_auc]);
    if (cards.deepfake) rows.push(['Deepfake image check', 'Ensemble', best(cards.deepfake.comparison_on_test, cards.deepfake.deployed_model)?.roc_auc]);
    if (cards.phishing) rows.push(['Phishing link check', 'Ensemble', best(cards.phishing.comparison_on_holdout, cards.phishing.deployed_model)?.roc_auc]);
    return rows.filter((r) => r[2] !== undefined);
}

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [data, setData] = useState(null);

    useEffect(() => {
        let alive = true;
        const safe = (p, fb) => p.catch(() => fb);
        (async () => {
            const [stats, summary, integrity, jobs, models] = await Promise.all([
                safe(api.get('/api/admin/stats'), null),
                safe(api.get('/api/reports/summary'), null),
                safe(api.get('/api/admin/integrity'), null),
                safe(api.list('jobs'), []),
                safe(api.get('/api/ml/models'), null),
            ]);
            if (alive) setData({ stats, summary, integrity, jobs, models });
        })();
        return () => { alive = false; };
    }, []);

    if (!data) return <Skeleton />;

    const { stats, summary: s, integrity, jobs, models } = data;
    const pending = jobs.filter((j) => j.reviewStatus === 'pending');
    const flags = integrity?.flags || [];
    const by = s?.applicationsByStatus || {};
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    const roles = s?.usersByRole || {};
    const health = modelHealth(models);
    const first = (user?.displayName || 'Admin').split(' ')[0];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting()}, {first} 👋</h1>
                </div>
                <div className="flex gap-2">
                    <Link to="/admin/users" className="btn-ghost !px-5 !py-2.5">Manage users</Link>
                    <Link to="/admin/jobs" className="btn-primary !px-5 !py-2.5">Review jobs</Link>
                </div>
            </div>

            {(pending.length > 0 || flags.length > 0) && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {pending.length > 0 && (
                        <Link to="/admin/jobs" className="flex items-center gap-3 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-900 transition hover:shadow-md dark:bg-amber-900/20 dark:text-amber-100">
                            <Icon name="flag" className="h-5 w-5 shrink-0" /><span className="flex-1">{pending.length} job{pending.length > 1 ? 's' : ''} waiting for fraud review</span><Icon name="arrow" className="h-4 w-4" />
                        </Link>
                    )}
                    {flags.length > 0 && (
                        <Link to="/admin/integrity" className="flex items-center gap-3 rounded-3xl bg-rose-50 p-4 text-sm font-bold text-rose-900 transition hover:shadow-md dark:bg-rose-900/20 dark:text-rose-100">
                            <Icon name="shield" className="h-5 w-5 shrink-0" /><span className="flex-1">{flags.length} open integrity flag{flags.length > 1 ? 's' : ''} to review</span><Icon name="arrow" className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat to="/admin/users" label="Users" icon="users" value={num(stats?.users ?? 0)} sub={`${roles.student || 0} students · ${roles.recruiter || 0} recruiters`} />
                <Stat to="/admin/jobs" label="Live jobs" icon="briefcase" value={num(Math.max(0, (s?.jobs?.open ?? 0) - (s?.jobs?.pendingReview ?? 0)))} sub={`${s?.jobs?.total ?? 0} posted, ${s?.jobs?.pendingReview ?? 0} in review`} />
                <Stat to="/admin/jobs" label="Placement rate" icon="trending" value={`${s?.placementRate ?? 0}%`} sub={`${num(total)} applications`} />
                <Stat to="/admin/courses" label="Courses" icon="book" value={num(stats?.courses ?? 0)} sub={`${num(s?.enrollments ?? 0)} enrollments`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Panel title="Applications per day" action={<span className="text-xs font-bold text-slate-400">Last 30 days</span>}>
                        <Trend points={(s?.applicationsPerDay || []).map((d) => ({ label: d.date.slice(5), value: d.count }))} />
                    </Panel>

                    <Panel title="Application pipeline" action={<ExportButton path="/api/reports/placements.csv" filename="placements.csv">⬇ Placements CSV</ExportButton>}>
                        {total ? (
                            <>
                                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label="Applications by stage">
                                    {PIPE.map(([k, c]) => by[k] ? <div key={k} className={c} style={{ width: `${(100 * by[k]) / total}%` }} title={`${k}: ${by[k]}`} /> : null)}
                                </div>
                                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    {PIPE.map(([k, c]) => (
                                        <li key={k} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${c}`} />{k}</span>
                                            <span className="font-display text-xl font-bold text-slate-900 dark:text-white">{by[k] || 0}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : <Empty>No applications yet.</Empty>}
                    </Panel>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Panel title="Most demanded skills"><Bars items={(s?.topSkillsDemanded || []).map((d) => ({ label: d.skill, value: d.jobs }))} empty="Skills appear once jobs are posted." /></Panel>
                        <Panel title="Hires by company"><Bars tone="from-emerald-500 to-teal-500" items={(s?.hiresByCompany || []).map((d) => ({ label: d.company, value: d.hires }))} empty="No hires recorded yet." /></Panel>
                    </div>
                </div>

                <div className="space-y-6">
                    <Panel title="Jobs awaiting review" action={<SeeAll to="/admin/jobs" />}>
                        {pending.length ? (
                            <ul className="space-y-3">
                                {pending.slice(0, 4).map((j) => (
                                    <li key={j.id}>
                                        <Link to="/admin/jobs" className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{j.jobTitle}</p><p className="truncate text-xs text-slate-500">{j.companyName}</p></div>
                                            {j.riskScore !== undefined && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">{Math.round(j.riskScore)}% risk</span>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>No jobs waiting. Fraud screening is clear.</Empty>}
                    </Panel>

                    <Panel title="Integrity flags" action={<SeeAll to="/admin/integrity" label="Review" />}>
                        {flags.length ? (
                            <ul className="space-y-3">
                                {flags.slice(0, 4).map((f) => (
                                    <li key={f.id} className="text-sm">
                                        <p className="font-bold text-slate-900 dark:text-white">{FLAG[f.type] || f.type}</p>
                                        <p className="truncate text-xs text-slate-500">{f.user?.name || 'Unknown'}{f.otherUser ? ` ↔ ${f.otherUser.name}` : ''}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>No open flags.{integrity?.model && ` Anomaly model: ${integrity.model.students} students scored.`}</Empty>}
                    </Panel>

                    <Panel title="ML model health" action={<SeeAll to="/admin/ml" label="Metrics" />}>
                        {health.length ? (
                            <ul className="space-y-3">
                                {health.map(([name, model, auc]) => (
                                    <li key={name} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="min-w-0"><span className="block truncate font-bold text-slate-900 dark:text-white">{name}</span><span className="block truncate text-[11px] text-slate-500">{model}</span></span>
                                        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-extrabold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" title="ROC-AUC on held-out data">AUC {auc}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>Model cards are not available.</Empty>}
                    </Panel>

                    <Panel title="Manage">
                        <div className="grid grid-cols-2 gap-2">
                            {MANAGE.map(([to, label, icon]) => (
                                <Link key={to} to={to} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-600">
                                    <Icon name={icon} className="h-4 w-4 shrink-0" />{label}
                                </Link>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
