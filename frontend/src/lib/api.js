// Thin client for the CampusArc API.
// - keeps JWT access/refresh tokens, refreshes transparently on 401
// - turns ISO date strings into Ts objects with .toDate(), .toMillis() and .seconds,
//   so date-rendering code can treat every timestamp the same way
// - exposes realtime subscriptions over a single shared WebSocket

const BASE = import.meta.env.VITE_API_URL || '';
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export class Ts {
    constructor(date) { this._d = date; }
    toDate() { return this._d; }
    toMillis() { return this._d.getTime(); }
    get seconds() { return Math.floor(this._d.getTime() / 1000); }
    toJSON() { return this._d.toISOString(); }
    valueOf() { return this._d.getTime(); }
    toString() { return this._d.toString(); }
}

const revive = (v) => {
    if (typeof v === 'string') return ISO_RE.test(v) ? new Ts(new Date(v)) : v;
    if (Array.isArray(v)) return v.map(revive);
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) out[k] = revive(v[k]);
        return out;
    }
    return v;
};

// ---------- token storage (wrapped: storage can be unavailable) ----------
const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const tokens = {
    access: () => store.get('cb_access'),
    refresh: () => store.get('cb_refresh'),
    set: (a, r) => { store.set('cb_access', a); store.set('cb_refresh', r); },
    clear: () => { store.del('cb_access'); store.del('cb_refresh'); },
};

export class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

const messageFrom = (data, status) => {
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((e) => `${(e.loc || []).slice(1).join('.')}: ${e.msg}`).join('; ');
    return data?.error || `Request failed (${status})`;
};

let refreshing = null;
async function refreshTokens() {
    if (!tokens.refresh()) return false;
    if (!refreshing) {
        refreshing = fetch(`${BASE}/api/auth/refresh`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: tokens.refresh() }),
        }).then(async (r) => {
            if (!r.ok) return false;
            const j = await r.json();
            tokens.set(j.accessToken, j.refreshToken);
            return true;
        }).catch(() => false).finally(() => { refreshing = null; });
    }
    return refreshing;
}

async function request(method, path, { body, params, form, retry = true } = {}) {
    let url = BASE + path;
    if (params) {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); });
        const s = q.toString();
        if (s) url += `?${s}`;
    }
    const headers = {};
    if (tokens.access()) headers.Authorization = `Bearer ${tokens.access()}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
    if (res.status === 401 && retry && tokens.refresh() && !path.startsWith('/api/auth/')) {
        if (await refreshTokens()) return request(method, path, { body, params, form, retry: false });
        tokens.clear();
        window.dispatchEvent(new Event('cb:logout'));
    }
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status));
    return revive(data);
}

export const api = {
    get: (path, params) => request('GET', path, { params }),
    post: (path, body) => request('POST', path, { body: body ?? {} }),
    patch: (path, body) => request('PATCH', path, { body }),
    del: (path, body) => request('DELETE', path, { body }),
    upload: (path, form) => request('POST', path, { form }),

    // collections
    list: (coll, params) => request('GET', `/api/${coll}`, { params }),
    count: async (coll, params) => (await request('GET', `/api/${coll}`, { params: { ...params, count: true } })).count,
    getDoc: (coll, id) => request('GET', `/api/${coll}/${id}`),
    create: (coll, body) => request('POST', `/api/${coll}`, { body }),
    update: (coll, id, fields = {}, ops) => request('PATCH', `/api/${coll}/${id}`, { body: ops ? { ...fields, $ops: ops } : fields }),
    remove: (coll, id) => request('DELETE', `/api/${coll}/${id}`),

    // sub-collections (courses/lessons, chats/messages, qna_sessions/questions)
    listSub: (coll, id, sub) => request('GET', `/api/${coll}/${id}/${sub}`),
    getSub: (coll, id, sub, subId) => request('GET', `/api/${coll}/${id}/${sub}/${subId}`),
    createSub: (coll, id, sub, body) => request('POST', `/api/${coll}/${id}/${sub}`, { body }),
    updateSub: (coll, id, sub, subId, body) => request('PATCH', `/api/${coll}/${id}/${sub}/${subId}`, { body }),
    removeSub: (coll, id, sub, subId) => request('DELETE', `/api/${coll}/${id}/${sub}/${subId}`),

    /** Download a file from an authenticated endpoint (CSV exports). */
    download: async (path, filename) => {
        const fetchFile = () => fetch(BASE + path, { headers: { Authorization: `Bearer ${tokens.access()}` } });
        let res = await fetchFile();
        if (res.status === 401 && (await refreshTokens())) res = await fetchFile();
        if (!res.ok) throw new ApiError(res.status, 'Download failed');
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    startChat: (userId) => request('POST', '/api/chats/start', { body: { userId } }),
};

// ---------- realtime ----------
const listeners = new Map(); // room -> Set<callback>
let ws = null;
let ready = false;
let retry = 0;

function wsUrl() {
    if (BASE) return BASE.replace(/^http/, 'ws') + '/ws';
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

function connect() {
    if (ws || !tokens.access() || listeners.size === 0) return;
    ws = new WebSocket(wsUrl());
    ws.onopen = () => ws.send(JSON.stringify({ token: tokens.access() }));
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.event === 'ready') {
            ready = true; retry = 0;
            listeners.forEach((_, room) => ws.send(JSON.stringify({ action: 'subscribe', room })));
        } else if (msg.event === 'changed') {
            listeners.get(msg.room)?.forEach((cb) => cb());
        }
    };
    ws.onclose = async () => {
        ws = null; ready = false;
        if (listeners.size === 0) return;
        if (retry > 1) await refreshTokens(); // token may have expired
        setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
    };
}

/** Calls `cb` whenever something in `room` changed. Returns an unsubscribe function. */
export function subscribe(room, cb) {
    if (!listeners.has(room)) listeners.set(room, new Set());
    listeners.get(room).add(cb);
    if (ws && ready) ws.send(JSON.stringify({ action: 'subscribe', room }));
    else connect();
    return () => {
        const set = listeners.get(room);
        if (!set) return;
        set.delete(cb);
        if (set.size === 0) {
            listeners.delete(room);
            if (ws && ready) ws.send(JSON.stringify({ action: 'unsubscribe', room }));
        }
    };
}

export function closeRealtime() {
    listeners.clear();
    if (ws) { ws.onclose = null; ws.close(); ws = null; ready = false; }
}
