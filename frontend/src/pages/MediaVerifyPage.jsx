import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import ScoreRing, { Bar } from '../components/ScoreRing';
import { LineChart, Panel } from '../components/Charts';

const VERDICT = {
    likely_fake: ['Likely AI-generated or manipulated', 'bg-red-50 border-red-300 text-red-800', '⚠️'],
    uncertain: ['Inconclusive: treat with caution', 'bg-yellow-50 border-yellow-300 text-yellow-800', '❔'],
    likely_real: ['Likely authentic', 'bg-green-50 border-green-300 text-green-800', '✅'],
};
const LEVEL = { high: ['High risk: do not enter any details', 'bg-red-50 border-red-300 text-red-800', '🛑'], medium: ['Suspicious: be careful', 'bg-yellow-50 border-yellow-300 text-yellow-800', '⚠️'], low: ['No strong warning signs', 'bg-green-50 border-green-300 text-green-800', '✅'] };

const Cleared = ({ what }) => <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full" title="Nothing was stored">🧹 {what} cleared after analysis</span>;

// ------------------------------------------------------------------ tab 1: image / video
function CheckMedia() {
    const [file, setFile] = useState(null);
    const [save, setSave] = useState(false);
    const [busy, setBusy] = useState(false);
    const [res, setRes] = useState(null);
    const [drag, setDrag] = useState(false);
    const input = useRef(null);
    const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

    const pick = (f) => {
        if (!f) return;
        const isVideo = f.type.startsWith('video/');
        if (!isVideo && !/^image\/(jpeg|png|webp)$/.test(f.type)) return toast.error('Use a JPEG, PNG or WebP image, or an MP4 / WebM / MOV video.');
        if (f.size > (isVideo ? 30 : 8) * 1024 * 1024) return toast.error(`File too large (max ${isVideo ? 30 : 8} MB).`);
        setFile(f); setRes(null);
    };
    const run = async () => {
        const form = new FormData();
        form.append('file', file);
        form.append('save', save ? 'true' : 'false');
        setBusy(true);
        try { setRes(await api.upload('/api/media/analyze', form)); } catch (e) { toast.error(e.message || 'Analysis failed.'); } finally { setBusy(false); }
    };
    const v = res && VERDICT[res.verdict];
    return (
        <div className="space-y-6">
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
                onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition ${drag ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400'}`}>
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                {file ? <p className="font-semibold text-gray-800">{file.name} <span className="text-gray-400 font-normal">({(file.size / 1048576).toFixed(1)} MB)</span></p>
                    : <><p className="font-semibold text-gray-700">Drop a photo or video here, or click to choose</p><p className="text-sm text-gray-400 mt-1">Images up to 8 MB, videos up to 30 MB. Analysed in memory and deleted immediately.</p></>}
            </div>
            <div className="flex flex-wrap items-center gap-4">
                <button onClick={run} disabled={!file || busy} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3 rounded-lg disabled:bg-gray-400">{busy ? 'Analysing… (up to 30 s for videos)' : 'Check authenticity'}</button>
                <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Keep a summary report for 24 hours (the file itself is never kept)</label>
            </div>

            {res && (
                <div className="space-y-6">
                    <div className={`border-2 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6 ${v[1]}`}>
                        <ScoreRing value={res.fakeProbability * 100} label="Fake probability" size={110} />
                        <div className="flex-1">
                            <p className="text-2xl font-extrabold">{v[2]} {v[0]}</p>
                            <p className="text-sm mt-1 opacity-90">{res.kind === 'video' ? `${res.framesAnalysed} frames analysed.` : res.faceFound ? 'A face was found and analysed.' : 'No clear face found; whole image analysed.'} This is a risk signal from machine-learning models, not proof.</p>
                            <div className="mt-2"><Cleared what="Upload" /></div>
                        </div>
                    </div>
                    {res.knownMatch && <p className="bg-indigo-50 text-indigo-900 rounded-lg p-3 text-sm">🗂️ {res.knownMatch.text} (perceptual-hash distance {res.knownMatch.distance}).</p>}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Panel title="Evidence">
                            {res.kind === 'image' && (
                                <div className="space-y-3">
                                    <Bar label="Forensic signals (Random Forest)" value={Math.round(res.forensicModel * 100)} />
                                    <Bar label="Image-embedding models (CLIP)" value={Math.round(res.embeddingModel * 100)} />
                                    <Bar label="Unusualness vs real photos (experimental)" value={Math.round(res.anomalyPercentile * 100)} />
                                </div>
                            )}
                            {res.kind === 'video' && (
                                <div className="space-y-3">
                                    <Bar label="Frames that look synthetic" value={Math.round(res.fractionFakeFrames * 100)} />
                                    <Bar label="Peak frame score" value={Math.round(res.maxProbability * 100)} />
                                    <Bar label="Unusualness vs real photos (experimental)" value={Math.round(res.anomalyPercentile * 100)} />
                                    <p className="text-xs text-gray-500">Frame-to-frame swing {res.temporalFlicker}: sharp swings can mean spliced or face-swapped segments.</p>
                                </div>
                            )}
                            {res.reasons?.length > 0 && <ul className="mt-4 list-disc pl-5 text-sm text-gray-700 space-y-1">{res.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                        </Panel>
                        <Panel title={res.kind === 'video' ? 'Most suspicious frame: error-level map' : 'Error-level map'}>
                            <div className="grid grid-cols-2 gap-3">
                                {res.kind === 'image' && preview && <figure><img src={preview} alt="Your upload" className="w-full rounded-lg" /><figcaption className="text-xs text-gray-400 mt-1">Your image</figcaption></figure>}
                                {res.heatmap && <figure><img src={res.heatmap} alt="Error level analysis heat map" className="w-full rounded-lg" /><figcaption className="text-xs text-gray-400 mt-1">Brighter = regions that re-compress differently (edited / synthetic)</figcaption></figure>}
                            </div>
                        </Panel>
                    </div>
                    {res.kind === 'video' && <Panel title="Authenticity timeline"><LineChart points={res.timeline.map((t) => ({ label: `${t.time}s`, value: Math.round(t.p * 100) }))} max={100} yLabel="fake probability %" color="#dc2626" /></Panel>}
                </div>
            )}
        </div>
    );
}

// ------------------------------------------------------------------ tab 2: live webcam monitor
function LiveCheck() {
    const video = useRef(null);
    const stream = useRef(null);
    const timer = useRef(null);
    const busy = useRef(false);
    const [on, setOn] = useState(false);
    const [points, setPoints] = useState([]);
    const [last, setLast] = useState(null);

    const stop = () => { clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setOn(false); };
    useEffect(() => stop, []);

    const start = async () => {
        if (!navigator.mediaDevices?.getUserMedia) return toast.error('Camera access is not supported in this browser.');
        try { stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false }); }
        catch { return toast.error('Camera permission was denied.'); }
        video.current.srcObject = stream.current;
        await video.current.play();
        setOn(true); setPoints([]);
        timer.current = setInterval(grab, 2500);
        setTimeout(grab, 600);
    };
    const grab = async () => {
        const v = video.current;
        if (busy.current || !v || !v.videoWidth) return;
        busy.current = true;
        try {
            const c = document.createElement('canvas');
            c.width = 480; c.height = Math.round((480 * v.videoHeight) / v.videoWidth);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
            const form = new FormData();
            form.append('file', blob, 'frame.jpg');
            const r = await api.upload('/api/media/frame', form);
            setLast(r);
            setPoints((p) => [...p, { label: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }), value: Math.round(r.fakeProbability * 100) }].slice(-24));
        } catch (e) { if (e.status === 429) toast.error('Slow down: too many frames. Pausing.'), stop(); }
        finally { busy.current = false; }
    };
    const recent = points.slice(-3);
    const alert = recent.length === 3 && recent.every((p) => p.value >= 60);
    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-600">Watches a live camera or video-call feed and raises an alert if the face looks synthetic. One small frame every 2.5 seconds is analysed and immediately discarded; no video is recorded or stored.</p>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div>
                    <div className={`relative rounded-xl overflow-hidden bg-black aspect-video ${alert ? 'ring-4 ring-red-500' : on ? 'ring-4 ring-green-400' : ''}`}>
                        <video ref={video} muted playsInline className="w-full h-full object-cover" />
                        {!on && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Camera is off</div>}
                        {on && <span className="absolute top-2 left-2 text-xs font-bold bg-red-600 text-white px-2 py-1 rounded-full animate-pulse">LIVE</span>}
                    </div>
                    <div className="mt-3 flex gap-3">
                        {on ? <button onClick={stop} className="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-5 py-2 rounded-lg">Stop monitoring</button>
                            : <button onClick={start} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2 rounded-lg">Start camera</button>}
                    </div>
                </div>
                <div className="space-y-4">
                    {alert && <div role="alert" className="bg-red-600 text-white rounded-xl p-4 font-bold">🚨 Possible deepfake: the last 3 frames all scored high. Do not share sensitive information.</div>}
                    <Panel title="Live authenticity">
                        <div className="flex items-center gap-6">
                            <ScoreRing value={last ? last.fakeProbability * 100 : 0} label="Fake probability" size={96} />
                            <p className="text-sm text-gray-600">{!last ? 'Waiting for the first frame…' : !last.faceFound ? 'No face in view' : VERDICT[last.verdict][0]}</p>
                        </div>
                        <div className="mt-4"><LineChart points={points} max={100} yLabel="fake probability %" color="#dc2626" /></div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ tab 3: safe link (disposable browser)
function SafeLink() {
    const [url, setUrl] = useState('');
    const [js, setJs] = useState(false);
    const [busy, setBusy] = useState('');
    const [quick, setQuick] = useState(null);
    const [page, setPage] = useState(null);

    const check = async (e) => {
        e.preventDefault();
        setBusy('quick'); setPage(null);
        try { setQuick(await api.post('/api/safe/check-url', { url })); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
    };
    const open = async () => {
        setBusy('open'); setQuick(null);
        try { setPage(await api.post('/api/safe/open', { url, javascript: js })); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
    };
    const shown = page || quick;
    const lv = shown && LEVEL[shown.riskLevel];
    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-600">Got a link from an unknown recruiter, e-mail or message? Check it first. The disposable browser opens it on our server in an isolated, throw-away Chromium, so your device, cookies and logins are never exposed. Everything is deleted when it finishes.</p>
            <form onSubmit={check} className="flex flex-col md:flex-row gap-3">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link, e.g. https://example.com/offer" aria-label="Link to check" maxLength={2048} required className="flex-1 border rounded-lg px-4 py-3" />
                <button disabled={!!busy} className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-5 py-3 rounded-lg disabled:bg-gray-400">{busy === 'quick' ? 'Checking…' : 'Quick check'}</button>
                <button type="button" onClick={open} disabled={!!busy || url.length < 3} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-3 rounded-lg disabled:bg-gray-400">{busy === 'open' ? 'Opening safely…' : 'Open in disposable browser'}</button>
            </form>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={js} onChange={(e) => setJs(e.target.checked)} /> Allow JavaScript in the sandbox (some pages need it; off is safer)</label>

            {shown && (
                <div className="space-y-6">
                    <div className={`border-2 rounded-xl p-5 flex items-center gap-6 ${lv[1]}`}>
                        <ScoreRing value={shown.riskScore} label="Risk" size={96} />
                        <div><p className="text-xl font-extrabold">{lv[2]} {lv[0]}</p>
                            {page && <div className="mt-2"><Cleared what="Browser session" /></div>}
                            {!page && <p className="text-sm mt-1 opacity-90">Address check only. Nothing was loaded. Use the disposable browser to see the page itself.</p>}</div>
                    </div>
                    {shown.reasons?.length > 0 && <Panel title="Why"><ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">{shown.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Panel>}
                    {page && !page.opened && <p className="bg-yellow-50 text-yellow-900 rounded-lg p-4">{page.error}</p>}
                    {page?.opened && (
                        <div className="grid lg:grid-cols-2 gap-6">
                            <Panel title="What the page looks like (screenshot from the sandbox)"><img src={page.screenshot} alt="Sandbox screenshot of the page" className="w-full rounded-lg border" /></Panel>
                            <Panel title="Details">
                                <dl className="text-sm space-y-2">
                                    <div><dt className="font-semibold text-gray-500">Page title</dt><dd className="break-words">{page.title || '(none)'}</dd></div>
                                    <div><dt className="font-semibold text-gray-500">Where it really lands</dt><dd className="font-mono text-xs break-all">{page.finalUrl}</dd></div>
                                    {page.redirects.length > 0 && <div><dt className="font-semibold text-gray-500">Redirect chain ({page.redirects.length})</dt><dd className="font-mono text-xs break-all">{page.redirects.join(' → ')}</dd></div>}
                                    <div><dt className="font-semibold text-gray-500">Password fields</dt><dd>{page.passwordFields} · forms: {page.forms.length}</dd></div>
                                    {page.externalDomains.length > 0 && <div><dt className="font-semibold text-gray-500">Other sites it contacts</dt><dd className="font-mono text-xs">{page.externalDomains.join(', ')}</dd></div>}
                                    {page.blockedRequests.length > 0 && <div><dt className="font-semibold text-red-600">Blocked internal-network requests</dt><dd className="font-mono text-xs">{page.blockedRequests.join(', ')}</dd></div>}
                                    <div><dt className="font-semibold text-gray-500">URL model score</dt><dd>{page.urlModelScore}% (trained on 500k labelled URLs)</dd></div>
                                </dl>
                            </Panel>
                            {page.textPreview && <Panel title="Page text (safe, plain text only)" className="lg:col-span-2"><pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-60 overflow-auto">{page.textPreview}</pre></Panel>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function MediaVerifyPage() {
    const [tab, setTab] = useState('media');
    const tabs = [['media', '🖼️ Photo / video'], ['live', '🎥 Live check'], ['link', '🔗 Safe link']];
    return (
        <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
                <h1 className="text-4xl font-black text-slate-800">Verify & Browse Safely</h1>
                <p className="text-slate-500 mt-2">Spot AI-generated faces and fake videos, and open suspicious links without risk. Built for checking profile photos, video-interview feeds and unknown recruiter links.</p>
            </div>
            <div className="flex justify-center gap-2 mb-8 flex-wrap" role="tablist">
                {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-5 py-2 rounded-full font-semibold transition ${tab === k ? 'bg-teal-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{label}</button>)}
            </div>
            {tab === 'media' && <CheckMedia />}
            {tab === 'live' && <LiveCheck />}
            {tab === 'link' && <SafeLink />}
            <p className="text-center text-xs text-gray-400 mt-10">Automated detection is never 100% accurate. Use these results to decide when to look closer, not as proof. <a href="/security" className="underline">Privacy & security settings</a></p>
        </div>
    );
}
