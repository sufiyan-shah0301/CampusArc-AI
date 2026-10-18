import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import Icon from '../components/shell/Icon.jsx';
import { Chips, Empty, PageHeader, plainText, readMinutes, SearchBox } from '../components/dashboard/parts.jsx';

const STYLE = {
    'Resume Guide': ['file', 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'],
    'Interview Tips': ['mic', 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'],
    Article: ['book', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'],
};
const FALLBACK = ['library', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'];

export default function ResourcesPage() {
    const [items, setItems] = useState(null);
    const [q, setQ] = useState('');
    const [cat, setCat] = useState('All');

    useEffect(() => { api.list('resources', { sort: '-createdAt' }).then(setItems).catch(() => setItems([])); }, []);

    const cats = useMemo(() => ['All', ...new Set((items || []).map((r) => r.category).filter(Boolean))], [items]);
    const shown = (items || []).filter((r) => (cat === 'All' || r.category === cat) && `${r.title} ${plainText(r.content)}`.toLowerCase().includes(q.toLowerCase()));

    return (
        <div>
            <PageHeader title="Resource library" subtitle="Guides, interview tips and articles to help you get hired." />
            <div className="mb-5 space-y-3">
                <SearchBox value={q} onChange={setQ} placeholder="Search resources..." className="max-w-md" />
                {cats.length > 1 && <Chips options={cats} value={cat} onChange={setCat} />}
            </div>

            {items === null ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : shown.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((r) => {
                        const [icon, cls] = STYLE[r.category] || FALLBACK;
                        return (
                            <Link key={r.id} to={`/resources/${r.id}`} className="card group flex flex-col p-5 hover:-translate-y-1 hover:shadow-xl">
                                <div className="mb-3 flex items-center gap-2.5">
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${cls}`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>{r.category}</span>
                                </div>
                                <h2 className="font-display text-lg font-bold leading-snug text-slate-900 dark:text-white">{r.title}</h2>
                                <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{plainText(r.content).slice(0, 160)}</p>
                                <div className="mt-4 flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-500">{readMinutes(r.content)} min read</span>
                                    <span className="text-brand-600 group-hover:underline dark:text-brand-300">Read →</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : <Empty>{items.length ? 'No resources match your search.' : 'No resources yet.'}</Empty>}
        </div>
    );
}
