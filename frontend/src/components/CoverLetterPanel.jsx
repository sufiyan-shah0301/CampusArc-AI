import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

/** AI cover-letter helper shown on the job page. `value`/`onChange` hold the letter that will be sent with the application. */
export default function CoverLetterPanel({ jobId, value, onChange, disabled }) {
    const [open, setOpen] = useState(false);
    const [tone, setTone] = useState('professional');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);

    const generate = async () => {
        setBusy(true);
        try {
            const { letter } = await api.post('/api/ai/cover-letter', { jobId, tone, notes });
            onChange(letter);
            toast.success('Draft ready. Read it and make it yours.');
        } catch (e) { toast.error(e.message || 'Could not generate a letter.'); }
        finally { setBusy(false); }
    };

    if (disabled) return null;
    return (
        <div className="mt-6 border rounded-xl p-4 bg-gray-50">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-semibold text-teal-700 hover:underline">
                {open ? '− Hide cover letter' : '+ Add a cover letter (AI can draft it)'}
            </button>
            {open && (
                <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-3 items-end">
                        <label className="text-sm font-semibold text-gray-700">Tone
                            <select value={tone} onChange={(e) => setTone(e.target.value)} className="block mt-1 border rounded-md px-3 py-2 bg-white">
                                <option value="professional">Professional</option><option value="enthusiastic">Enthusiastic</option><option value="concise">Concise</option>
                            </select></label>
                        <label className="text-sm font-semibold text-gray-700 flex-1 min-w-[12rem]">Anything to mention? (optional)
                            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="e.g. my final-year project on chat apps" className="block mt-1 w-full border rounded-md px-3 py-2" /></label>
                        <button type="button" onClick={generate} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-md disabled:bg-gray-400">{busy ? 'Writing…' : value ? 'Regenerate' : '✨ Generate'}</button>
                    </div>
                    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={10} maxLength={3000} aria-label="Cover letter"
                        placeholder="Write your own, or generate a draft from your profile and resume scan." className="w-full p-3 border rounded-lg text-sm" />
                    <p className="text-xs text-gray-400">The draft only uses facts from your profile and resume scan. Always check it before applying. It is sent to the recruiter with your application.</p>
                </div>
            )}
        </div>
    );
}
