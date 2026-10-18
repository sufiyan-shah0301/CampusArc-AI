import { useId } from 'react';

/**
 * CampusArc mark: graduation cap over a student rising out of an open book. Indigo = learning, teal = growth,
 * gold tassel = the accent. Two colourways (light / dark page) swap with Tailwind's `dark` class.
 * Keep the geometry in sync with public/logo.svg and public/favicon.svg.
 */
const PALETTE = {
    light: { d1: '#4338ca', d2: '#1e1b6e', t1: '#2dd4bf', t2: '#0b8574', line: '#4338ca', gold: '#f59e0b' },
    dark: { d1: '#a5b4fc', d2: '#6366f1', t1: '#2dd4bf', t2: '#14b8a6', line: '#a5b4fc', gold: '#fbbf24' },
};

function Mark({ mode, className, title }) {
    const id = useId();
    const c = PALETTE[mode];
    const dk = `url(#${id}-dk)`;
    const tl = `url(#${id}-tl)`;
    return (
        <svg viewBox="14 14 176 180" className={className} role="img" aria-label={title}>
            <defs>
                <linearGradient id={`${id}-dk`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.d1} /><stop offset="1" stopColor={c.d2} /></linearGradient>
                <linearGradient id={`${id}-tl`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.t1} /><stop offset="1" stopColor={c.t2} /></linearGradient>
            </defs>
            <polygon points="100,20 160,47 100,72 40,47" fill={dk} />
            <path d="M66 62V86C84 72 116 72 134 86V62L100 76Z" fill={dk} />
            <path d="M152 52V80" stroke={c.line} strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="152" cy="82" r="3.4" fill={c.line} />
            <path d="M149.5 86h5l1.5 11h-8z" fill={c.gold} />
            <circle cx="100" cy="102" r="10" fill={dk} />
            <path d="M46 92C74 100 106 122 106 160C106 169 105 175 103 180C97 167 88 160 80 152C70 140 64 106 46 92Z" fill={dk} />
            <path d="M146 94C122 99 108 118 104 130C108 142 108 162 105 178C113 160 121 136 131 120C137 110 142 102 146 94Z" fill={tl} />
            <path d="M18 152C50 150 86 162 102 188C70 172 40 168 22 170Z" fill={dk} />
            <path d="M32 134C62 134 92 148 102 174C80 158 56 150 32 148Z" fill={dk} />
            <path d="M186 152C154 150 118 162 102 188C134 172 164 168 182 170Z" fill={tl} />
            <path d="M172 134C142 134 112 148 102 174C124 158 148 150 172 148Z" fill={tl} />
        </svg>
    );
}

export function BrandMark({ className = 'h-10 w-10', title = 'CampusArc logo' }) {
    return (
        <>
            <Mark mode="light" className={`${className} dark:hidden`} title={title} />
            <Mark mode="dark" className={`${className} hidden dark:block`} title={title} />
        </>
    );
}

/** Mark + wordmark. `stacked` puts the name under the mark (for hero / auth screens). */
export default function BrandLogo({ className = '', textClass = '', stacked = false, size }) {
    const mark = size || (stacked ? 'h-16 w-16' : 'h-10 w-10');
    return (
        <span className={`inline-flex ${stacked ? 'flex-col items-center gap-2' : 'items-center gap-2.5'} ${className}`}>
            <BrandMark className={mark} />
            <span className={`font-display font-bold tracking-tight text-slate-900 dark:text-white ${stacked ? 'text-2xl' : 'text-xl'} ${textClass}`}>
                Campus<span className="text-brand-600 dark:text-brand-300">Arc</span>
            </span>
        </span>
    );
}
