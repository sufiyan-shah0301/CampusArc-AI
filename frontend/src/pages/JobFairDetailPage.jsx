import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import BookingModal from '../components/BookingModal';
import Icon from '../components/shell/Icon.jsx';
import { Avatar, Empty } from '../components/dashboard/parts.jsx';

const fmt = (ts) => new Date(ts.seconds * 1000).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function JobFairDetailPage() {
    const { fairId } = useParams();
    const { user } = useAuth();
    const [fair, setFair] = useState(null);
    const [booths, setBooths] = useState([]);
    const [participating, setParticipating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [booth, setBooth] = useState(null);

    const load = async () => {
        try {
            const f = await api.getDoc('jobFairs', fairId);
            setFair(f);
            setBooths(await api.list('booths', { jobFairId: fairId }));
            if (user?.role === 'recruiter') setParticipating((f.participatingCompanies || []).includes(user.uid));
        } catch (err) { setError(err.status === 404 ? 'No such job fair found.' : 'Failed to load this job fair.'); }
        setLoading(false);
    };
    useEffect(() => { if (fairId && user) load(); }, [fairId, user]); // eslint-disable-line react-hooks/exhaustive-deps

    const join = async () => {
        const id = toast.loading('Joining fair...');
        try { await api.post(`/api/jobFairs/${fairId}/join`); toast.success('You have successfully joined the fair!', { id }); load(); }
        catch { toast.error('Failed to join the fair.', { id }); }
    };

    if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />;
    if (error) return <Empty>{error} <Link to="/job-fairs" className="font-bold text-brand-600">Back to job fairs</Link></Empty>;

    return (
        <div className="space-y-8">
            <Link to="/job-fairs" className="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">← All job fairs</Link>

            <section className="card relative overflow-hidden p-6 sm:p-8">
                <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
                <div className="relative">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><Icon name="store" className="h-3.5 w-3.5" />Virtual job fair</span>
                    <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{fair.title}</h1>
                    <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base dark:text-slate-300">{fair.description}</p>
                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-2"><Icon name="calendar" className="h-4 w-4 text-brand-600" /><b>Starts</b> {fmt(fair.startDate)}</span>
                        <span className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4 text-brand-600" /><b>Ends</b> {fmt(fair.endDate)}</span>
                    </div>
                    {user?.role === 'recruiter' && (participating
                        ? <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"><Icon name="check" className="h-4 w-4" />You are participating in this fair</p>
                        : <button onClick={join} className="btn-primary mt-6 !px-8">Join this fair</button>)}
                </div>
            </section>

            <section>
                <h2 className="mb-4 font-display text-xl font-bold text-slate-900 dark:text-white">Company booths</h2>
                {booths.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {booths.map((b) => (
                            <div key={b.id} className="card flex flex-col p-5 hover:-translate-y-1 hover:shadow-xl">
                                <div className="flex items-center gap-3">
                                    <Avatar name={b.companyName} className="h-12 w-12 text-lg" />
                                    <div className="min-w-0">
                                        <h3 className="truncate font-display text-base font-bold text-slate-900 dark:text-white">{b.companyName}</h3>
                                        <p className="text-xs font-bold text-brand-600 dark:text-brand-300">{b.availableSlots?.length || 0} slot{b.availableSlots?.length === 1 ? '' : 's'} available</p>
                                    </div>
                                </div>
                                <div className="mt-5">
                                    {user?.role === 'recruiter' && user.uid === b.companyId && <Link to={`/manage-booth/${b.id}`} className="btn-primary w-full !py-2.5">Manage booth</Link>}
                                    {user?.role === 'student' && <button onClick={() => setBooth(b)} className="btn-primary w-full !py-2.5">View &amp; book a slot</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty>No companies have joined this fair yet.</Empty>}
            </section>

            {booth && <BookingModal booth={booth} onClose={() => setBooth(null)} onBookingSuccess={load} />}
        </div>
    );
}
