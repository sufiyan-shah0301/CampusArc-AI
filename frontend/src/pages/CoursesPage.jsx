import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Icon from '../components/shell/Icon.jsx';
import { Chips, Empty, PageHeader, SearchBox } from '../components/dashboard/parts.jsx';

const GRADS = ['from-teal-500 to-emerald-500', 'from-indigo-500 to-violet-500', 'from-amber-500 to-orange-500', 'from-sky-500 to-blue-600', 'from-rose-500 to-pink-500'];

export default function CoursesPage() {
    const { user } = useAuth();
    const [courses, setCourses] = useState(null);
    const [enrolled, setEnrolled] = useState(new Set());
    const [q, setQ] = useState('');
    const [tag, setTag] = useState('All');

    useEffect(() => {
        api.list('courses').then(setCourses).catch(() => setCourses([]));
        if (user?.role === 'student') api.list('enrollments').then((e) => setEnrolled(new Set(e.map((x) => x.courseId)))).catch(() => {});
    }, [user?.role]);

    const tags = useMemo(() => ['All', ...new Set((courses || []).flatMap((c) => c.tags || []))].slice(0, 12), [courses]);
    const shown = (courses || []).filter((c) =>
        (tag === 'All' || (c.tags || []).includes(tag)) &&
        `${c.title} ${c.shortDescription} ${(c.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()));

    return (
        <div>
            <PageHeader title="Courses" subtitle="Short, practical courses to close your skill gaps."
                action={user?.role === 'student' && <Link to="/my-courses" className="btn-ghost !px-4 !py-2">My courses</Link>} />
            <div className="mb-5 space-y-3">
                <SearchBox value={q} onChange={setQ} placeholder="Search courses or skills..." className="max-w-md" />
                {tags.length > 1 && <Chips options={tags} value={tag} onChange={setTag} />}
            </div>

            {courses === null ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : shown.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((c, i) => (
                        <Link key={c.id} to={`/courses/${c.id}`} className="card group flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-xl">
                            <div className={`flex h-24 items-end justify-between bg-gradient-to-br ${GRADS[i % GRADS.length]} p-4`}>
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white"><Icon name="book" className="h-5 w-5" /></span>
                                {enrolled.has(c.id) && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">Enrolled</span>}
                            </div>
                            <div className="flex flex-1 flex-col p-5">
                                <h2 className="font-display text-lg font-bold leading-snug text-slate-900 dark:text-white">{c.title}</h2>
                                <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{c.shortDescription}</p>
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                    {(c.tags || []).slice(0, 3).map((t) => <span key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{t}</span>)}
                                </div>
                                <span className="mt-4 text-sm font-bold text-brand-600 group-hover:underline dark:text-brand-300">{enrolled.has(c.id) ? 'Continue learning' : 'View course'} →</span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : <Empty>{courses.length ? 'No courses match your search.' : 'No courses available at the moment.'}</Empty>}
        </div>
    );
}
