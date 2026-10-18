import React from 'react';

/** Horizontal bar list: items = [{ label, value, hint? }] */
export function BarList({ items = [], color = '#0d9488', suffix = '', empty = 'No data yet.' }) {
    if (!items.length) return <p className="text-sm text-gray-400">{empty}</p>;
    const max = Math.max(...items.map((i) => i.value), 1);
    return (
        <ul className="space-y-2">
            {items.map((i) => (
                <li key={i.label} title={i.hint}>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 truncate pr-2">{i.label}</span>
                        <span className="font-semibold text-gray-800">{i.value}{suffix}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color || color, transition: 'width .6s ease' }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** Simple line chart: points = [{ label, value }] */
export function LineChart({ points = [], height = 140, max, color = '#0d9488', yLabel = '' }) {
    if (points.length < 2) return <p className="text-sm text-gray-400">{points.length === 1 ? 'Need at least two data points for a trend.' : 'No data yet.'}</p>;
    const W = 520, H = height, pad = 24;
    const top = max ?? Math.max(...points.map((p) => p.value), 1);
    const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1);
    const y = (v) => H - pad - (v / top) * (H - pad * 2);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Trend chart ${yLabel}`}>
            {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={W - pad} y1={y(top * t)} y2={y(top * t)} stroke="#e5e7eb" strokeDasharray="3 3" />)}
            <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={x(i)} cy={y(p.value)} r="4.5" fill={color}><title>{`${p.label}: ${p.value}`}</title></circle>
                    {(points.length <= 8 || i % Math.ceil(points.length / 6) === 0) && <text x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#6b7280">{p.label}</text>}
                </g>
            ))}
        </svg>
    );
}

export const Panel = ({ title, action, children, className = '' }) => (
    <section className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
        {(title || action) && <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-800">{title}</h2>{action}</div>}
        {children}
    </section>
);

export const Stat = ({ label, value, hint, tone = 'text-gray-800' }) => (
    <div className="bg-gray-50 rounded-lg p-3" title={hint}>
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
);
