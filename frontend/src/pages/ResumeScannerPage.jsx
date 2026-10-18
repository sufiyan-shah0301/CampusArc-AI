import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ScoreRing, { Bar } from '../components/ScoreRing';

const PRIORITY = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
};

const Chips = ({ items = [], tone = 'bg-gray-100 text-gray-800' }) => (
    <div className="flex flex-wrap gap-2">
        {items.map((s, i) => <span key={`${s}-${i}`} className={`px-3 py-1 rounded-full text-sm font-medium ${tone}`}>{s}</span>)}
    </div>
);

const Card = ({ title, children }) => (
    <section className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">{title}</h2>
        {children}
    </section>
);

function Results({ record, onAddSkills }) {
    const r = record.result;
    const jm = r.job_match;
    return (
        <div className="space-y-6">
            <Card title="Overview">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex gap-8">
                        <ScoreRing value={r.overall_score} label="Overall" />
                        <ScoreRing value={r.ats_score} label="ATS-friendly" />
                        {jm && <ScoreRing value={jm.score} label="Job match" />}
                    </div>
                    <div className="flex-1">
                        <p className="text-gray-700">{r.summary}</p>
                        {r.candidate?.name && (
                            <p className="mt-3 text-sm text-gray-500">
                                {[r.candidate.name, r.candidate.headline, r.candidate.location].filter(Boolean).join(' · ')}
                                {r.years_experience ? ` · ${r.years_experience} yr experience` : ''}
                            </p>
                        )}
                    </div>
                </div>
            </Card>

            {record.ml?.categories?.length > 0 && (
                <Card title="ML insights (trained models)">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 mb-3">Best-fit career category (Random Forest + LogReg ensemble)</h3>
                            {record.ml.categories[0]?.confidence < 0.35 && <p className="text-xs bg-yellow-50 text-yellow-800 rounded p-2 mb-3">Low confidence: this classifier learned from long, template-style resumes, so it cannot name a category for this resume. Use the AI analysis below instead.</p>}
                            <div className="space-y-3">{record.ml.categories.map((c) => <Bar key={c.category} label={c.category} value={Math.round(c.confidence * 100)} />)}</div>
                        </div>
                        {record.ml.semanticMatch !== undefined && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 mb-3">Semantic similarity to the job (sentence embeddings)</h3>
                                <Bar label="Similarity" value={record.ml.semanticMatch} />
                                <p className="text-xs text-gray-400 mt-2">Measures meaning, not just keywords: related skills and phrasing count too.</p>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {record.ml?.skills?.length > 0 && (
                <Card title="Skills found by the ML extractor">
                    <p className="text-xs text-gray-400 mb-3">A vocabulary mined from 2,400 real resumes, matched without any LLM. Compare with the AI's list below.</p>
                    <Chips items={record.ml.skills} tone="bg-sky-100 text-sky-800" />
                </Card>
            )}

            {jm && (
                <Card title={`Match for ${record.jobTitle || 'the job description'}`}>
                    <p className="text-gray-700 mb-4">{jm.verdict}</p>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div><h3 className="font-semibold text-green-700 mb-2">Matched skills</h3><Chips items={jm.matched_skills} tone="bg-green-100 text-green-800" /></div>
                        <div><h3 className="font-semibold text-red-700 mb-2">Missing skills</h3><Chips items={jm.missing_skills} tone="bg-red-100 text-red-800" /></div>
                    </div>
                </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <Card title="Section scores">
                    <div className="space-y-3">{Object.entries(r.section_scores || {}).map(([k, v]) => <Bar key={k} label={k} value={v} />)}</div>
                </Card>
                <Card title="Skills found">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Technical</h3>
                    <Chips items={r.skills?.technical} tone="bg-teal-100 text-teal-800" />
                    <h3 className="text-sm font-semibold text-gray-500 mt-4 mb-2">Soft</h3>
                    <Chips items={r.skills?.soft} tone="bg-indigo-100 text-indigo-800" />
                    {onAddSkills && (r.skills?.technical || []).length > 0 && (
                        <button onClick={() => onAddSkills(r.skills.technical)} className="mt-5 text-sm font-semibold text-teal-700 hover:text-teal-900 underline">
                            + Add these technical skills to my profile
                        </button>
                    )}
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card title="Strengths"><ul className="list-disc pl-5 space-y-2 text-gray-700">{(r.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul></Card>
                <Card title="Weaknesses"><ul className="list-disc pl-5 space-y-2 text-gray-700">{(r.weaknesses || []).map((s, i) => <li key={i}>{s}</li>)}</ul></Card>
            </div>

            <Card title="How to improve">
                <ul className="space-y-3">
                    {(r.suggestions || []).map((s, i) => (
                        <li key={i} className="flex gap-3 items-start">
                            <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold uppercase ${PRIORITY[s.priority] || PRIORITY.low}`}>{s.priority}</span>
                            <div><span className="font-semibold text-gray-800">{s.section}: </span><span className="text-gray-700">{s.text}</span></div>
                        </li>
                    ))}
                </ul>
                {(r.missing_keywords || []).length > 0 && (
                    <div className="mt-6"><h3 className="font-semibold text-gray-700 mb-2">Keywords worth adding</h3><Chips items={r.missing_keywords} tone="bg-amber-100 text-amber-800" /></div>
                )}
            </Card>
        </div>
    );
}

export default function ResumeScannerPage() {
    const { user, refreshUser } = useAuth();
    const [file, setFile] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [jobId, setJobId] = useState('');
    const [jd, setJd] = useState('');
    const [loading, setLoading] = useState(false);
    const [record, setRecord] = useState(null);
    const [history, setHistory] = useState([]);
    const [dragOver, setDragOver] = useState(false);
    const input = useRef(null);

    const loadHistory = () => api.get('/api/ai/resume/history').then(setHistory).catch(() => {});
    useEffect(() => {
        loadHistory();
        api.list('jobs', { isOpen: true }).then(setJobs).catch(() => {});
    }, []);

    const pick = (f) => {
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) return toast.error('File is too large (max 5 MB).');
        if (!/\.(pdf|txt)$/i.test(f.name)) return toast.error('Please upload a PDF or .txt file.');
        setFile(f);
    };

    const analyze = async (e) => {
        e.preventDefault();
        if (!file) return toast.error('Choose your resume first.');
        const form = new FormData();
        form.append('file', file);
        if (jobId) form.append('jobId', jobId);
        else if (jd.trim()) form.append('jobDescription', jd.trim());
        setLoading(true);
        setRecord(null);
        try {
            const rec = await api.upload('/api/ai/resume/analyze', form);
            setRecord(rec);
            loadHistory();
            toast.success('Analysis ready!');
        } catch (err) {
            toast.error(err.message || 'Could not analyse the resume.');
        } finally {
            setLoading(false);
        }
    };

    const addSkills = async (skills) => {
        try {
            const merged = Array.from(new Set([...(user.profile?.skills || []), ...skills])).slice(0, 40);
            await api.update('users', user.uid, { 'profile.skills': merged });
            await refreshUser();
            toast.success('Skills added to your profile.');
        } catch (err) {
            toast.error(err.message || 'Could not update your profile.');
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-black text-slate-800">AI Resume Scanner</h1>
                <p className="mt-2 text-slate-500">Get an ATS score, skill extraction and concrete fixes in seconds. Add a job to see how well you match.</p>
            </div>

            <form onSubmit={analyze} className="bg-white rounded-xl shadow-lg p-6 space-y-5">
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
                    onClick={() => input.current?.click()}
                    role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
                    className={`cursor-pointer border-2 border-dashed rounded-xl p-10 text-center transition ${dragOver ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400'}`}
                >
                    <input ref={input} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                    {file ? (
                        <p className="font-semibold text-gray-800">{file.name} <span className="text-gray-400 font-normal">({Math.round(file.size / 1024)} KB)</span></p>
                    ) : (
                        <>
                            <p className="font-semibold text-gray-700">Drop your resume here or click to browse</p>
                            <p className="text-sm text-gray-400 mt-1">PDF or TXT, up to 5 MB. Your file is analysed and not stored; only the results are saved.</p>
                        </>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="job" className="block text-sm font-bold text-gray-700 mb-1">Compare with a posted job (optional)</label>
                        <select id="job" value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                            <option value="">None</option>
                            {jobs.map((j) => <option key={j.id} value={j.id}>{j.jobTitle} · {j.companyName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="jd" className="block text-sm font-bold text-gray-700 mb-1">…or paste a job description</label>
                        <textarea id="jd" rows={2} disabled={!!jobId} value={jd} onChange={(e) => setJd(e.target.value)} maxLength={4000}
                            className="w-full p-2 border rounded-md disabled:bg-gray-100" placeholder="Paste the requirements here" />
                    </div>
                </div>

                <div className="text-center">
                    <button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-10 rounded-lg disabled:bg-gray-400">
                        {loading ? 'Analysing… (10-20 s)' : 'Analyse my resume'}
                    </button>
                </div>
            </form>

            {record && <div className="mt-8"><Results record={record} onAddSkills={user?.role === 'student' ? addSkills : null} /></div>}

            {history.length > 0 && (
                <div className="mt-10">
                    <h2 className="text-lg font-bold text-gray-700 mb-3">Previous scans</h2>
                    <ul className="bg-white rounded-xl shadow-md divide-y">
                        {history.map((h) => (
                            <li key={h.id}>
                                <button onClick={() => { setRecord(h); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full text-left p-4 hover:bg-gray-50 flex justify-between items-center">
                                    <span><span className="font-semibold text-gray-800">{h.filename}</span>{h.jobTitle && <span className="text-gray-500"> · vs {h.jobTitle}</span>}</span>
                                    <span className="text-sm text-gray-500">{h.result?.overall_score}/100 · {h.createdAt.toDate().toLocaleDateString()}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
