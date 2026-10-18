import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { FadeUp } from './motion.jsx';
import { FAQ, FEATURES, MODELS, ROLES, SECURITY, STEPS, TECH } from './data.js';

// full class names (not built dynamically) so Tailwind can see them
const TONE = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-200 dark:border-brand-700/50',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-700/50',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700/50',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700/50',
    violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-700/50',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/50',
    sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700/50',
    teal: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-700/50',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-200 dark:border-fuchsia-700/50',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700/50',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-200 dark:border-cyan-700/50',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
};

const Heading = ({ eyebrow, title, sub, center }) => (
    <FadeUp className={center ? 'mx-auto max-w-3xl text-center' : ''}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="section-title">{title}</h2>
        {sub && <p className={`section-sub ${center ? 'mx-auto' : ''}`}>{sub}</p>}
    </FadeUp>
);

const Section = ({ id, className = '', children }) => <section id={id} className={`relative scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 ${className}`}><div className="mx-auto max-w-7xl">{children}</div></section>;

export function TechStrip() {
    const items = [...TECH, ...TECH];
    return (
        <div className="relative overflow-hidden border-y border-slate-200/70 bg-white/60 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/40" aria-label="Technology used">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-sm font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {items.map((t, i) => <span key={i} className="flex items-center gap-10">{t}<span className="text-brand-400">◆</span></span>)}
            </div>
        </div>
    );
}

export function Roles() {
    return (
        <Section id="roles">
            <Heading center eyebrow="One platform, three roles" title="Built for everyone in the placement process" sub="Students prepare, recruiters hire, the placement cell oversees. Each gets tools that fit." />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
                {ROLES.map((r, i) => (
                    <FadeUp key={r.title} delay={i * 0.08} className="h-full">
                        <article className="card group flex h-full flex-col p-7 hover:-translate-y-1 hover:shadow-xl">
                            <span className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${r.tone} text-2xl shadow-lg`}>{r.icon}</span>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">{r.title}</h3>
                            <ul className="mt-4 flex-1 space-y-2.5">
                                {r.points.map((p) => <li key={p} className="flex gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300"><span className="mt-0.5 text-brand-500">✓</span>{p}</li>)}
                            </ul>
                            <Link to={r.to} className="btn-ghost mt-6 w-full">{r.cta} →</Link>
                        </article>
                    </FadeUp>
                ))}
            </div>
        </Section>
    );
}

export function Features() {
    return (
        <Section id="features" className="bg-white/50 dark:bg-slate-900/30">
            <Heading eyebrow="Features" title="Everything from first scan to final offer" sub="Twelve tools that work together, from your first resume scan to the offer letter." />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f, i) => (
                    <FadeUp key={f.title} delay={(i % 3) * 0.07} className="h-full">
                        <article className="card group flex h-full flex-col p-5 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl sm:p-6 dark:hover:border-brand-500/50">
                            <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
                                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${TONE[f.color]}`}>{f.icon}</span>
                                <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${TONE[f.color]}`}>{f.tag}</span>
                            </div>
                            <h3 className="font-display text-lg font-bold text-slate-900 transition group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{f.title}</h3>
                            <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{f.desc}</p>
                            <div className="mt-5 hidden border-t border-slate-100 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:block dark:border-slate-800">Powered by <span className="text-slate-700 dark:text-slate-200">{f.chip}</span></div>
                        </article>
                    </FadeUp>
                ))}
            </div>
        </Section>
    );
}

export function Models() {
    return (
        <Section id="ai">
            <Heading center eyebrow="AI & machine learning" title="Real models. Real numbers." sub="Every figure is measured on data the model never saw, and the admin dashboard shows where each model is weak too. No inflated claims." />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {MODELS.map((m, i) => (
                    <FadeUp key={m.name} delay={(i % 3) * 0.07} className="h-full">
                        <article className="card h-full p-6">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white">{m.name}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{m.algo}</p>
                            <p className={`mt-5 font-display text-5xl font-bold tracking-tight ${m.tone}`}>{m.metric}</p>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{m.unit}</p>
                            <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">Kaggle data: {m.data}</p>
                        </article>
                    </FadeUp>
                ))}
            </div>
        </Section>
    );
}

export function HowItWorks() {
    return (
        <Section id="how" className="bg-white/50 dark:bg-slate-900/30">
            <Heading eyebrow="How it works" title="From sign-up to offer in four steps" />
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((s, i) => (
                    <FadeUp key={s.n} delay={i * 0.08} className="h-full">
                        <li className="card relative h-full list-none p-6">
                            <div className="mb-4 flex items-center justify-between"><span className="font-display text-3xl font-bold text-brand-500/40">{s.n}</span><span className="text-3xl">{s.icon}</span></div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{s.desc}</p>
                        </li>
                    </FadeUp>
                ))}
            </ol>
        </Section>
    );
}

export function Security() {
    return (
        <Section id="security">
            <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
                <FadeUp>
                    <span className="eyebrow">Security & privacy</span>
                    <h2 className="section-title">Safe for students. Trusted by recruiters.</h2>
                    <p className="section-sub">Scams and fake profiles are the biggest risk in campus hiring, so protection is part of the platform, not an add-on.</p>
                    <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700/50 dark:bg-emerald-900/20">
                        <span className="text-2xl">🛡️</span><p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">We never sell or share your personal data.</p>
                    </div>
                </FadeUp>
                <div className="grid gap-4 sm:grid-cols-2">
                    {SECURITY.map((s, i) => (
                        <FadeUp key={s.title} delay={(i % 2) * 0.07}>
                            <div className="card h-full p-5"><span className="text-2xl">{s.icon}</span><h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">{s.title}</h3><p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{s.desc}</p></div>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </Section>
    );
}

export function Faq() {
    const [open, setOpen] = useState(0);
    return (
        <Section id="faq" className="bg-white/50 dark:bg-slate-900/30">
            <Heading center eyebrow="FAQ" title="Questions, answered" />
            <div className="mx-auto mt-10 max-w-3xl space-y-3">
                {FAQ.map((f, i) => (
                    <div key={f.q} className="card overflow-hidden !rounded-2xl">
                        <h3>
                            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} aria-controls={`faq-${i}`}
                                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-bold text-slate-900 dark:text-white">
                                {f.q}<span className={`text-xl text-brand-600 transition-transform ${open === i ? 'rotate-45' : ''}`}>+</span>
                            </button>
                        </h3>
                        {open === i && <p id={`faq-${i}`} className="px-5 pb-5 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{f.a}</p>}
                    </div>
                ))}
            </div>
        </Section>
    );
}

export function Contact() {
    const [form, setForm] = useState({ name: '', email: '', message: '' });
    const [state, setState] = useState('idle'); // idle | sending | sent
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setState('sending');
        try { await api.post('/api/contact', form); setState('sent'); setForm({ name: '', email: '', message: '' }); }
        catch (err) { setState('idle'); toast.error(err.status === 429 ? 'Too many messages. Please wait a minute.' : (err.message || 'Could not send your message.')); }
    };

    return (
        <Section id="contact">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
                <FadeUp>
                    <span className="eyebrow">Contact</span>
                    <h2 className="section-title">Talk to the team</h2>
                    <p className="section-sub">Questions about the platform, a college partnership or a bug to report? Send a message and we'll get back to you.</p>
                    <ul className="mt-8 space-y-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {[['⏱️', 'Replies within 2 working days'], ['🎓', 'Colleges and placement cells welcome'], ['🐞', 'Found a bug? Tell us what you did and what you saw']].map(([i, t]) => (
                            <li key={t} className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg dark:border-slate-700 dark:bg-slate-800">{i}</span>{t}</li>
                        ))}
                    </ul>
                </FadeUp>
                <FadeUp delay={0.1}>
                    {state === 'sent' ? (
                        <div className="card flex flex-col items-center p-10 text-center" role="status">
                            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl dark:bg-emerald-900/40">✅</span>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">Message sent</h3>
                            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Thanks for reaching out. We'll reply to your e-mail soon.</p>
                            <button type="button" onClick={() => setState('idle')} className="btn-ghost mt-6">Send another</button>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Name<input required maxLength={100} value={form.name} onChange={set('name')} className="input-field mt-2 normal-case" placeholder="Your name" autoComplete="name" /></label>
                                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">E-mail<input required type="email" value={form.email} onChange={set('email')} className="input-field mt-2 normal-case" placeholder="you@college.edu" autoComplete="email" /></label>
                            </div>
                            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-500">Message<textarea required rows={5} maxLength={3000} value={form.message} onChange={set('message')} className="input-field mt-2 resize-none normal-case" placeholder="How can we help?" /></label>
                            <button disabled={state === 'sending'} className="btn-primary w-full disabled:opacity-60">{state === 'sending' ? 'Sending…' : 'Send message'}</button>
                        </form>
                    )}
                </FadeUp>
            </div>
        </Section>
    );
}
