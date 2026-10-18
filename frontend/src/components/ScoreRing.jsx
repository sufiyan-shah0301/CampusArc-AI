import React from 'react';

const colorFor = (pct) => (pct >= 75 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626');

/** Circular score indicator, `value` in 0-100. */
export default function ScoreRing({ value = 0, label, size = 112 }) {
    const pct = Math.max(0, Math.min(100, Math.round(value)));
    const stroke = 10;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${pct} out of 100`}>
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
                    <circle cx={size / 2} cy={size / 2} r={r} stroke={colorFor(pct)} strokeWidth={stroke} fill="none"
                        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-gray-800">{pct}</span>
            </div>
            {label && <span className="mt-2 text-sm font-semibold text-gray-600">{label}</span>}
        </div>
    );
}

export const Bar = ({ label, value }) => (
    <div>
        <div className="flex justify-between text-sm mb-1">
            <span className="capitalize text-gray-700">{label}</span>
            <span className="font-semibold text-gray-800">{value}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: colorFor(value) }} />
        </div>
    </div>
);
