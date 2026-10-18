import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';

const ICONS = { application: '📥', status: '📌', message: '💬', appointment: '📅', job_flagged: '🚩', job_review: '✅', integrity: '🛡️' };

const ago = (ts) => {
    const s = Math.max(1, Math.round((Date.now() - ts.toMillis()) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
};

/** Bell with unread badge; updates live over the WebSocket. */
export default function NotificationBell() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    const navigate = useNavigate();

    useLive(async () => { setItems(await api.list('notifications', { limit: 30 })); }, 'notifications', [], 30000);

    useEffect(() => {
        const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const unread = items.filter((n) => !n.read).length;

    const openItem = async (n) => {
        setOpen(false);
        if (!n.read) {
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
            api.update('notifications', n.id, { read: true }).catch(() => {});
        }
        if (n.link) navigate(n.link);
    };

    const markAll = async () => {
        setItems((prev) => prev.map((x) => ({ ...x, read: true })));
        api.post('/api/notifications/read-all').catch(() => {});
    };

    return (
        <div className="relative" ref={box}>
            <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}
                className="relative p-2 rounded-full text-gray-600 hover:bg-gray-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" /></svg>
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl border z-50 overflow-hidden" role="menu">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                        <span className="font-bold text-gray-800">Notifications</span>
                        {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-teal-700 hover:underline">Mark all read</button>}
                    </div>
                    <ul className="max-h-96 overflow-y-auto divide-y">
                        {items.length === 0 && <li className="p-6 text-center text-sm text-gray-400">You're all caught up.</li>}
                        {items.map((n) => (
                            <li key={n.id}>
                                <button onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 ${n.read ? '' : 'bg-teal-50/60'}`}>
                                    <span className="text-lg">{ICONS[n.type] || '🔔'}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className={`block text-sm ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</span>
                                        {n.body && <span className="block text-xs text-gray-500 truncate">{n.body}</span>}
                                        <span className="block text-[11px] text-gray-400 mt-0.5">{ago(n.createdAt)}</span>
                                    </span>
                                    {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-teal-500 flex-shrink-0" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
