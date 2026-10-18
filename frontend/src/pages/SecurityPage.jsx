import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Panel } from '../components/Charts';

const input = 'w-full p-2 border rounded-md';

function Mfa({ status, reload }) {
    const [step, setStep] = useState('idle');        // idle | password | scan | codes | disable
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [setup, setSetup] = useState(null);
    const [codes, setCodes] = useState([]);
    const [busy, setBusy] = useState(false);

    const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast.error(e.message || 'Something went wrong.'); } finally { setBusy(false); } };
    const begin = (e) => { e.preventDefault(); run(async () => { setSetup(await api.post('/api/security/mfa/setup', { password })); setPassword(''); setStep('scan'); }); };
    const enable = (e) => { e.preventDefault(); run(async () => { const r = await api.post('/api/security/mfa/enable', { code }); setCodes(r.recoveryCodes); setCode(''); setStep('codes'); reload(); }); };
    const disable = (e) => { e.preventDefault(); run(async () => { await api.post('/api/security/mfa/disable', { password, code }); toast.success('Two-factor authentication is off.'); setPassword(''); setCode(''); setStep('idle'); reload(); }); };
    const saveCodes = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([`CampusArc recovery codes (each works once)\n\n${codes.join('\n')}\n`], { type: 'text/plain' }));
        a.download = 'campusarc-recovery-codes.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    return (
        <Panel title="Two-factor authentication (TOTP)" action={<span className={`text-xs font-bold px-2 py-1 rounded-full ${status.mfaEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{status.mfaEnabled ? 'On' : 'Off'}</span>}>
            <p className="text-sm text-gray-600 mb-4">Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, Microsoft Authenticator) to your login, so a stolen password alone is not enough.</p>
            {step === 'idle' && (status.mfaEnabled
                ? <div><p className="text-sm text-gray-500 mb-3">{status.recoveryCodesLeft} recovery code(s) left.</p><button onClick={() => setStep('disable')} className="text-red-600 font-semibold hover:underline">Turn off two-factor authentication</button></div>
                : <button onClick={() => setStep('password')} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2 rounded-md">Set up two-factor authentication</button>)}
            {step === 'password' && <form onSubmit={begin} className="max-w-sm space-y-3"><label className="block text-sm font-semibold">Confirm your password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} autoComplete="current-password" /></label><button disabled={busy} className="bg-teal-600 text-white font-semibold px-5 py-2 rounded-md disabled:bg-gray-400">Continue</button></form>}
            {step === 'scan' && setup && (
                <form onSubmit={enable} className="grid md:grid-cols-2 gap-6 items-start">
                    <div><p className="text-sm font-semibold mb-2">1. Scan this QR code with your authenticator app</p><img src={setup.qr} alt="QR code to add CampusArc to your authenticator app" className="w-48 h-48 border rounded-lg" /><p className="text-xs text-gray-500 mt-2 break-all">Or enter the key manually: <span className="font-mono">{setup.secret}</span></p></div>
                    <div className="space-y-3"><label className="block text-sm font-semibold">2. Enter the 6-digit code it shows<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} className={`${input} mt-1 tracking-widest text-center text-lg`} /></label><button disabled={busy} className="bg-teal-600 text-white font-semibold px-5 py-2 rounded-md disabled:bg-gray-400">Turn on</button></div>
                </form>
            )}
            {step === 'codes' && (
                <div className="space-y-3"><p className="font-semibold text-green-700">Two-factor authentication is on.</p>
                    <p className="text-sm text-gray-600">Save these recovery codes somewhere safe. Each one works once if you lose your phone. <strong>They will not be shown again.</strong></p>
                    <div className="grid grid-cols-2 gap-2 max-w-sm font-mono text-sm bg-gray-50 border rounded-lg p-3">{codes.map((c) => <span key={c}>{c}</span>)}</div>
                    <div className="flex gap-3"><button onClick={() => { navigator.clipboard?.writeText(codes.join('\n')); toast.success('Copied'); }} className="text-sm font-semibold text-teal-700 hover:underline">Copy</button><button onClick={saveCodes} className="text-sm font-semibold text-teal-700 hover:underline">Download</button><button onClick={() => setStep('idle')} className="text-sm text-gray-500 hover:underline">Done</button></div></div>
            )}
            {step === 'disable' && (
                <form onSubmit={disable} className="max-w-sm space-y-3">
                    <label className="block text-sm font-semibold">Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} autoComplete="current-password" /></label>
                    <label className="block text-sm font-semibold">Authenticator or recovery code<input required value={code} onChange={(e) => setCode(e.target.value)} className={`${input} mt-1`} autoComplete="one-time-code" /></label>
                    <div className="flex gap-3"><button disabled={busy} className="bg-red-600 text-white font-semibold px-5 py-2 rounded-md disabled:bg-gray-400">Turn off</button><button type="button" onClick={() => setStep('idle')} className="text-gray-500 hover:underline">Cancel</button></div>
                </form>
            )}
        </Panel>
    );
}

export default function SecurityPage() {
    const { user, refreshUser, logout } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [delPw, setDelPw] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => api.get('/api/security/status').then(setStatus).catch((e) => toast.error(e.message)), []);
    useEffect(() => { load(); }, [load]);

    const toggleEmail = async (on) => {
        try { await api.update('users', user.uid, { emailNotifications: on }); setStatus((s) => ({ ...s, emailNotifications: on })); await refreshUser(); toast.success(on ? 'E-mail notifications on.' : 'E-mail notifications off.'); }
        catch (e) { toast.error(e.message); }
    };
    const exportData = async () => { try { await api.download('/api/security/privacy/export', 'my-campusarc-data.json'); } catch (e) { toast.error(e.message); } };
    const deleteAccount = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.del('/api/security/privacy/account', { password: delPw });
            toast.success('Your account and data were deleted.');
            logout(); navigate('/');
        } catch (err) { toast.error(err.message); } finally { setBusy(false); }
    };

    if (!status) return <div className="text-center p-10">Loading…</div>;
    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div><h1 className="text-3xl font-bold text-gray-800">Security & Privacy</h1><p className="text-gray-500 mt-1">Control how your account is protected and what we keep.</p></div>

            <Mfa status={status} reload={load} />

            <Panel title="E-mail notifications">
                <label className="flex items-center gap-3"><input type="checkbox" checked={status.emailNotifications} onChange={(e) => toggleEmail(e.target.checked)} className="h-5 w-5 accent-teal-600" />
                    <span className="text-sm text-gray-700">E-mail me about application updates, new applicants, interviews and messages (in-app notifications always stay on).</span></label>
            </Panel>

            <Panel title="Your data (GDPR / CCPA)">
                <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5 mb-4">
                    <li><strong>Right to access & portability:</strong> download everything we hold about you as a JSON file.</li>
                    <li><strong>Right to erasure:</strong> delete your account and the data tied to it.</li>
                    <li><strong>We do not sell or share your personal data</strong> for advertising.</li>
                    <li><strong>Media you verify</strong> is analysed in memory and deleted immediately; saved summaries expire after 24 hours; notifications expire after 90 days.</li>
                    <li>Passwords are hashed (bcrypt); authenticator secrets are encrypted at rest.</li>
                </ul>
                <button onClick={exportData} className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-5 py-2 rounded-md">⬇ Download my data</button>
            </Panel>

            <Panel title="Delete my account" className="border border-red-200">
                <form onSubmit={deleteAccount} className="space-y-3 max-w-sm">
                    <p className="text-sm text-gray-600">This permanently removes your profile, applications, resume scans, interview history, messages and notifications. It cannot be undone.</p>
                    <label className="block text-sm font-semibold">Password<input type="password" required value={delPw} onChange={(e) => setDelPw(e.target.value)} className={`${input} mt-1`} autoComplete="current-password" /></label>
                    <label className="block text-sm font-semibold">Type DELETE to confirm<input required value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={`${input} mt-1`} /></label>
                    <button disabled={busy || confirmText !== 'DELETE'} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-md disabled:bg-gray-300">Delete my account</button>
                </form>
            </Panel>
        </div>
    );
}
