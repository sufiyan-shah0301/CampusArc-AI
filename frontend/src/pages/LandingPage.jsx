import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import LandingNavbar from '../components/landing/LandingNavbar.jsx';
import LandingFooter from '../components/landing/LandingFooter.jsx';
import HeroCard from '../components/landing/HeroCard.jsx';
import { CountUp, Rise } from '../components/landing/motion.jsx';
import { STATS } from '../components/landing/data.js';
import { Contact, Faq, Features, HowItWorks, Models, Roles, Security, TechStrip } from '../components/landing/Sections.jsx';

function Background() {
    return (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-slate-950" aria-hidden>
            <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
            <div className="absolute -left-24 top-10 h-80 w-80 animate-blob rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-600/20" />
            <div className="absolute right-0 top-40 h-96 w-96 animate-blob rounded-full bg-indigo-300/40 blur-3xl [animation-delay:-6s] dark:bg-indigo-600/20" />
            <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-blob rounded-full bg-fuchsia-200/40 blur-3xl [animation-delay:-12s] dark:bg-fuchsia-700/10" />
        </div>
    );
}

export default function LandingPage() {
    const { user } = useAuth();
    return (
        <div className="min-h-screen overflow-x-clip text-slate-900 dark:text-slate-100">
            <Background />
            <LandingNavbar />

            <main id="main">
                {/* ---------------------------------------------------------------- hero */}
                <section className="relative isolate px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36">
                    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,black_75%,transparent)]" aria-hidden>
                        <img src="/hero-poster.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <video className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" src="/hero.mp4" poster="/hero-poster.jpg" autoPlay muted loop playsInline preload="auto" />
                        <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/75" />
                        <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent dark:from-slate-950/70 dark:via-slate-950/20" />
                    </div>
                    <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
                        <div>
                            <Rise as="span" delay={0} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-brand-700 shadow-sm backdrop-blur dark:border-brand-700/50 dark:bg-slate-900/70 dark:text-brand-200">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> AI-powered Training &amp; Placement Cell
                            </Rise>

                            <Rise as="h1" delay={0.08} className="mt-6 font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl xl:text-7xl dark:text-white">
                                From campus to career,{' '}
                                <span className="bg-gradient-to-r from-brand-600 via-teal-500 to-indigo-600 bg-clip-text text-transparent dark:from-brand-300 dark:via-teal-300 dark:to-indigo-300">powered by AI.</span>
                            </Rise>

                            <Rise as="p" delay={0.18} className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                                CampusArc connects students with verified recruiters and gives every student an AI career coach: resume scanning, voice mock interviews, placement predictions and fraud-checked jobs.
                            </Rise>

                            <Rise delay={0.28} className="mt-8 flex flex-col gap-3 sm:flex-row">
                                {user ? (
                                    <Link to="/dashboard" className="btn-primary !px-8 !py-3.5 text-base">Open your dashboard →</Link>
                                ) : (
                                    <>
                                        <Link to="/register" className="btn-primary !px-8 !py-3.5 text-base">Get started free →</Link>
                                        <Link to="/login" className="btn-ghost !px-8 !py-3.5 text-base">Log in</Link>
                                    </>
                                )}
                            </Rise>
                            <Rise as="p" delay={0.34} className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">No credit card · Works on your phone · You control your data</Rise>

                            <Rise as="dl" delay={0.42} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {STATS.map((s) => (
                                    <div key={s.label} className="card !rounded-2xl p-4">
                                        <dt className="sr-only">{s.label}</dt>
                                        <dd className="font-display text-2xl font-bold text-brand-600 dark:text-brand-300"><CountUp value={s.value} decimals={s.decimals || 0} suffix={s.suffix || ''} /></dd>
                                        <p className="mt-0.5 text-[10px] font-extrabold uppercase leading-snug tracking-wide text-slate-500 dark:text-slate-400" aria-hidden>{s.label}</p>
                                    </div>
                                ))}
                            </Rise>
                        </div>

                        <HeroCard />
                    </div>
                </section>

                <TechStrip />
                <Roles />
                <Features />
                <Models />
                <HowItWorks />
                <Security />
                <Faq />
                <Contact />
            </main>

            <LandingFooter />
        </div>
    );
}
