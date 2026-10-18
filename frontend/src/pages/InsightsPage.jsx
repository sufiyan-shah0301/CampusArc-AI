import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ScoreRing, { Bar } from '../components/ScoreRing';
import { BarList, LineChart, Panel } from '../components/Charts';

// The model was trained on a small campus dataset and can saturate; never show a student a flat 0% or 100%.
const capPct = (v) => Math.min(95, Math.max(3, Math.round(v)));
const lpa = (inr) => `₹${(inr / 100000).toFixed(inr >= 1000000 ? 1 : 2)} LPA`;
const BAND = { high: ['High', 'text-green-700 bg-green-100'], medium: ['Medium', 'text-yellow-700 bg-yellow-100'], low: ['Low', 'text-red-700 bg-red-100'] };
const AREA = { profile: 'Profile', learning: 'Learning', interview: 'Interview practice', resume: 'Resume', activity: 'Job applications' };
const EMPTY = { stream: '', cgpa: '', internships: 0, backlogs: false, tenthPercent: '', twelfthPercent: '', collegeTier: 2, degree: 'B.Tech/B.E.', aptitude: {} };

function AcademicForm({ streams, initial, onSaved }) {
    const { user, refreshUser } = useAuth();
    const [f, setF] = useState({ ...EMPTY, ...initial, aptitude: { ...(initial?.aptitude || {}) } });
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    const apt = (k) => (e) => setF((p) => ({ ...p, aptitude: { ...p.aptitude, [k]: e.target.value } }));

    const save = async (e) => {
        e.preventDefault();
        const num = (v) => (v === '' || v === undefined ? undefined : Number(v));
        const aptitude = Object.fromEntries(Object.entries(f.aptitude).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, Number(v)]));
        const academic = { stream: f.stream, degree: f.degree, cgpa: num(f.cgpa), internships: Number(f.internships) || 0, backlogs: !!f.backlogs,
            tenthPercent: num(f.tenthPercent) ?? 75, twelfthPercent: num(f.twelfthPercent) ?? 75, collegeTier: Number(f.collegeTier), aptitude };
        if (!academic.stream || academic.cgpa === undefined || academic.cgpa < 0 || academic.cgpa > 10) return toast.error('Choose a stream and enter a CGPA between 0 and 10.');
        setSaving(true);
        try {
            await api.update('users', user.uid, { 'profile.academic': academic });
            await refreshUser();
            toast.success('Academic details saved.');
            onSaved();
        } catch (err) { toast.error(err.message || 'Could not save.'); } finally { setSaving(false); }
    };

    const input = 'w-full p-2 border rounded-md';
    return (
        <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="text-sm font-semibold text-gray-700">Stream
                    <select value={f.stream} onChange={set('stream')} className={`${input} bg-white mt-1`} required><option value="">Select…</option>{streams.map((s) => <option key={s}>{s}</option>)}</select></label>
                <label className="text-sm font-semibold text-gray-700">CGPA (out of 10)
                    <input type="number" step="0.01" min="0" max="10" value={f.cgpa} onChange={set('cgpa')} className={`${input} mt-1`} required /></label>
                <label className="text-sm font-semibold text-gray-700">Internships done
                    <input type="number" min="0" max="10" value={f.internships} onChange={set('internships')} className={`${input} mt-1`} /></label>
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 pt-6"><input type="checkbox" checked={!!f.backlogs} onChange={set('backlogs')} /> Backlog history</label>
                <label className="text-sm font-semibold text-gray-700">10th %<input type="number" min="0" max="100" value={f.tenthPercent} onChange={set('tenthPercent')} className={`${input} mt-1`} /></label>
                <label className="text-sm font-semibold text-gray-700">12th %<input type="number" min="0" max="100" value={f.twelfthPercent} onChange={set('twelfthPercent')} className={`${input} mt-1`} /></label>
                <label className="text-sm font-semibold text-gray-700">College tier
                    <select value={f.collegeTier} onChange={set('collegeTier')} className={`${input} bg-white mt-1`}><option value={1}>Tier 1</option><option value={2}>Tier 2</option><option value={3}>Tier 3</option></select></label>
                <label className="text-sm font-semibold text-gray-700">Degree
                    <select value={f.degree} onChange={set('degree')} className={`${input} bg-white mt-1`}><option>B.Tech/B.E.</option><option>MCA</option><option>M.Tech./M.E.</option><option>M.Sc. (Tech.)</option></select></label>
            </div>
            <details className="text-sm"><summary className="cursor-pointer font-semibold text-gray-600">Optional: aptitude test scores (AMCAT-style, improve the salary estimate)</summary>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    {['English', 'Logical', 'Quant', 'ComputerProgramming'].map((k) => (
                        <label key={k} className="font-semibold text-gray-700">{k === 'ComputerProgramming' ? 'Programming' : k}<input type="number" min="0" max="900" value={f.aptitude[k] ?? ''} onChange={apt(k)} className={`${input} mt-1`} placeholder="0-900" /></label>
                    ))}
                </div></details>
            <button disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-2 rounded-md disabled:bg-gray-400">{saving ? 'Saving…' : 'Save academic details'}</button>
        </form>
    );
}

function WhatIf({ academic, base }) {
    const [v, setV] = useState({ cgpa: academic.cgpa, internships: academic.internships || 0, backlogs: !!academic.backlogs });
    const [res, setRes] = useState(null);
    const timer = useRef(null);

    const run = useCallback((next) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            try { setRes(await api.post('/api/insights/what-if', { ...academic, ...next })); } catch { /* ignore transient errors */ }
        }, 250);
    }, [academic]);
    useEffect(() => () => clearTimeout(timer.current), []);
    const change = (patch) => { const n = { ...v, ...patch }; setV(n); run(n); };

    const p = res?.placement?.probability ?? base;
    const delta = Math.round((p - base) * 100);
    return (
        <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700">CGPA: {Number(v.cgpa).toFixed(1)}
                    <input type="range" min="5" max="10" step="0.1" value={v.cgpa} onChange={(e) => change({ cgpa: Number(e.target.value) })} className="w-full accent-teal-600" /></label>
                <label className="block text-sm font-semibold text-gray-700">Internships: {v.internships}
                    <input type="range" min="0" max="4" step="1" value={v.internships} onChange={(e) => change({ internships: Number(e.target.value) })} className="w-full accent-teal-600" /></label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={v.backlogs} onChange={(e) => change({ backlogs: e.target.checked })} /> Backlog history</label>
            </div>
            <div className="text-center">
                <ScoreRing value={capPct(p * 100)} label="Projected placement chance" size={120} />
                <p className={`mt-2 font-bold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>{delta > 0 ? '+' : ''}{delta} pts vs now</p>
                {res?.salary && <p className="text-sm text-gray-500 mt-1">Expected salary {lpa(res.salary.expected)}</p>}
            </div>
        </div>
    );
}

export default function InsightsPage() {
    const [data, setData] = useState(null);
    const [editing, setEditing] = useState(false);
    const load = useCallback(() => api.get('/api/insights/me').then(setData).catch((e) => toast.error(e.message)), []);
    useEffect(() => { load(); }, [load]);

    const trend = useMemo(() => (data?.interviewTrend || []).map((t) => ({ label: t.date.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: t.score })), [data]);
    if (!data) return <div className="text-center p-10">Loading your insights…</div>;

    const { predictions: pred, readiness, skillGap, courseSuggestions } = data;
    const placement = pred?.placement, salary = pred?.salary;
    const hasAcademic = !!pred;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black text-slate-800">Career Insights</h1>
                <p className="text-slate-500 mt-1">Machine-learning estimates from your academic profile, plus a transparent readiness score from your activity on CampusArc.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Panel title="Placement chance" action={placement && <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">ML · Gradient Boosting</span>}>
                    {placement ? (
                        <div className="text-center">
                            <ScoreRing value={capPct(placement.probability * 100)} label="Estimated chance of being placed" size={128} />
                            <span className={`inline-block mt-3 px-3 py-1 rounded-full text-sm font-bold ${BAND[placement.band][1]}`}>{BAND[placement.band][0]}</span>
                            <p className="mt-3 text-xs text-gray-500">A statistical estimate from a small campus dataset, not a promise. Internships and backlogs move it the most.</p>
                            {placement.whatIf.length > 0 && (
                                <ul className="mt-4 text-left text-sm space-y-2">
                                    {placement.whatIf.map((w) => <li key={w.action} className="flex justify-between gap-2 bg-green-50 rounded-lg px-3 py-2"><span>{w.action}</span><span className="font-bold text-green-700">+{w.gain} pts</span></li>)}
                                </ul>
                            )}
                        </div>
                    ) : <p className="text-sm text-gray-500">{data.predictionsHint}</p>}
                </Panel>

                <Panel title="Expected starting salary" action={salary && <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">ML · {salary.level}</span>}>
                    {salary ? (
                        <div>
                            <p className="text-4xl font-black text-teal-700">{lpa(salary.expected)}</p>
                            <div className="mt-5 relative h-3 rounded-full bg-gradient-to-r from-teal-100 via-teal-400 to-teal-100">
                                <div className="absolute -top-1 h-5 w-1.5 bg-teal-800 rounded" style={{ left: `${((salary.expected - salary.low) / (salary.high - salary.low)) * 100}%` }} />
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 mt-2"><span>{lpa(salary.low)}</span><span>{lpa(salary.high)}</span></div>
                            <p className="text-xs text-gray-400 mt-4">Likely range for freshers with a similar profile (Indian engineering graduates). Salary depends heavily on skills, company and city, so use this as a rough benchmark.</p>
                        </div>
                    ) : <p className="text-sm text-gray-500">{data.predictionsHint}</p>}
                </Panel>

                <Panel title="Readiness score" action={<span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">weighted activity</span>}>
                    <div className="flex justify-center"><ScoreRing value={readiness.score} label="Overall readiness" size={128} /></div>
                    <div className="mt-4 space-y-2">{Object.entries(readiness.components).map(([k, v]) => <Bar key={k} label={`${AREA[k]} (${Math.round(readiness.weights[k] * 100)}%)`} value={v} />)}</div>
                </Panel>
            </div>

            {readiness.nextSteps.length > 0 && (
                <Panel title="Your next steps">
                    <ul className="grid md:grid-cols-2 gap-3">
                        {readiness.nextSteps.map((s) => <li key={s.area}><Link to={s.link} className="flex items-center justify-between bg-teal-50 hover:bg-teal-100 rounded-lg px-4 py-3 transition"><span className="text-sm font-semibold text-teal-900">{s.text}</span><span className="text-xs text-teal-700">{AREA[s.area]} {s.score}% →</span></Link></li>)}
                    </ul>
                </Panel>
            )}

            {hasAcademic && placement && <Panel title="What if…? Try changing your profile"><WhatIf academic={data.academic} base={placement.probability} /></Panel>}

            <Panel title="Academic details" action={hasAcademic && <button onClick={() => setEditing((e) => !e)} className="text-sm font-semibold text-teal-700 hover:underline">{editing ? 'Close' : 'Edit'}</button>}>
                {(!hasAcademic || editing) ? <AcademicForm streams={data.streams} initial={data.academic} onSaved={() => { setEditing(false); load(); }} />
                    : <p className="text-sm text-gray-600">{data.academic.stream} · CGPA {data.academic.cgpa} · {data.academic.internships || 0} internship(s) · {data.academic.backlogs ? 'has backlog history' : 'no backlogs'}</p>}
            </Panel>

            <div className="grid md:grid-cols-2 gap-6">
                <Panel title="Mock-interview trend">
                    <LineChart points={trend} max={10} yLabel="average score out of 10" />
                    {trend.length < 2 && <Link to="/mock-interview" className="text-sm font-semibold text-teal-700 hover:underline">Take a mock interview →</Link>}
                </Panel>
                <Panel title="Skill gap vs open jobs">
                    <BarList items={skillGap.map((g) => ({ label: `${g.skill}${g.have ? ' ✓' : ''}`, value: g.jobs, color: g.have ? '#16a34a' : '#f59e0b', hint: g.have ? 'You have this skill' : 'Missing from your profile' }))} empty="No open jobs with skills yet." />
                    <p className="text-xs text-gray-400 mt-3"><span className="text-green-600 font-bold">Green</span>: you have it · <span className="text-amber-500 font-bold">orange</span>: in demand, not on your profile. Length = number of open jobs asking for it.</p>
                    {courseSuggestions.length > 0 && (
                        <div className="mt-4 border-t pt-4"><h3 className="text-sm font-bold text-gray-700 mb-2">Courses to close the gap</h3>
                            <ul className="space-y-1">{courseSuggestions.map((c) => <li key={c.courseId} className="text-sm"><span className="text-gray-500">{c.skill} →</span> <Link to={`/courses/${c.courseId}`} className="font-semibold text-teal-700 hover:underline">{c.title}</Link></li>)}</ul></div>
                    )}
                </Panel>
            </div>
        </div>
    );
}
