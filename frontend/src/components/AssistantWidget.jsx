import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const SUGGESTIONS = ['How do I improve my resume?', 'Give me a 4-week plan for React interviews', 'What should I ask a recruiter?'];

/** Floating career-assistant chat (Groq/LLM behind the API). */
export default function AssistantWidget() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const end = useRef(null);

    useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);
    if (!user) return null;

    const send = async (content) => {
        const msg = (content ?? text).trim();
        if (!msg || busy) return;
        const next = [...messages, { role: 'user', content: msg }];
        setMessages(next);
        setText('');
        setBusy(true);
        try {
            const { reply } = await api.post('/api/ai/chat', { messages: next });
            setMessages([...next, { role: 'assistant', content: reply }]);
        } catch (err) {
            setMessages([...next, { role: 'assistant', content: `⚠️ ${err.message || 'The assistant is unavailable right now.'}` }]);
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed bottom-20 right-4 z-50 lg:bottom-5 lg:right-5">
            {open && (
                <div className="mb-3 w-80 sm:w-96 h-[28rem] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden" role="dialog" aria-label="Career assistant">
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-500 text-white px-4 py-3 flex justify-between items-center">
                        <div><p className="font-bold">Career Assistant</p><p className="text-xs text-teal-50">Ask about resumes, interviews, skills</p></div>
                        <button onClick={() => setOpen(false)} aria-label="Close assistant" className="text-2xl leading-none hover:opacity-80">×</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                        {messages.length === 0 && (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-500">Hi {user.displayName?.split(' ')[0]}! Try one of these:</p>
                                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm bg-white border rounded-lg px-3 py-2 hover:border-teal-400">{s}</button>)}
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-teal-600 text-white rounded-br-sm whitespace-pre-wrap' : 'bg-white border text-gray-800 rounded-bl-sm space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold'}`}>
                                    {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                                </div>
                            </div>
                        ))}
                        {busy && <p className="text-sm text-gray-400 animate-pulse">Thinking…</p>}
                        <div ref={end} />
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t flex gap-2">
                        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type your question…" aria-label="Message"
                            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        <button disabled={busy || !text.trim()} className="bg-teal-600 text-white rounded-full px-4 text-sm font-semibold disabled:bg-gray-300">Send</button>
                    </form>
                </div>
            )}
            <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close assistant' : 'Open career assistant'}
                className="h-14 w-14 rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-xl hover:scale-105 transition flex items-center justify-center text-2xl">
                {open ? '×' : '✦'}
            </button>
        </div>
    );
}
