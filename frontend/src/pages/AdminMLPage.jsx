import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Bar } from '../components/ScoreRing';

const pct = (v) => (v === undefined || v === null ? '–' : `${Math.round(v * 1000) / 10}%`);

const Stat = ({ label, value, hint }) => (
    <div className="bg-gray-50 rounded-lg p-3" title={hint}>
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
    </div>
);

const Card = ({ title, badge, children }) => (
    <section className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-800">{title}</h2>{badge && <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-800">{badge}</span>}</div>
        {children}
    </section>
);

const LEVEL_TONE = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-red-100 text-red-800', unknown: 'bg-gray-100 text-gray-700' };

export default function AdminMLPage() {
    const [cards, setCards] = useState(null);
    const [jobForm, setJobForm] = useState({ jobTitle: '', description: '', skills: '' });
    const [risk, setRisk] = useState(null);
    const [resumeText, setResumeText] = useState('');
    const [cats, setCats] = useState(null);
    const [busy, setBusy] = useState('');

    useEffect(() => { api.get('/api/ml/models').then(setCards).catch((e) => toast.error(e.message)); }, []);

    const checkJob = async (e) => {
        e.preventDefault(); setBusy('job');
        try {
            setRisk(await api.post('/api/ml/job-risk', { ...jobForm, skills: jobForm.skills.split(',').map((s) => s.trim()).filter(Boolean) }));
        } catch (err) { toast.error(err.message); } finally { setBusy(''); }
    };
    const classify = async (e) => {
        e.preventDefault(); setBusy('resume');
        try { setCats((await api.post('/api/ml/resume-category', { text: resumeText })).predictions); }
        catch (err) { toast.error(err.message); } finally { setBusy(''); }
    };

    if (!cards) return <div className="text-center p-10">Loading model cards…</div>;
    const { resume, fakejob } = cards;
    const cmp = resume?.comparison_on_holdout || {};

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">ML Models</h1>
                <p className="text-gray-500 mt-1">Models trained on Kaggle datasets and served locally. Metrics are measured on held-out data the models never saw in training.</p>
            </div>

            <Card title="Fake job detector: Random Forest" badge={fakejob ? 'Kaggle · 17,880 postings' : 'not trained'}>
                {fakejob ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Stat label="ROC-AUC" value={fakejob.random_forest.roc_auc} hint="Ranking quality, 1.0 is perfect" />
                            <Stat label="PR-AUC" value={fakejob.random_forest.pr_auc} hint="Precision/recall quality on the rare 'fake' class" />
                            <Stat label="Precision" value={pct(fakejob.random_forest.precision)} hint="Of postings flagged fake, how many really were" />
                            <Stat label="Recall" value={pct(fakejob.random_forest.recall)} hint="Of all fake postings, how many were caught" />
                            <Stat label="F1" value={fakejob.random_forest.f1} />
                        </div>
                        <p className="text-sm text-gray-500 mt-3">Only {fakejob.n_fraudulent} of {fakejob.n_samples.toLocaleString()} postings are fraudulent (a heavily imbalanced problem), so accuracy would be misleading. Class weights + isotonic calibration are used. Logistic-regression baseline: ROC-AUC {fakejob.logistic_regression_baseline.roc_auc}, F1 {fakejob.logistic_regression_baseline.f1}.</p>
                        <h3 className="font-semibold text-gray-700 mt-5 mb-2">Most important features</h3>
                        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
                            {fakejob.rf_top_features.slice(0, 8).map((f) => <Bar key={f.feature} label={f.feature.replace('meta:', '⚙ ').replace('tfidf:', '')} value={Math.round(f.importance * 1000) / 10} />)}
                        </div>
                    </>
                ) : <p className="text-gray-500">Run <code>python -m ml.train_all</code> in <code>backend/</code>.</p>}
            </Card>

            <Card title="Anomaly detector: Isolation Forest" badge="unsupervised">
                {fakejob && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Stat label="Flagged postings" value={pct(fakejob.isolation_forest.flagged_share_of_all)} />
                            <Stat label="Fraud rate: flagged" value={pct(fakejob.isolation_forest.fraud_rate_in_flagged)} />
                            <Stat label="Fraud rate: not flagged" value={pct(fakejob.isolation_forest.fraud_rate_in_unflagged)} />
                            <Stat label="ROC-AUC vs labels" value={fakejob.isolation_forest.roc_auc_vs_fraud_label} hint="Labels were never used for training" />
                        </div>
                        <p className="text-sm text-gray-500 mt-3">Trained only on legitimate postings, without ever seeing a fraud label. Flagged postings are about {(fakejob.isolation_forest.fraud_rate_in_flagged / Math.max(fakejob.isolation_forest.fraud_rate_in_unflagged, 1e-6)).toFixed(1)}× more likely to be fraudulent, so it works as a second opinion next to the Random Forest, not as a standalone detector.</p>
                    </>
                )}
            </Card>

            <Card title="Resume category classifier" badge={resume ? `${resume.n_classes} classes · ${resume.n_samples.toLocaleString()} resumes` : 'not trained'}>
                {resume && (
                    <>
                        <p className="text-sm text-gray-500 mb-3">Deployed: <strong>{resume.deployed_model}</strong> on TF-IDF of the full text plus the job-title line. Held-out comparison:</p>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-gray-500"><tr><th className="py-1 pr-6">Model</th><th className="pr-6">Accuracy</th><th className="pr-6">Macro F1</th></tr></thead>
                                <tbody>{Object.entries(cmp).map(([name, m]) => <tr key={name} className={name === resume.deployed_model ? 'font-bold text-teal-700' : 'text-gray-700'}><td className="py-1 pr-6">{name}</td><td className="pr-6">{pct(m.accuracy)}</td><td className="pr-6">{m.macro_f1}</td></tr>)}</tbody>
                            </table>
                        </div>
                        <p className="text-sm text-gray-500 mt-3">5-fold cross-validated macro-F1 (logistic regression): {resume.cv5_macro_f1_logreg.mean} ± {resume.cv5_macro_f1_logreg.std}. Random guessing among {resume.n_classes} classes would be about {(100 / resume.n_classes).toFixed(0)}%.</p>
                        {resume.baseline_without_augmentation_on_same_holdout && (
                            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm">
                                <p className="font-semibold text-gray-700 mb-2">Real-world check: resumes that start with a name instead of a job title</p>
                                <table className="text-sm">
                                    <thead className="text-left text-gray-500"><tr><th className="pr-6">Same unseen resumes</th><th className="pr-6">As in dataset</th><th className="pr-6">Title removed</th><th>Removed + 120-300 words</th></tr></thead>
                                    <tbody>
                                        <tr className="text-gray-600"><td className="pr-6">Before augmentation</td><td className="pr-6">{pct(resume.baseline_without_augmentation_on_same_holdout.title_style.accuracy)}</td><td className="pr-6">{pct(resume.baseline_without_augmentation_on_same_holdout.name_style.accuracy)}</td><td>{pct(resume.baseline_without_augmentation_on_same_holdout.name_style_short.accuracy)}</td></tr>
                                        <tr className="font-bold text-teal-700"><td className="pr-6">Deployed (augmented)</td><td className="pr-6">{pct(cmp[resume.deployed_model].accuracy)}</td><td className="pr-6">{pct(resume.robustness_on_realistic_resumes[resume.deployed_model].name_style.accuracy)}</td><td>{pct(resume.robustness_on_realistic_resumes[resume.deployed_model].name_style_short.accuracy)}</td></tr>
                                    </tbody>
                                </table>
                                <p className="text-gray-500 mt-2">{resume.augmentation}</p>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {cards.placement && (
                <Card title="Placement probability" badge={`${cards.placement.n_samples.toLocaleString()} students`}>
                    <p className="text-sm text-gray-500 mb-3">Deployed: <strong>{cards.placement.deployed_model}</strong>. Gender, age and hostel were excluded on purpose (fairness). Held-out comparison:</p>
                    <table className="min-w-full text-sm"><thead className="text-left text-gray-500"><tr><th className="py-1 pr-6">Model</th><th className="pr-6">Accuracy</th><th className="pr-6">ROC-AUC</th><th>5-fold CV AUC</th></tr></thead>
                        <tbody>{Object.entries(cards.placement.comparison_on_holdout).map(([n, m]) => <tr key={n} className={n === cards.placement.deployed_model ? 'font-bold text-teal-700' : 'text-gray-700'}><td className="py-1 pr-6">{n}</td><td className="pr-6">{pct(m.accuracy)}</td><td className="pr-6">{m.roc_auc}</td><td>{m.cv5_roc_auc}</td></tr>)}</tbody></table>
                </Card>
            )}

            {cards.salary && (
                <Card title="Expected salary (regression)" badge="INR">
                    <p className="text-sm text-gray-500 mb-3">Deployed: <strong>{cards.salary.deployed_model}</strong>. The app shows a range ({cards.salary.interval.level}, empirical coverage {Math.round(cards.salary.interval.empirical_coverage * 100)}%), because {cards.salary.note.toLowerCase()}</p>
                    <table className="min-w-full text-sm"><thead className="text-left text-gray-500"><tr><th className="py-1 pr-6">Model</th><th className="pr-6">R² (log salary, CV)</th><th>Median abs. error</th></tr></thead>
                        <tbody>{Object.entries(cards.salary.comparison_on_holdout).map(([n, m]) => <tr key={n} className={n === cards.salary.deployed_model ? 'font-bold text-teal-700' : 'text-gray-700'}><td className="py-1 pr-6">{n}</td><td className="pr-6">{m.cv5_r2_log}</td><td>₹{m.median_abs_error_inr.toLocaleString()}</td></tr>)}</tbody></table>
                </Card>
            )}

            {cards.families && (
                <Card title="Job families (K-Means clustering)" badge={`${cards.families.k_selected_by_silhouette} clusters`}>
                    <p className="text-sm text-gray-500 mb-3">TF-IDF → SVD → K-Means on {cards.families.n_samples.toLocaleString()} real postings; k chosen by silhouette score. New jobs are assigned to a family automatically.</p>
                    <div className="flex flex-wrap gap-2">{cards.families.families.map((f) => <span key={f.id} className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-800" title={f.keywords.join(', ')}>{f.name} · {f.size}</span>)}</div>
                </Card>
            )}

            {cards.deepfake && (
                <Card title="Deepfake detector (Verify Media)" badge={`${cards.deepfake.n_train.toLocaleString()} train / ${cards.deepfake.n_test.toLocaleString()} test faces`}>
                    <p className="text-sm text-gray-500 mb-3">Evaluated on the dataset's official <strong>Test</strong> folder, which the models never saw. Shipped: <strong>{cards.deepfake.deployed_model}</strong>.</p>
                    <table className="min-w-full text-sm"><thead className="text-left text-gray-500"><tr><th className="py-1 pr-6">Model</th><th className="pr-6">Accuracy</th><th className="pr-6">ROC-AUC</th><th className="pr-6">Precision</th><th>Recall</th></tr></thead>
                        <tbody>{Object.entries(cards.deepfake.comparison_on_test).map(([n, m]) => <tr key={n} className={n.startsWith('Ensemble') ? 'font-bold text-teal-700' : 'text-gray-700'}><td className="py-1 pr-6">{n}</td><td className="pr-6">{pct(m.accuracy)}</td><td className="pr-6">{m.roc_auc}</td><td className="pr-6">{pct(m.precision)}</td><td>{pct(m.recall)}</td></tr>)}</tbody></table>
                    <p className="text-sm text-gray-500 mt-3">Isolation Forest (trained on real images only, no fake labels): ROC-AUC {cards.deepfake.isolation_forest.roc_auc_vs_fake_label}; flagged images are fake {pct(cards.deepfake.isolation_forest.fake_rate_in_flagged)} of the time vs {pct(cards.deepfake.isolation_forest.fake_rate_in_unflagged)} for unflagged.</p>
                    <p className="text-xs text-gray-400 mt-2">{cards.deepfake.note}</p>
                </Card>
            )}

            {cards.phishing && (
                <Card title="Phishing / malicious URL classifier (Safe Link)" badge="Kaggle · 507k URLs">
                    <table className="min-w-full text-sm"><thead className="text-left text-gray-500"><tr><th className="py-1 pr-6">Model</th><th className="pr-6">ROC-AUC</th><th className="pr-6">Precision</th><th className="pr-6">Recall</th><th>F1</th></tr></thead>
                        <tbody>{Object.entries(cards.phishing.comparison_on_holdout).map(([n, m]) => <tr key={n} className={n.startsWith('Ensemble') ? 'font-bold text-teal-700' : 'text-gray-700'}><td className="py-1 pr-6">{n}</td><td className="pr-6">{m.roc_auc}</td><td className="pr-6">{pct(m.precision)}</td><td className="pr-6">{pct(m.recall)}</td><td>{m.f1}</td></tr>)}</tbody></table>
                    <p className="text-xs text-gray-400 mt-2">{cards.phishing.note}</p>
                </Card>
            )}

            <Card title="Other ML components" badge="local">
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                    <li><strong>Duplicate-resume detection:</strong> MinHash over 5-word shingles (copy-paste) + embedding cosine (paraphrase). Review flags on the <Link to="/admin/integrity" className="text-teal-700 underline">Integrity</Link> page.</li>
                    <li><strong>Suspicious-account detection:</strong> Isolation Forest over behaviour features (application rate, profile completeness, match quality…).</li>
                    <li><strong>Skill extraction:</strong> vocabulary mined from 2,400 resumes, longest-phrase matching.</li>
                    <li><strong>Interview answer check:</strong> embedding similarity to the ideal answer and key-point coverage, shown next to the LLM grade.</li>
                </ul>
            </Card>

            <Card title="Semantic matching" badge="sentence embeddings">
                <p className="text-sm text-gray-600">Resumes, profiles and jobs are embedded with <code>{cards.embedding_model}</code>; similarity is blended 60/40 with explicit skill overlap to produce job recommendations, the resume–job match and the candidate ranking.</p>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card title="Try: job fraud check">
                    <form onSubmit={checkJob} className="space-y-3">
                        <input value={jobForm.jobTitle} onChange={(e) => setJobForm({ ...jobForm, jobTitle: e.target.value })} placeholder="Job title" className="w-full p-2 border rounded" />
                        <textarea required minLength={20} rows={5} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} placeholder="Paste a job description…" className="w-full p-2 border rounded" />
                        <input value={jobForm.skills} onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })} placeholder="Skills, comma separated" className="w-full p-2 border rounded" />
                        <button disabled={busy === 'job'} className="bg-teal-600 text-white font-semibold px-5 py-2 rounded disabled:bg-gray-400">{busy === 'job' ? 'Checking…' : 'Check'}</button>
                    </form>
                    {risk && (
                        <div className="mt-4 border-t pt-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${LEVEL_TONE[risk.riskLevel]}`}>{risk.riskLevel.toUpperCase()} risk · {risk.riskScore}%</span>
                            <p className="text-xs text-gray-500 mt-2">Anomaly percentile: {Math.round((risk.anomalyPercentile || 0) * 100)}</p>
                            <ul className="list-disc pl-5 mt-2 text-sm text-gray-700">{risk.riskReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                        </div>
                    )}
                </Card>
                <Card title="Try: resume category">
                    <form onSubmit={classify} className="space-y-3">
                        <textarea required minLength={20} rows={9} value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste resume text (start with the job title)…" className="w-full p-2 border rounded" />
                        <button disabled={busy === 'resume'} className="bg-teal-600 text-white font-semibold px-5 py-2 rounded disabled:bg-gray-400">{busy === 'resume' ? 'Classifying…' : 'Classify'}</button>
                    </form>
                    {cats && <div className="mt-4 border-t pt-4 space-y-2">{cats[0]?.confidence < 0.3 && <p className="text-sm bg-yellow-50 text-yellow-800 rounded p-2">Low confidence: this classifier was trained on full resumes, so short snippets give weak results. Paste a complete resume for a meaningful answer.</p>}{cats.map((c) => <Bar key={c.category} label={c.category} value={Math.round(c.confidence * 100)} />)}</div>}
                </Card>
            </div>
        </div>
    );
}
