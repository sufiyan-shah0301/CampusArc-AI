import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Icon from '../components/shell/Icon.jsx';
import { Empty, PageHeader } from '../components/dashboard/parts.jsx';

export default function MyCoursesPage() {
    const [items, setItems] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const enrollments = await api.list('enrollments', { sort: '-enrolledAt' });
                // lesson totals so each card can show real progress
                const withTotals = await Promise.all(enrollments.map(async (e) => {
                    let total = 0;
                    try { total = (await api.listSub('courses', e.courseId, 'lessons')).length; } catch { /* course removed */ }
                    return { ...e, total, done: (e.completedLessons || []).length };
                }));
                if (alive) setItems(withTotals);
            } catch { if (alive) setItems([]); }
        })();
        return () => { alive = false; };
    }, []);

    return (
        <div>
            <PageHeader title="My courses" subtitle="Pick up where you left off." action={<Link to="/courses" className="btn-ghost !px-4 !py-2">Browse courses</Link>} />
            {items === null ? (
                <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : items.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    {items.map((e) => {
                        const pct = e.total ? Math.round((100 * e.done) / e.total) : 0;
                        const finished = e.total > 0 && e.done >= e.total;
                        return (
                            <div key={e.id} className="card flex flex-col gap-4 p-5">
                                <div className="flex items-start gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200"><Icon name="book" className="h-5 w-5" /></span>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-display text-base font-bold leading-snug text-slate-900 dark:text-white">{e.courseTitle}</h2>
                                        <p className="text-xs text-slate-500">Enrolled {e.enrolledAt ? e.enrolledAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                                    </div>
                                    {finished && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Completed</span>}
                                </div>
                                <div>
                                    <div className="mb-1 flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>{e.done} of {e.total} lessons</span><span>{pct}%</span></div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                                </div>
                                <Link to={`/courses/${e.courseId}`} className="btn-primary !py-2.5">{finished ? 'Review course' : e.done ? 'Continue' : 'Start learning'}</Link>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Empty>You have not enrolled in any course yet. <Link to="/courses" className="font-bold text-brand-600">Browse courses</Link></Empty>
            )}
        </div>
    );
}
