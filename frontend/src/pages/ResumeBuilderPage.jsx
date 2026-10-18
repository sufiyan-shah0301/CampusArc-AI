import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const KEY = (uid) => `cb_resume_draft_${uid}`;
const blankExp = () => ({ role: '', company: '', dates: '', bullets: '' });
const blankEdu = () => ({ degree: '', school: '', year: '' });
const blankProj = () => ({ name: '', tech: '', desc: '' });

const field = 'w-full p-2 border rounded-md text-sm';

export default function ResumeBuilderPage() {
    const { user } = useAuth();
    const p = user.profile || {};
    const a = p.academic || {};
    const initial = useMemo(() => ({
        name: user.displayName || '', email: user.email || '', phone: '', location: p.location || '', links: [p.linkedinUrl, p.portfolioUrl].filter(Boolean).join(' | '),
        headline: p.headline || '', summary: p.bio || '', skills: (p.skills || []).join(', '),
        experience: [blankExp()], education: [{ degree: a.stream ? `B.Tech, ${a.stream}` : '', school: '', year: a.cgpa ? `CGPA ${a.cgpa}` : '' }], projects: [blankProj()], template: 'classic',
    }), [user.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    const [d, setD] = useState(() => {
        try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY(user.uid)) || '{}') }; } catch { return initial; }
    });
    const [busy, setBusy] = useState('');

    useEffect(() => { try { localStorage.setItem(KEY(user.uid), JSON.stringify(d)); } catch { /* storage unavailable */ } }, [d, user.uid]);

    const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
    const setItem = (list, i, k) => (e) => setD((x) => ({ ...x, [list]: x[list].map((it, j) => (j === i ? { ...it, [k]: e.target.value } : it)) }));
    const add = (list, blank) => setD((x) => ({ ...x, [list]: [...x[list], blank()] }));
    const remove = (list, i) => setD((x) => ({ ...x, [list]: x[list].filter((_, j) => j !== i) }));

    const improve = async (text, kind, apply, id) => {
        if (!text || text.trim().length < 5) return toast.error('Write a few words first.');
        setBusy(id);
        try { apply((await api.post('/api/ai/improve', { text, kind })).text); toast.success('Rewritten. Review it before using.'); }
        catch (err) { toast.error(err.message || 'AI is unavailable.'); } finally { setBusy(''); }
    };

    const skills = d.skills.split(',').map((s) => s.trim()).filter(Boolean);
    const classic = d.template === 'classic';

    return (
        <div className="max-w-7xl mx-auto">
            <style>{`@media print { body * { visibility: hidden !important; } #resume-preview, #resume-preview * { visibility: visible !important; } #resume-preview { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } @page { margin: 12mm; } }`}</style>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div><h1 className="text-3xl font-black text-slate-800">Resume Builder</h1><p className="text-slate-500">Pre-filled from your profile. Saved in this browser as you type.</p></div>
                <div className="flex gap-3">
                    <select value={d.template} onChange={set('template')} aria-label="Template" className="border rounded-md px-3 py-2 bg-white"><option value="classic">Classic</option><option value="modern">Modern</option></select>
                    <button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2 rounded-md">Download PDF</button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* ------------------------------------ editor */}
                <div className="space-y-5">
                    <section className="bg-white rounded-xl shadow-md p-5 space-y-3">
                        <h2 className="font-bold text-gray-800">Basics</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <input className={field} value={d.name} onChange={set('name')} placeholder="Full name" aria-label="Full name" />
                            <input className={field} value={d.headline} onChange={set('headline')} placeholder="Headline, e.g. Frontend Developer" aria-label="Headline" />
                            <input className={field} value={d.email} onChange={set('email')} placeholder="Email" aria-label="Email" />
                            <input className={field} value={d.phone} onChange={set('phone')} placeholder="Phone" aria-label="Phone" />
                            <input className={field} value={d.location} onChange={set('location')} placeholder="Location" aria-label="Location" />
                            <input className={field} value={d.links} onChange={set('links')} placeholder="LinkedIn | Portfolio" aria-label="Links" />
                        </div>
                    </section>

                    <section className="bg-white rounded-xl shadow-md p-5 space-y-3">
                        <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">Summary</h2>
                            <button disabled={busy === 'summary'} onClick={() => improve(d.summary, 'summary', (t) => setD((x) => ({ ...x, summary: t })), 'summary')} className="text-sm font-semibold text-teal-700 hover:underline disabled:text-gray-400">{busy === 'summary' ? 'Rewriting…' : '✨ Improve with AI'}</button></div>
                        <textarea className={field} rows={4} value={d.summary} onChange={set('summary')} aria-label="Summary" />
                        <h2 className="font-bold text-gray-800 pt-2">Skills <span className="text-xs font-normal text-gray-400">comma separated</span></h2>
                        <input className={field} value={d.skills} onChange={set('skills')} aria-label="Skills" />
                    </section>

                    <section className="bg-white rounded-xl shadow-md p-5 space-y-4">
                        <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">Experience / internships</h2><button onClick={() => add('experience', blankExp)} className="text-sm font-semibold text-teal-700 hover:underline">+ Add</button></div>
                        {d.experience.map((e, i) => (
                            <div key={i} className="border rounded-lg p-3 space-y-2">
                                <div className="grid grid-cols-3 gap-2"><input className={field} placeholder="Role" aria-label="Role" value={e.role} onChange={setItem('experience', i, 'role')} /><input className={field} placeholder="Company" aria-label="Company" value={e.company} onChange={setItem('experience', i, 'company')} /><input className={field} placeholder="Jun 2025 - Aug 2025" aria-label="Dates" value={e.dates} onChange={setItem('experience', i, 'dates')} /></div>
                                <textarea className={field} rows={3} placeholder="One achievement per line" aria-label="Achievements" value={e.bullets} onChange={setItem('experience', i, 'bullets')} />
                                <div className="flex justify-between text-sm">
                                    <button disabled={busy === `e${i}`} onClick={() => { const lines = e.bullets.split('\n'); const last = lines.length - 1; improve(lines[last], 'bullet', (t) => setD((x) => ({ ...x, experience: x.experience.map((it, j) => (j === i ? { ...it, bullets: [...lines.slice(0, last), t].join('\n') } : it)) })), `e${i}`); }} className="font-semibold text-teal-700 hover:underline disabled:text-gray-400">{busy === `e${i}` ? 'Rewriting…' : '✨ Rewrite last line (STAR)'}</button>
                                    {d.experience.length > 1 && <button onClick={() => remove('experience', i)} className="text-red-600 hover:underline">Remove</button>}
                                </div>
                            </div>
                        ))}
                    </section>

                    <section className="bg-white rounded-xl shadow-md p-5 space-y-4">
                        <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">Education</h2><button onClick={() => add('education', blankEdu)} className="text-sm font-semibold text-teal-700 hover:underline">+ Add</button></div>
                        {d.education.map((e, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 items-center"><input className={field} placeholder="Degree" aria-label="Degree" value={e.degree} onChange={setItem('education', i, 'degree')} /><input className={field} placeholder="College" aria-label="College" value={e.school} onChange={setItem('education', i, 'school')} /><div className="flex gap-2"><input className={field} placeholder="2022-2026" aria-label="Year" value={e.year} onChange={setItem('education', i, 'year')} />{d.education.length > 1 && <button onClick={() => remove('education', i)} aria-label="Remove education" className="text-red-600">×</button>}</div></div>
                        ))}
                        <div className="flex items-center justify-between pt-2"><h2 className="font-bold text-gray-800">Projects</h2><button onClick={() => add('projects', blankProj)} className="text-sm font-semibold text-teal-700 hover:underline">+ Add</button></div>
                        {d.projects.map((e, i) => (
                            <div key={i} className="border rounded-lg p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2"><input className={field} placeholder="Project name" aria-label="Project name" value={e.name} onChange={setItem('projects', i, 'name')} /><input className={field} placeholder="Tech used" aria-label="Tech used" value={e.tech} onChange={setItem('projects', i, 'tech')} /></div>
                                <textarea className={field} rows={2} placeholder="What it does and your impact" aria-label="Project description" value={e.desc} onChange={setItem('projects', i, 'desc')} />
                                {d.projects.length > 1 && <button onClick={() => remove('projects', i)} className="text-sm text-red-600 hover:underline">Remove</button>}
                            </div>
                        ))}
                    </section>
                </div>

                {/* ------------------------------------ live preview (this is what gets printed) */}
                <div className="lg:sticky lg:top-24">
                    <div id="resume-preview" className={`bg-white shadow-xl rounded-lg p-8 text-gray-900 ${classic ? 'font-serif' : 'font-sans'}`} style={{ minHeight: '40rem' }}>
                        <header className={classic ? 'text-center border-b pb-3' : 'border-l-4 border-teal-600 pl-4 pb-2'}>
                            <h2 className={`text-3xl font-bold ${classic ? '' : 'text-teal-800'}`}>{d.name || 'Your Name'}</h2>
                            {d.headline && <p className="text-gray-600">{d.headline}</p>}
                            <p className="text-xs text-gray-500 mt-1">{[d.email, d.phone, d.location, d.links].filter(Boolean).join('  ·  ')}</p>
                        </header>
                        {d.summary && <Section title="Summary" classic={classic}><p className="text-sm leading-relaxed">{d.summary}</p></Section>}
                        {skills.length > 0 && <Section title="Skills" classic={classic}><p className="text-sm">{skills.join(' · ')}</p></Section>}
                        {d.experience.some((e) => e.role || e.company) && <Section title="Experience" classic={classic}>
                            {d.experience.filter((e) => e.role || e.company).map((e, i) => (
                                <div key={i} className="mb-3"><div className="flex justify-between text-sm"><span className="font-semibold">{e.role}{e.company && `, ${e.company}`}</span><span className="text-gray-500">{e.dates}</span></div>
                                    <ul className="list-disc pl-5 text-sm space-y-0.5">{e.bullets.split('\n').filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}</ul></div>
                            ))}</Section>}
                        {d.projects.some((e) => e.name) && <Section title="Projects" classic={classic}>
                            {d.projects.filter((e) => e.name).map((e, i) => <div key={i} className="mb-2 text-sm"><span className="font-semibold">{e.name}</span>{e.tech && <span className="text-gray-500"> ({e.tech})</span>}<p>{e.desc}</p></div>)}</Section>}
                        {d.education.some((e) => e.degree || e.school) && <Section title="Education" classic={classic}>
                            {d.education.filter((e) => e.degree || e.school).map((e, i) => <div key={i} className="flex justify-between text-sm mb-1"><span><span className="font-semibold">{e.degree}</span>{e.school && `, ${e.school}`}</span><span className="text-gray-500">{e.year}</span></div>)}</Section>}
                    </div>
                </div>
            </div>
        </div>
    );
}

const Section = ({ title, classic, children }) => (
    <section className="mt-4">
        <h3 className={`text-sm font-bold uppercase tracking-wider mb-1 ${classic ? 'border-b' : 'text-teal-700'}`}>{title}</h3>
        {children}
    </section>
);
