import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import BrandLogo from './BrandLogo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AssistantWidget from './AssistantWidget.jsx';
import NotificationBell from './NotificationBell.jsx';
import Icon from './shell/Icon.jsx';
import { ACCOUNT, NAV, titleFor } from './shell/nav.js';

const linkClass = ({ isActive }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
        ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200/70 dark:bg-brand-900/30 dark:text-brand-200 dark:ring-brand-700/40'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`;

const initials = (u) => (u?.displayName || u?.email || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

function Sidebar({ nav, user, onNavigate, onLogout }) {
    return (
        <div className="flex h-full flex-col">
            <div className="px-5 py-5"><Link to="/" onClick={onNavigate} aria-label="CampusArc home"><BrandLogo size="h-9 w-9" /></Link></div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Main">
                {nav.groups.map((g) => (
                    <div key={g.label}>
                        <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{g.label}</p>
                        <div className="space-y-0.5">
                            {g.items.map(([to, label, icon]) => (
                                <NavLink key={to} to={to} end={to === '/dashboard' || to === '/admin'} onClick={onNavigate} className={linkClass}>
                                    <Icon name={icon} className="h-[18px] w-[18px] shrink-0" />{label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
                <AccountMenu user={user} onLogout={onLogout} onNavigate={onNavigate} variant="card" />
            </div>
        </div>
    );
}

/** Profile / Security / Log out popup. `avatar` = round button in the top bar, `card` = user card at the bottom of the sidebar. */
function AccountMenu({ user, onLogout, onNavigate, variant = 'avatar' }) {
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    useEffect(() => {
        const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    const isCard = variant === 'card';
    const pick = () => { setOpen(false); onNavigate?.(); };
    return (
        <div className="relative" ref={box}>
            {isCard ? (
                <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800 ${open ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-xs font-extrabold text-white">{initials(user)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">{user.displayName || 'User'}</span><span className="block truncate text-[11px] capitalize text-slate-500">{user.role}</span></span>
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 15l6-6 6 6" /></svg>
                </button>
            ) : (
                <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-xs font-extrabold text-white shadow-sm transition hover:opacity-90">{initials(user)}</button>
            )}
            {open && (
                <div role="menu" className={`absolute z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${isCard ? 'inset-x-0 bottom-full mb-2' : 'right-0 top-12 w-56'}`}>
                    {!isCard && <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800"><p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{user.displayName}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>}
                    {ACCOUNT.map(([to, label, icon]) => (
                        <Link key={to} to={to} role="menuitem" onClick={pick} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><Icon name={icon} className="h-4 w-4" />{label}</Link>
                    ))}
                    <button role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"><Icon name="logout" className="h-4 w-4" />Log out</button>
                </div>
            )}
        </div>
    );
}
/** Signed-in shell: sidebar on desktop, top bar + bottom tabs + drawer on phones. */
function AppShell({ user }) {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [drawer, setDrawer] = useState(false);
    const nav = NAV[user.role] || NAV.student;
    const title = titleFor(user.role, pathname);

    useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [pathname]);
    useEffect(() => {
        document.body.style.overflow = drawer ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [drawer]);

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
                <Sidebar nav={nav} user={user} onLogout={handleLogout} />
            </aside>

            {drawer && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-label="Close menu" onClick={() => setDrawer(false)} />
                    <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-2xl dark:bg-slate-900">
                        <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="x" /></button>
                        <Sidebar nav={nav} user={user} onNavigate={() => setDrawer(false)} onLogout={handleLogout} />
                    </aside>
                </div>
            )}

            <div className="lg:pl-64">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-lg sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
                    <button onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"><Icon name="menu" className="h-6 w-6" /></button>
                    <Link to="/" className="lg:hidden" aria-label="CampusArc home"><BrandLogo size="h-8 w-8" textClass="!text-lg" /></Link>
                    <h2 className="hidden font-display text-lg font-bold tracking-tight lg:block">{title}</h2>
                    <div className="ml-auto flex items-center gap-2">
                        <ThemeToggle />
                        <NotificationBell />
                        <AccountMenu user={user} onLogout={handleLogout} />
                    </div>
                </header>

                <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
                    <Outlet />
                </main>
            </div>

            <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden dark:border-slate-800 dark:bg-slate-900/95" aria-label="Quick navigation">
                {nav.tabs.map(([to, label, icon]) => (
                    <NavLink key={to} to={to} end={to === '/dashboard' || to === '/admin'}
                        className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        <Icon name={icon} className="h-5 w-5" />{label}
                    </NavLink>
                ))}
                <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400"><Icon name="grid" className="h-5 w-5" />More</button>
            </nav>
            <AssistantWidget />
        </div>
    );
}

/** Plain shell for signed-out visitors on the public info pages (about / contact / privacy). */
function PublicShell() {
    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
            <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8 dark:border-slate-800 dark:bg-slate-900">
                <Link to="/" aria-label="CampusArc home"><BrandLogo /></Link>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Link to="/login" className="btn-ghost !px-4 !py-2">Log in</Link>
                    <Link to="/register" className="btn-primary !px-4 !py-2">Get started</Link>
                </div>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6"><Outlet /></main>
            <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-800">
                <p>© {new Date().getFullYear()} CampusArc</p>
                <div className="mt-2 space-x-4">
                    <Link to="/about" className="hover:text-brand-600">About</Link>
                    <Link to="/contact" className="hover:text-brand-600">Contact</Link>
                    <Link to="/privacy" className="hover:text-brand-600">Privacy</Link>
                </div>
            </footer>
        </div>
    );
}

export default function AppLayout() {
    const { user } = useAuth();
    return user ? <AppShell user={user} /> : <PublicShell />;
}
