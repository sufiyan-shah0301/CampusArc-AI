import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

const MAX_SECONDS = 180;

/** Records the microphone, sends it for transcription and reports the text + delivery analysis. Audio is not stored. */
export default function VoiceRecorder({ onText, onSpeech, disabled }) {
    const [state, setState] = useState('idle'); // idle | recording | processing
    const [secs, setSecs] = useState(0);
    const rec = useRef(null);
    const chunks = useRef([]);
    const timer = useRef(null);
    const startedAt = useRef(0);
    const stream = useRef(null);

    const cleanup = () => { clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); };
    useEffect(() => cleanup, []);
    const stop = () => { if (rec.current?.state === 'recording') rec.current.stop(); };

    const start = async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast.error('Voice recording is not supported in this browser.');
        try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch { return toast.error('Microphone permission was denied.'); }
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
        const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
        chunks.current = [];
        r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
        r.onstop = async () => {
            cleanup();
            setState('processing');
            const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
            const form = new FormData();
            form.append('file', blob, 'answer.webm');
            form.append('duration', String((Date.now() - startedAt.current) / 1000));
            try {
                const res = await api.upload('/api/ai/transcribe', form);
                onText(res.text);
                onSpeech(res.speech);
                toast.success('Transcribed. You can edit the text before submitting.');
            } catch (e) { toast.error(e.message || 'Could not transcribe.'); }
            finally { setState('idle'); setSecs(0); }
        };
        rec.current = r;
        startedAt.current = Date.now();
        r.start();
        setState('recording');
        timer.current = setInterval(() => { const s = Math.round((Date.now() - startedAt.current) / 1000); setSecs(s); if (s >= MAX_SECONDS) stop(); }, 500);
    };

    return (
        <div className="flex items-center gap-3">
            {state === 'recording' ? (
                <button type="button" onClick={stop} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-full">
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" /> Stop · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
                </button>
            ) : (
                <button type="button" onClick={start} disabled={disabled || state === 'processing'} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-full disabled:bg-gray-400">
                    🎤 {state === 'processing' ? 'Transcribing…' : 'Answer by voice'}
                </button>
            )}
            <span className="text-xs text-gray-400">Up to 3 minutes. Audio is processed once and not stored.</span>
        </div>
    );
}

export function SpeechCard({ speech }) {
    if (!speech) return null;
    const tone = { good: 'text-green-700', fast: 'text-amber-600', slow: 'text-amber-600' }[speech.pace];
    return (
        <div className="bg-indigo-50 rounded-lg p-4 text-sm">
            <p className="font-bold text-indigo-900 mb-2">Delivery analysis</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div><p className={`text-xl font-extrabold ${tone}`}>{speech.wordsPerMinute}</p><p className="text-xs text-gray-500">words / min ({speech.pace})</p></div>
                <div><p className="text-xl font-extrabold text-gray-800">{speech.fillerCount}</p><p className="text-xs text-gray-500">filler words{speech.fillers.length ? ` (${speech.fillers.join(', ')})` : ''}</p></div>
                <div><p className="text-xl font-extrabold text-gray-800">{speech.longPauses}</p><p className="text-xs text-gray-500">long pauses</p></div>
                <div><p className="text-xl font-extrabold text-gray-800">{speech.clarity ?? '–'}</p><p className="text-xs text-gray-500">speech clarity</p></div>
            </div>
            <ul className="mt-3 list-disc pl-5 text-indigo-900 space-y-1">{speech.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
    );
}
