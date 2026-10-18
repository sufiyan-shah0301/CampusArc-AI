import { motion } from 'framer-motion';
import { CountUp } from './motion.jsx';

const SKILLS = [['React', true], ['JavaScript', true], ['Python', true]];

/** A designed preview of the resume-scan result: shows what the product does without needing a screenshot asset. */
export default function HeroCard() {
    const r = 44, c = 2 * Math.PI * r;
    return (
        <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-400/30 via-indigo-400/20 to-fuchsia-400/20 blur-3xl" aria-hidden />

            <div style={{ animationDelay: '0.2s' }} className="animate-rise card !rounded-[2rem] p-5 shadow-2xl shadow-brand-900/10 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-lg dark:bg-brand-900/40">🧾</span>
                        <div><p className="text-sm font-extrabold leading-tight text-slate-900 dark:text-white">Resume scan</p><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">sam-resume.pdf</p></div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Analysed
                    </span>
                </div>

                <div className="flex items-center gap-5">
                    <div className="relative h-28 w-28 shrink-0">
                        <svg viewBox="0 0 100 100" className="-rotate-90"><circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-slate-200 dark:stroke-slate-700" />
                            <motion.circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke="url(#heroGrad)" strokeDasharray={c}
                                initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - 0.82) }} transition={{ duration: 1.4, delay: 0.5, ease: 'easeOut' }} />
                            <defs><linearGradient id="heroGrad"><stop offset="0" stopColor="#0fa58f" /><stop offset="1" stopColor="#4f46e5" /></linearGradient></defs></svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl font-bold text-slate-900 dark:text-white"><CountUp value={82} /></span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ATS score</span></div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                        {[['Skills', 88], ['Experience', 74], ['Formatting', 79]].map(([k, v], i) => (
                            <div key={k}>
                                <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300"><span>{k}</span><span>{v}</span></div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 1, delay: 0.6 + i * 0.12 }} className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500" /></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="mb-2.5 flex items-center justify-between"><p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">React Developer Intern · Acme</p><span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">83% match</span></div>
                    <div className="flex flex-wrap gap-1.5">
                        {SKILLS.map(([s, have]) => <span key={s} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${have ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 line-through dark:bg-amber-900/40 dark:text-amber-200'}`}>{have ? '✓ ' : ''}{s}</span>)}
                    </div>
                </div>
            </div>

            <div style={{ animationDelay: '1.1s' }} className="animate-rise absolute -bottom-5 -right-5 hidden animate-float rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-xl [animation-delay:1.5s] sm:block dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Placement chance</p><p className="text-sm font-extrabold text-emerald-600">+24 pts with 1 internship 📈</p>
            </div>
        </div>
    );
}
