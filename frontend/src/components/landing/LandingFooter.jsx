import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo.jsx';

const COLS = [
    { title: 'Product', links: [['Features', '#features'], ['AI & ML', '#ai'], ['How it works', '#how'], ['Security', '#security']] },
    { title: 'Account', links: [['Log in', '/login', true], ['Create account', '/register', true], ['Forgot password', '/forgot-password', true]] },
    { title: 'Company', links: [['About', '/about', true], ['Privacy policy', '/privacy', true], ['Contact', '#contact']] },
];

export default function LandingFooter() {
    return (
        <footer className="border-t border-slate-200/70 bg-white/70 px-4 pb-8 pt-14 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mx-auto max-w-7xl">
                <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
                    <div>
                        <BrandLogo />
                        <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">An AI-powered Training & Placement Cell: the bridge between students and recruiters, built to be useful and honest.</p>
                        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />All systems running</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                        {COLS.map((c) => (
                            <nav key={c.title} aria-label={c.title}>
                                <h4 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{c.title}</h4>
                                <ul className="mt-4 space-y-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                                    {c.links.map(([label, to, route]) => (
                                        <li key={label}>{route ? <Link to={to} className="hover:text-brand-600 dark:hover:text-brand-300">{label}</Link> : <a href={to} className="hover:text-brand-600 dark:hover:text-brand-300">{label}</a>}</li>
                                    ))}
                                </ul>
                            </nav>
                        ))}
                    </div>
                </div>
                <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 text-xs font-bold text-slate-500 sm:flex-row dark:border-slate-800">
                    <p>© {new Date().getFullYear()} CampusArc</p>
                    <p className="flex flex-wrap justify-center gap-x-3 uppercase tracking-widest"><span className="text-sky-600">React</span><span className="text-emerald-600">FastAPI</span><span className="text-green-600">MongoDB</span><span className="text-orange-500">scikit-learn</span></p>
                </div>
            </div>
        </footer>
    );
}
