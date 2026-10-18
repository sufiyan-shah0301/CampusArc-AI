import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Avatar, Chips, Empty, PageHeader, SearchBox } from '../components/dashboard/parts.jsx';

export default function CompaniesPage() {
    const [companies, setCompanies] = useState(null);
    const [openByCompany, setOpen] = useState({});
    const [q, setQ] = useState('');
    const [industry, setIndustry] = useState('All');

    useEffect(() => {
        api.list('companies').then(setCompanies).catch(() => setCompanies([]));
        api.list('jobs', { isOpen: true }).then((jobs) => {
            const m = {};
            jobs.forEach((j) => { const k = (j.companyName || '').trim().toLowerCase(); m[k] = (m[k] || 0) + 1; });
            setOpen(m);
        }).catch(() => {});
    }, []);

    const industries = useMemo(() => ['All', ...new Set((companies || []).map((c) => c.industry).filter(Boolean))], [companies]);
    const shown = (companies || []).filter((c) => (industry === 'All' || c.industry === industry) && `${c.companyName} ${c.industry} ${c.shortDescription}`.toLowerCase().includes(q.toLowerCase()));

    return (
        <div>
            <PageHeader title="Companies" subtitle="Learn about employers before you apply." />
            <div className="mb-5 space-y-3">
                <SearchBox value={q} onChange={setQ} placeholder="Search companies..." className="max-w-md" />
                {industries.length > 1 && <Chips options={industries} value={industry} onChange={setIndustry} />}
            </div>

            {companies === null ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : shown.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((c) => {
                        const n = openByCompany[(c.companyName || '').trim().toLowerCase()] || 0;
                        return (
                            <Link key={c.id} to={`/companies/${c.id}`} className="card group flex flex-col gap-3 p-5 hover:-translate-y-1 hover:shadow-xl">
                                <div className="flex items-center gap-3">
                                    <Avatar name={c.companyName} src={c.logoUrl} className="h-14 w-14 text-xl" />
                                    <div className="min-w-0">
                                        <h2 className="truncate font-display text-lg font-bold text-slate-900 dark:text-white">{c.companyName}</h2>
                                        {c.industry && <p className="truncate text-xs font-semibold text-slate-500">{c.industry}</p>}
                                    </div>
                                </div>
                                <p className="line-clamp-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{c.shortDescription}</p>
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className={`rounded-full px-2.5 py-1 ${n ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{n ? `${n} open job${n > 1 ? 's' : ''}` : 'No open jobs'}</span>
                                    <span className="text-brand-600 group-hover:underline dark:text-brand-300">View →</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : <Empty>{companies.length ? 'No companies match your search.' : 'No companies listed yet.'}</Empty>}
        </div>
    );
}
