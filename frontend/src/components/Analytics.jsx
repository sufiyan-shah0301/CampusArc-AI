import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { BarList, LineChart, Panel, Stat } from './Charts';

const STATUS_COLOR = { Applied: '#9ca3af', 'Under Review': '#f59e0b', Interviewing: '#3b82f6', Hired: '#16a34a', Rejected: '#ef4444' };

export function ExportButton({ path, filename, children }) {
    const [busy, setBusy] = useState(false);
    return (
        <button disabled={busy} onClick={async () => { setBusy(true); try { await api.download(path, filename); } catch (e) { toast.error(e.message || 'Export failed'); } finally { setBusy(false); } }}
            className="text-sm font-semibold text-teal-700 hover:underline disabled:text-gray-400">{busy ? 'Preparing…' : children}</button>
    );
}

/** Platform-wide analytics for admins. */
export function AdminReports() {
    const [s, setS] = useState(null);
    useEffect(() => { api.get('/api/reports/summary').then(setS).catch(() => {}); }, []);
    if (!s) return null;
    return (
        <div className="mt-12">
            <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-bold text-gray-800">Placement analytics</h2><ExportButton path="/api/reports/placements.csv" filename="placements.csv">⬇ Export placements (CSV)</ExportButton></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <Stat label="Placement rate" value={`${s.placementRate}%`} hint="Hired / all applications" tone="text-green-700" />
                <Stat label="Applications" value={Object.values(s.applicationsByStatus).reduce((a, b) => a + b, 0)} />
                <Stat label="Open jobs" value={s.jobs.open} hint={`${s.jobs.total} total`} />
                <Stat label="Pending fraud review" value={s.jobs.pendingReview} tone={s.jobs.pendingReview ? 'text-red-600' : 'text-gray-800'} />
                <Stat label="Resume scans" value={s.resumeScans} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Panel title="Application pipeline"><BarList items={Object.entries(s.applicationsByStatus).map(([label, value]) => ({ label, value, color: STATUS_COLOR[label] }))} /></Panel>
                <Panel title="Applications per day (30 days)"><LineChart points={s.applicationsPerDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} /></Panel>
                <Panel title="Most demanded skills"><BarList items={s.topSkillsDemanded.map((d) => ({ label: d.skill, value: d.jobs }))} color="#6366f1" /></Panel>
                <Panel title="Hires by company"><BarList items={s.hiresByCompany.map((d) => ({ label: d.company, value: d.hires }))} color="#16a34a" empty="No hires recorded yet." /></Panel>
            </div>
        </div>
    );
}

/** Hiring funnel for the logged-in recruiter. */
export function RecruiterFunnel() {
    const [f, setF] = useState(null);
    useEffect(() => { api.get('/api/reports/funnel').then(setF).catch(() => {}); }, []);
    if (!f) return null;
    const total = Object.values(f.byStatus).reduce((a, b) => a + b, 0);
    return (
        <div>
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-gray-800">Hiring funnel</h2><ExportButton path="/api/reports/applications.csv" filename="applicants.csv">⬇ Export applicants (CSV)</ExportButton></div>
            <div className="grid md:grid-cols-2 gap-6">
                <Panel title={`Pipeline (${total} applications)`}><BarList items={Object.entries(f.byStatus).map(([label, value]) => ({ label, value, color: STATUS_COLOR[label] }))} /></Panel>
                <Panel title="Top jobs by applicants">
                    {f.perJob.length === 0 ? <p className="text-sm text-gray-400">No applications yet.</p> : (
                        <table className="min-w-full text-sm"><thead className="text-left text-gray-500"><tr><th className="pb-2">Job</th><th>Applicants</th><th>Avg match</th><th>Hired</th></tr></thead>
                            <tbody>{f.perJob.map((j) => <tr key={j.jobId} className="border-t"><td className="py-2 pr-2 font-medium text-gray-800">{j.title}</td><td>{j.applicants}</td><td>{j.avgMatch}%</td><td>{j.hired}</td></tr>)}</tbody></table>
                    )}
                </Panel>
            </div>
        </div>
    );
}
