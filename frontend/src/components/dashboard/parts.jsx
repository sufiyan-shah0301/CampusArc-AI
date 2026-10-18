import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shell/Icon.jsx';

// Building blocks shared by the student, recruiter and admin dashboards.
export const STATUS = {
    Applied: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    'Under Review': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    Interviewing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    Hired: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    Rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

export function Panel({ title, action, children, className = '' }) {
    return (
        <section className={`card p-5 ${className}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

export const SeeAll = ({ to, label = 'View all' }) => <Link to={to} className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-300">{label} →</Link>;
export const Empty = ({ children }) => <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">{children}</p>;

export function Ring({ value, size = 64, stroke = 7 }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    return (
        <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-700" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} className="stroke-brand-500 transition-all duration-1000" />
        </svg>
    );
}

export function Stat({ to, label, value, sub, ring, icon }) {
    return (
        <Link to={to} className="card group flex flex-col items-start gap-3 p-4 hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:items-center sm:gap-4">
            {ring !== undefined ? (
                <div className="relative"><Ring value={ring} /><span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900 dark:text-white">{Math.round(ring)}</span></div>
            ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200"><Icon name={icon} className="h-6 w-6" /></span>
            )}
            <div className="min-w-0 max-w-full">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <p className="font-display text-2xl font-bold leading-tight text-slate-900 dark:text-white">{value}</p>
                {sub && <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">{sub}</p>}
            </div>
        </Link>
    );
}

export function Skeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading dashboard">
            <div className="h-10 w-72 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            <div className="grid gap-6 lg:grid-cols-3"><div className="h-72 rounded-3xl bg-slate-200 lg:col-span-2 dark:bg-slate-800" /><div className="h-72 rounded-3xl bg-slate-200 dark:bg-slate-800" /></div>
        </div>
    );
}


/** Title block used at the top of every feature page. */
export function PageHeader({ title, subtitle, action }) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export function SearchBox({ value, onChange, placeholder = 'Search...', className = '' }) {
    return (
        <div className={`relative ${className}`}>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input-field !pl-10" />
        </div>
    );
}

/** Pill filter row. `options` is a list of strings; the active one is highlighted. */
export function Chips({ options, value, onChange }) {
    return (
        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist">
            {options.map((o) => (
                <button key={o} role="tab" aria-selected={value === o} onClick={() => onChange(o)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition ${value === o
                        ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{o}</button>
            ))}
        </div>
    );
}

/** Company logo, or a coloured initial when there is no (working) logo URL. */
export function Avatar({ name = '?', src, className = 'h-12 w-12 text-base' }) {
    const [broken, setBroken] = React.useState(false);
    const hues = ['from-teal-500 to-emerald-500', 'from-indigo-500 to-violet-500', 'from-amber-500 to-orange-500', 'from-sky-500 to-blue-600', 'from-rose-500 to-pink-500'];
    const grad = hues[(name.charCodeAt(0) || 0) % hues.length];
    if (src && !broken) return <img src={src} alt="" onError={() => setBroken(true)} className={`${className} shrink-0 rounded-2xl bg-white object-contain p-1 ring-1 ring-slate-200 dark:ring-slate-700`} />;
    return <span className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} font-extrabold text-white`}>{name[0]?.toUpperCase()}</span>;
}

/** Markdown / HTML-ish text -> plain text for card excerpts. */
export const plainText = (s = '') => s.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`~\[\]()!-]+/g, ' ').replace(/\s+/g, ' ').trim();
export const readMinutes = (s = '') => Math.max(1, Math.round(plainText(s).split(' ').length / 200));

/** Labelled horizontal bars. items = [{ label, value }]; theme-aware. */
export function Bars({ items = [], empty = 'No data yet.', tone = 'from-brand-500 to-indigo-500' }) {
    if (!items.length) return <Empty>{empty}</Empty>;
    const max = Math.max(...items.map((i) => i.value), 1);
    return (
        <ul className="space-y-3">
            {items.map((i) => (
                <li key={i.label}>
                    <div className="mb-1 flex justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="truncate">{i.label}</span><span className="shrink-0">{i.value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all duration-700`} style={{ width: `${(i.value / max) * 100}%` }} /></div>
                </li>
            ))}
        </ul>
    );
}

/** Small area chart. points = [{ label, value }]. */
export function Trend({ points = [], height = 150 }) {
    if (points.length < 2) return <Empty>{points.length ? 'Need at least two days of data for a trend.' : 'No data yet.'}</Empty>;
    const W = 560, H = height, padX = 8, padTop = 12, padBottom = 22;
    const top = Math.max(...points.map((p) => p.value), 1);
    const x = (i) => padX + (i * (W - padX * 2)) / (points.length - 1);
    const y = (v) => H - padBottom - (v / top) * (H - padTop - padBottom);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${H - padBottom} L${x(0).toFixed(1)},${H - padBottom} Z`;
    const step = Math.ceil(points.length / 6);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Trend chart">
            {[0, 0.5, 1].map((t) => <line key={t} x1={padX} x2={W - padX} y1={y(top * t)} y2={y(top * t)} strokeDasharray="3 4" className="stroke-slate-200 dark:stroke-slate-700" />)}
            <path d={area} className="fill-brand-500/15" />
            <path d={line} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-500" />
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={x(i)} cy={y(p.value)} r="3.5" className="fill-brand-500"><title>{`${p.label}: ${p.value}`}</title></circle>
                    {i % step === 0 && <text x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" className="fill-slate-400">{p.label}</text>}
                </g>
            ))}
        </svg>
    );
}
