import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import ScoreRing from '../components/ScoreRing';
import VoiceRecorder, { SpeechCard } from '../components/VoiceRecorder';

const LEVELS = ['Very easy', 'Easy', 'Intermediate', 'Hard', 'Expert'];
const DIFF_TONE = ['', 'bg-green-100 text-green-800', 'bg-lime-100 text-lime-800', 'bg-yellow-100 text-yellow-800', 'bg-orange-100 text-orange-800', 'bg-red-100 text-red-800'];

const Pill = ({ children, tone }) => <span className={`px-3 py-1 rounded-full text-xs font-bold ${tone}`}>{children}</span>;
const List = ({ title, items = [], tone }) => items.length > 0 && (
    <div><h4 className={`font-semibold mb-1 ${tone}`}>{title}</h4><ul className="list-disc pl-5 text-gray-700 space-y-1">{items.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
);

function Report({ session, onRestart }) {
    const r = session.report || {};
    const score = r.overall_score ?? Math.round((r.average_score || 0) * 10);
    return (
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
                <ScoreRing value={score} label="Overall" size={130} />
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Interview complete: {session.role}</h2>
                    <p className="text-gray-600 mt-1">Average answer score {r.average_score}/10 · Readiness: <strong className="capitalize">{r.readiness}</strong></p>
                    <p className="text-gray-700 mt-3">{r.summary}</p>
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <List title="Strengths" items={r.strengths} tone="text-green-700" />
                <List title="Work on" items={r.weaknesses} tone="text-red-700" />
            </div>
            <List title="Next steps" items={r.next_steps} tone="text-teal-700" />
            <details className="border-t pt-4">
                <summary className="cursor-pointer font-semibold text-gray-700">Review every question</summary>
                <div className="mt-4 space-y-5">
                    {session.questions.map((q, i) => (
                        <div key={i} className="border rounded-lg p-4">
                            <div className="flex justify-between gap-3"><p className="font-semibold text-gray-800">Q{i + 1}. {q.question}</p><Pill tone="bg-gray-100 text-gray-800">{q.score}/10</Pill></div>
                            <p className="mt-2 text-sm text-gray-600"><strong>Your answer:</strong> {q.answer}</p>
                            <p className="mt-2 text-sm text-gray-700">{q.feedback}</p>
                            {q.modelAnswer && <p className="mt-2 text-sm text-teal-800 bg-teal-50 rounded p-2"><strong>Model answer:</strong> {q.modelAnswer}</p>}
                        </div>
                    ))}
                </div>
            </details>
            <div className="text-center"><button onClick={onRestart} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg">Start another interview</button></div>
        </div>
    );
}

export default function MockInterviewPage() {
    const [form, setForm] = useState({ role: '', topic: '', interviewType: 'mixed', numQuestions: 5, startDifficulty: 2 });
    const [session, setSession] = useState(null);
    const [answer, setAnswer] = useState('');
    const [evaluation, setEvaluation] = useState(null);
    const [busy, setBusy] = useState(false);
    const [speech, setSpeech] = useState(null);
    const [history, setHistory] = useState([]);

    const loadHistory = () => api.get('/api/ai/interview/history').then(setHistory).catch(() => {});
    useEffect(() => { loadHistory(); }, []);

    const NUMERIC = ['numQuestions', 'startDifficulty'];
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: NUMERIC.includes(k) ? Number(e.target.value) : e.target.value }));

    const start = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            setSession(await api.post('/api/ai/interview/start', form));
            setAnswer(''); setEvaluation(null);
        } catch (err) { toast.error(err.message || 'Could not start the interview.'); }
        finally { setBusy(false); }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!answer.trim()) return toast.error('Write an answer first.');
        setBusy(true);
        try {
            const res = await api.post(`/api/ai/interview/${session.id}/answer`, { answer });
            setEvaluation(res.evaluation);
            setSession(res.session);
            loadHistory();
        } catch (err) { toast.error(err.message || 'Could not grade the answer.'); }
        finally { setBusy(false); }
    };

    const reopen = async (id) => {
        try {
            const s = await api.get(`/api/ai/interview/${id}`);
            setSession(s); setEvaluation(null); setAnswer('');
        } catch (err) { toast.error(err.message); }
    };

    const restart = () => { setSession(null); setEvaluation(null); setAnswer(''); setSpeech(null); };

    // ---------- setup screen ----------
    if (!session) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-800">AI Mock Interview</h1>
                    <p className="mt-2 text-slate-500">Practice real questions. Each answer is graded, and the next question gets harder or easier based on how you do.</p>
                </div>
                <form onSubmit={start} className="bg-white rounded-xl shadow-lg p-8 space-y-5">
                    <div>
                        <label htmlFor="role" className="block font-bold text-gray-700 mb-1">Role you are preparing for</label>
                        <input id="role" required minLength={2} maxLength={80} value={form.role} onChange={set('role')} placeholder="e.g., Full Stack Developer" className="w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="topic" className="block font-bold text-gray-700 mb-1">Focus topic (optional)</label>
                        <input id="topic" maxLength={120} value={form.topic} onChange={set('topic')} placeholder="e.g., React, DBMS, system design" className="w-full p-2 border rounded-md" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="type" className="block font-bold text-gray-700 mb-1">Type</label>
                            <select id="type" value={form.interviewType} onChange={set('interviewType')} className="w-full p-2 border rounded-md bg-white">
                                <option value="mixed">Mixed</option><option value="technical">Technical</option><option value="behavioral">Behavioural</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="num" className="block font-bold text-gray-700 mb-1">Questions</label>
                            <select id="num" value={form.numQuestions} onChange={set('numQuestions')} className="w-full p-2 border rounded-md bg-white">
                                {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="diff" className="block font-bold text-gray-700 mb-1">Start at</label>
                            <select id="diff" value={form.startDifficulty} onChange={set('startDifficulty')} className="w-full p-2 border rounded-md bg-white">
                                {LEVELS.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="text-center"><button disabled={busy} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-10 rounded-lg disabled:bg-gray-400">{busy ? 'Preparing your interviewer…' : 'Start interview'}</button></div>
                </form>

                {history.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-lg font-bold text-gray-700 mb-3">Your past interviews</h2>
                        <ul className="bg-white rounded-xl shadow-md divide-y">
                            {history.map((h) => (
                                <li key={h.id}>
                                    <button onClick={() => reopen(h.id)} className="w-full text-left p-4 hover:bg-gray-50 flex justify-between">
                                        <span className="font-semibold text-gray-800">{h.role}{h.topic ? ` · ${h.topic}` : ''}</span>
                                        <span className="text-sm text-gray-500">{h.status === 'completed' ? `${h.report?.average_score}/10 avg` : 'unfinished'} · {h.createdAt.toDate().toLocaleDateString()}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    // ---------- finished ----------
    if (session.status === 'completed' && !evaluation) return <div className="max-w-4xl mx-auto"><Report session={session} onRestart={restart} /></div>;

    // ---------- interview in progress ----------
    const last = session.status === 'completed';
    // while the grade is on screen we still show the question it belongs to (the next one is already prepared)
    const idx = evaluation && !last ? session.questions.length - 2 : session.questions.length - 1;
    const q = session.questions[idx];
    const answered = q.answer !== null && q.answer !== undefined;
    const nextQ = evaluation && !last ? session.questions[session.questions.length - 1] : null;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-600">{session.role} · Question {idx + 1} of {session.numQuestions}</p>
                <Pill tone={DIFF_TONE[q.difficulty]}>{LEVELS[q.difficulty - 1]}</Pill>
            </div>
            <div className="h-2 rounded-full bg-gray-200"><div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${((idx + (answered ? 1 : 0)) / session.numQuestions) * 100}%` }} /></div>

            <div className="bg-white rounded-xl shadow-lg p-6">
                <Pill tone="bg-gray-100 text-gray-700">{q.category}</Pill>
                <h2 className="text-xl font-bold text-gray-900 mt-3">{q.question}</h2>

                {!evaluation ? (
                    <form onSubmit={submit} className="mt-5">
                        <div className="mb-3"><VoiceRecorder disabled={busy} onText={(t) => setAnswer((a) => (a ? `${a} ${t}` : t))} onSpeech={setSpeech} /></div>
                        {speech && <div className="mb-3"><SpeechCard speech={speech} /></div>}
                        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={7} maxLength={4000} aria-label="Your answer"
                            placeholder="Type your answer as you would say it in the interview…" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-teal-500" />
                        <div className="flex justify-between items-center mt-3">
                            <span className="text-xs text-gray-400">{answer.length}/4000</span>
                            <button disabled={busy} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-8 rounded-lg disabled:bg-gray-400">{busy ? 'Grading…' : 'Submit answer'}</button>
                        </div>
                    </form>
                ) : (
                    <div className="mt-5 space-y-4">
                        <div className="flex items-center gap-4">
                            <ScoreRing value={evaluation.score * 10} label="" size={84} />
                            <div><p className="text-2xl font-extrabold text-gray-800">{evaluation.score}/10 <span className="text-base font-semibold capitalize text-gray-500">· {evaluation.verdict}</span></p><p className="text-gray-700">{evaluation.feedback}</p></div>
                        </div>
                        {evaluation.localScore !== null && evaluation.localScore !== undefined && (
                            <p className="text-sm bg-indigo-50 text-indigo-900 rounded-lg p-3"><strong>Second opinion (local ML):</strong> {evaluation.localScore}/10. Your answer stays {evaluation.localRelevance}% on topic and touches {evaluation.pointsCovered} of {evaluation.pointsTotal} key points. It checks relevance and detail with a local sentence-embedding model (no LLM), not whether every statement is correct.</p>
                        )}
                        <List title="What you did well" items={evaluation.strengths} tone="text-green-700" />
                        <List title="How to improve" items={evaluation.improvements} tone="text-red-700" />
                        {evaluation.modelAnswer && <p className="text-sm bg-teal-50 text-teal-900 rounded-lg p-3"><strong>Model answer:</strong> {evaluation.modelAnswer}</p>}
                        <div className="text-right">
                            {last
                                ? <button onClick={() => setEvaluation(null)} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-8 rounded-lg">See final report</button>
                                : <>
                                    {nextQ && <p className="text-sm text-gray-500 mb-2">Next question difficulty: <strong>{LEVELS[nextQ.difficulty - 1]}</strong>{nextQ.difficulty > q.difficulty ? ' (stepping up)' : nextQ.difficulty < q.difficulty ? ' (easing off)' : ''}</p>}
                                    <button onClick={() => { setEvaluation(null); setAnswer(''); setSpeech(null); }} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-8 rounded-lg">Next question →</button>
                                </>}
                        </div>
                    </div>
                )}
            </div>
            <div className="text-center"><button onClick={restart} className="text-sm text-gray-500 hover:text-gray-700 underline">Leave interview</button></div>
        </div>
    );
}
