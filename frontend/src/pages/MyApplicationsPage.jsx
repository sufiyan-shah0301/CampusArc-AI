import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, Chips, Empty, PageHeader, STATUS } from '../components/dashboard/parts.jsx';

const FILTERS = ['All', 'Applied', 'Under Review', 'Interviewing', 'Hired', 'Rejected'];

export default function MyApplicationsPage() {
    const { user } = useAuth();
    const [apps, setApps] = useState(null);
    const [filter, setFilter] = useState('All');

    useLive(async () => { setApps(await api.list('applications', { sort: '-appliedAt' })); }, 'applications', [user?.uid]);

    const counts = (apps || []).reduce((m, a) => ({ ...m, [a.status]: (m[a.status] || 0) + 1 }), {});
    const shown = (apps || []).filter((a) => filter === 'All' || a.status === filter);

    return (
        <div>
            <PageHeader title="My applications" subtitle="Track every application and its status in one place."
                action={<Link to="/jobs" className="btn-primary !px-5 !py-2.5">Browse jobs</Link>} />

            {apps && apps.length > 0 && (
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[['Total', apps.length], ['In review', (counts.Applied || 0) + (counts['Under Review'] || 0)], ['Interviewing', counts.Interviewing || 0], ['Hired', counts.Hired || 0]].map(([l, v]) => (
                        <div key={l} className="card px-4 py-3"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{l}</p><p className="font-display text-2xl font-bold text-slate-900 dark:text-white">{v}</p></div>
                    ))}
                </div>
            )}

            <div className="mb-5"><Chips options={FILTERS} value={filter} onChange={setFilter} /></div>

            {apps === null ? (
                <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : shown.length ? (
                <div className="space-y-3">
                    {shown.map((a) => (
                        <div key={a.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <Avatar name={a.companyName} className="h-12 w-12 text-lg" />
                                <div className="min-w-0">
                                    <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base dark:text-white">{a.jobTitle}</h2>
                                    <p className="truncate text-xs text-slate-500">{a.companyName} · Applied {a.appliedAt?.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:justify-end">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS[a.status] || STATUS.Applied}`}>{a.status}</span>
                                <Link to={`/jobs/${a.jobId}`} className="btn-ghost !px-4 !py-2 !text-xs">View job</Link>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty>{apps.length ? 'No applications with this status.' : <>You have not applied for any jobs yet. <Link to="/jobs" className="font-bold text-brand-600">Browse jobs</Link></>}</Empty>
            )}
        </div>
    );
}
