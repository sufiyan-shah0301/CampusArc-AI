import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/shell/Icon.jsx';
import { Empty, PageHeader } from '../components/dashboard/parts.jsx';

const fmt = (ts) => ts.toDate().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function statusOf(start, end) {
    const now = new Date();
    if (now < start.toDate()) return ['Upcoming', 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'];
    if (now <= end.toDate()) return ['Live now', 'bg-rose-100 text-rose-800 animate-pulse dark:bg-rose-900/40 dark:text-rose-200'];
    return ['Finished', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'];
}

export default function ViewJobFairsPage() {
    const { user } = useAuth();
    const [fairs, setFairs] = useState(null);
    const [qna, setQna] = useState(null);

    const loadFairs = async () => {
        try { setFairs(await api.list('jobFairs', { sort: 'startDate' })); } catch { toast.error('Failed to load job fairs.'); setFairs([]); }
    };
    useEffect(() => {
        loadFairs();
        api.list('qna_sessions', { status: 'scheduled', sort: 'scheduledTime' }).then(setQna).catch(() => { toast.error('Failed to load Q&A sessions.'); setQna([]); });
    }, []);

    const remove = (id) => {
        Swal.fire({ title: 'Delete this fair?', text: 'Its booths and all appointments are deleted too.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Yes, delete' })
            .then(async (r) => {
                if (!r.isConfirmed) return;
                const t = toast.loading('Deleting...');
                try { await api.remove('jobFairs', id); toast.success('Fair deleted.', { id: t }); loadFairs(); } catch { toast.error('Could not delete the fair.', { id: t }); }
            });
    };

    const skeleton = <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>;

    return (
        <div className="space-y-10">
            <section>
                <PageHeader title="Virtual job fairs" subtitle="Join live hiring events, visit company booths and book a short interview slot."
                    action={user?.role === 'recruiter' && <Link to="/create-job-fair" className="btn-primary !px-5 !py-2.5">Create job fair</Link>} />
                {fairs === null ? skeleton : fairs.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {fairs.map((f) => {
                            const [label, cls] = statusOf(f.startDate, f.endDate);
                            return (
                                <div key={f.id} className="card group flex flex-col p-5 hover:-translate-y-1 hover:shadow-xl">
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200"><Icon name="store" className="h-5 w-5" /></span>
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>{label}</span>
                                    </div>
                                    <h2 className="font-display text-lg font-bold leading-snug text-slate-900 dark:text-white">{f.title}</h2>
                                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="calendar" className="h-3.5 w-3.5" />{fmt(f.startDate)} to {fmt(f.endDate)}</p>
                                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                                        <Link to={`/job-fair/${f.id}`} className="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">View details →</Link>
                                        {user?.uid === f.organizerId && (
                                            <button onClick={() => remove(f.id)} aria-label="Delete fair" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"><Icon name="x" className="h-4 w-4" /></button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : <Empty>No job fairs scheduled yet.</Empty>}
            </section>

            <section>
                <PageHeader title="Upcoming Q&A sessions" subtitle="Ask recruiters your questions live." />
                {qna === null ? skeleton : qna.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {qna.map((s) => (
                            <div key={s.id} className="card flex flex-col p-5 hover:-translate-y-1 hover:shadow-xl">
                                <div className="mb-3 flex items-start justify-between gap-2">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-200"><Icon name="mic" className="h-5 w-5" /></span>
                                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">Scheduled</span>
                                </div>
                                <h3 className="font-display text-lg font-bold leading-snug text-slate-900 dark:text-white">{s.topic}</h3>
                                <p className="mt-2 text-xs text-slate-500">Host: <b className="text-slate-700 dark:text-slate-200">{s.recruiterName}</b></p>
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="clock" className="h-3.5 w-3.5" />{fmt(s.scheduledTime)}</p>
                                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                                    <Link to={`/qna-session/${s.id}`} className="text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-300">View session →</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty>No Q&amp;A sessions scheduled right now.</Empty>}
            </section>
        </div>
    );
}
