import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Panel } from '../components/Charts';

export default function AdminIntegrityPage() {
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => api.get('/api/admin/integrity').then(setData).catch((e) => toast.error(e.message)), []);
    useEffect(() => { load(); }, [load]);

    const decide = async (id, status) => {
        try { await api.patch(`/api/admin/integrity/flags/${id}`, { status }); toast.success(status === 'confirmed' ? 'Marked as confirmed.' : 'Dismissed.'); load(); }
        catch (e) { toast.error(e.message); }
    };
    const refit = async () => {
        setBusy(true);
        try { const r = await api.post('/api/admin/integrity/refit'); toast.success(`Model refitted: ${r.source}`); load(); }
        catch (e) { toast.error(e.message); } finally { setBusy(false); }
    };

    if (!data) return <div className="text-center p-10">Loading…</div>;
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div><h1 className="text-3xl font-bold text-gray-800">Integrity</h1><p className="text-gray-500 mt-1">Duplicate-resume detection (MinHash + sentence embeddings) and suspicious-account detection (Isolation Forest).</p></div>

            <Panel title={`Resume similarity flags (${data.flags.length} open)`}>
                {data.flags.length === 0 ? <p className="text-sm text-gray-400">No open flags. A flag appears when a newly scanned resume is nearly identical to another candidate's.</p> : (
                    <ul className="divide-y">
                        {data.flags.map((f) => (
                            <li key={f.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                                <div className="text-sm">
                                    <p><span className="font-semibold">{f.user?.name}</span> <span className="text-gray-400">({f.user?.email})</span> looks like a copy of <span className="font-semibold">{f.otherUser?.name}</span> <span className="text-gray-400">({f.otherUser?.email})</span></p>
                                    <p className="text-gray-500 mt-1">Text overlap {Math.round(f.minhash * 100)}% · meaning similarity {Math.round(f.cosine * 100)}% · {f.createdAt.toDate().toLocaleDateString()}</p>
                                </div>
                                <div className="flex gap-2 whitespace-nowrap">
                                    <button onClick={() => decide(f.id, 'confirmed')} className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Confirm</button>
                                    <button onClick={() => decide(f.id, 'dismissed')} className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300">Dismiss</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            <Panel title="Unusual student accounts" action={<button onClick={refit} disabled={busy} className="text-sm font-semibold text-teal-700 hover:underline disabled:text-gray-400">{busy ? 'Refitting…' : 'Refit model'}</button>}>
                <p className="text-sm text-gray-500 mb-4">Model fitted on: <strong>{data.model.source}</strong>. {data.model.students < data.model.minToFit && `With fewer than ${data.model.minToFit} students the detector uses a synthetic prior of normal behaviour; it switches to your real data automatically.`} Scores are percentiles against normal accounts: a high score means unusual, not guilty.</p>
                {data.accounts.length === 0 ? <p className="text-sm text-gray-400">No student accounts yet.</p> : (
                    <div className="overflow-x-auto"><table className="min-w-full text-sm">
                        <thead className="text-left text-gray-500"><tr><th className="py-2 pr-4">Student</th><th className="pr-4">Anomaly percentile</th><th>Why</th></tr></thead>
                        <tbody>{data.accounts.map((a) => (
                            <tr key={a.id} className="border-t align-top">
                                <td className="py-2 pr-4"><Link to={`/student/${a.id}`} className="font-semibold text-gray-800 hover:text-teal-700">{a.name}</Link><div className="text-xs text-gray-400">{a.email}</div></td>
                                <td className="pr-4 w-48"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded bg-gray-100 overflow-hidden"><div className="h-full" style={{ width: `${a.anomalyPercentile * 100}%`, background: a.suspicious ? '#dc2626' : '#0d9488' }} /></div><span className={a.suspicious ? 'font-bold text-red-600' : 'text-gray-600'}>{Math.round(a.anomalyPercentile * 100)}</span></div></td>
                                <td className="text-gray-600">{a.reasons.length ? a.reasons.join('; ') : <span className="text-gray-300">nothing unusual</span>}</td>
                            </tr>))}</tbody></table></div>
                )}
            </Panel>
        </div>
    );
}
