import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo.jsx';
import ThemeToggle from '../ThemeToggle.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { NAV_LINKS } from './data.js';

export default function LandingNavbar() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    const cta = user
        ? <Link to="/dashboard" className="btn-primary !py-2.5">Open dashboard</Link>
        : <><Link to="/login" className="btn-ghost !py-2.5">Log in</Link><Link to="/register" className="btn-primary !py-2.5">Get started</Link></>;

    return (
        <header className={`fixed inset-x-0 top-0 z-50 transition ${scrolled || open ? 'border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/95' : 'bg-transparent'}`}>
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
            <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6" aria-label="Main">
                <Link to="/" aria-label="CampusArc home"><BrandLogo /></Link>

                <ul className="hidden items-center gap-1 lg:flex">
                    {NAV_LINKS.map((l) => (
                        <li key={l.href}><a href={l.href} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-brand-300">{l.label}</a></li>
                    ))}
                </ul>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <div className="hidden items-center gap-2 sm:flex">{cta}</div>
                    <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label="Toggle menu"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-700 lg:hidden dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
                    </button>
                </div>
            </nav>

            {open && (
                <div id="mobile-menu" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200/70 bg-white px-4 pb-6 pt-3 lg:hidden dark:border-slate-700/60 dark:bg-slate-950">
                    <ul className="grid gap-1">
                        {NAV_LINKS.map((l) => (
                            <li key={l.href}><a href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base font-bold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800">{l.label}</a></li>
                        ))}
                    </ul>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">{cta}</div>
                </div>
            )}
        </header>
    );
}
