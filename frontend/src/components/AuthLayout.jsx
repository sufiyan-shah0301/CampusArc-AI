import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const POINTS = [
    ['📄', 'AI resume scanner', 'ATS score and the exact skills you are missing.'],
    ['🎙️', 'Voice mock interviews', 'Practise out loud and get scored feedback.'],
    ['🛡️', 'Fraud-checked jobs', 'Fake postings and phishing links get flagged.'],
];

/** Brand side of the split screen. A looping `hero.mp4` in /public plays behind the text. */
function BrandPanel() {
    const [video, setVideo] = useState(true);
    return (
        <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
            <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
            <div className="absolute -bottom-32 -right-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl" aria-hidden />
            {video && (
                <video className="absolute inset-0 h-full w-full object-cover opacity-60" src="/hero.mp4" autoPlay muted loop playsInline onError={() => setVideo(false)} aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/30 to-slate-950/80" aria-hidden />
            <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />

            <Link to="/" className="relative" aria-label="CampusArc home">
                <BrandLogo textClass="!text-white" />
            </Link>

            <div className="relative max-w-md">
                <h2 className="font-display text-4xl font-bold leading-tight tracking-tight text-white">
                    From campus to career,{' '}
                    <span className="bg-gradient-to-r from-brand-300 to-indigo-300 bg-clip-text text-transparent">powered by AI.</span>
                </h2>
                <ul className="mt-8 space-y-4">
                    {POINTS.map(([icon, t, d]) => (
                        <li key={t} className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg ring-1 ring-white/15">{icon}</span>
                            <span><span className="block text-sm font-bold text-white">{t}</span><span className="block text-sm text-slate-300">{d}</span></span>
                        </li>
                    ))}
                </ul>
            </div>

            <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} CampusArc</p>
        </aside>
    );
}

// [icon, left %, size px, duration s, delay s (negative = already mid-flight on load), sway px, opacity]
const FLOATERS = [
    ['🎒', 6, 34, 17, -2, 26, 0.5], ['📚', 16, 28, 21, -9, -22, 0.45], ['💻', 27, 36, 19, -5, 30, 0.5],
    ['🎓', 38, 30, 23, -14, -26, 0.5], ['✏️', 48, 24, 16, -7, 20, 0.45], ['💼', 58, 32, 20, -1, -28, 0.5],
    ['📝', 68, 26, 18, -11, 24, 0.45], ['🎒', 78, 28, 22, -16, -20, 0.4], ['📚', 88, 34, 17, -4, 28, 0.5],
    ['💻', 94, 24, 24, -19, -18, 0.4], ['🎓', 12, 22, 25, -13, 22, 0.35], ['💼', 52, 22, 26, -21, -24, 0.35],
];

/** Small study / career items rising slowly behind the form card (decorative, ignored by screen readers). */
function FloatingItems() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {FLOATERS.map(([icon, left, size, d, delay, dx, o], i) => (
                <span key={i} className="float-item" style={{ left: `${left}%`, fontSize: size, '--d': `${d}s`, '--delay': `${delay}s`, '--dx': `${dx}px`, '--o': o, '--r0': `${i % 2 ? -14 : 10}deg`, '--r1': `${i % 2 ? 14 : -10}deg` }}>{icon}</span>
            ))}
        </div>
    );
}
export default function AuthLayout({ children, title, subtitle }) {
    return (
        <div className="grid min-h-screen bg-slate-100 lg:grid-cols-2 dark:bg-slate-950">
            <BrandPanel />
            <main className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-8">
                <FloatingItems />
                <ThemeToggle className="absolute right-4 top-4 !h-9 !w-9" />
                <div className="animate-rise relative w-full max-w-[26rem]">
                    <Link to="/" className="mb-4 flex justify-center lg:hidden" aria-label="CampusArc home"><BrandLogo size="h-9 w-9" /></Link>
                    <div className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200 sm:p-7 dark:bg-slate-900 dark:ring-slate-700">
                        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
                        <p className="mb-5 mt-1 text-[13px] text-slate-600 dark:text-slate-300">{subtitle}</p>
                        {children}
                    </div>
                    <Link to="/" className="mt-4 block text-center text-xs font-semibold text-slate-500 hover:text-brand-600 lg:hidden dark:text-slate-400">← Back to home</Link>
                </div>
            </main>
        </div>
    );
}
export function Field({ label, id, hint, className = '', ...props }) {
    return (
        <div className={className}>
            <label htmlFor={id} className="mb-1 block text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</label>
            <input id={id} className="input-field !py-2.5" {...props} />
            {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
    );
}

export function PasswordField({ label, id, hint, right, className = '', ...props }) {
    const [show, setShow] = useState(false);
    return (
        <div className={className}>
            <div className="mb-1 flex items-center justify-between">
                <label htmlFor={id} className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</label>
                {right}
            </div>
            <div className="relative">
                <input id={id} type={show ? 'text' : 'password'} className="input-field !py-2.5 pr-14" {...props} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-700">
                    {show ? 'Hide' : 'Show'}
                </button>
            </div>
            {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
    );
}
