import { useEffect, useRef } from 'react';
import { subscribe } from '../lib/api';

/**
 * Runs `load` now, again whenever the server says `room` changed, and every `pollMs` as a safety net
 * (covers dropped WebSocket connections). `load` may be a new closure on each render.
 */
export default function useLive(load, room, deps = [], pollMs = 20000) {
    const ref = useRef(load);
    ref.current = load;

    useEffect(() => {
        let alive = true;
        const run = () => { if (alive) Promise.resolve(ref.current()).catch((e) => console.error('live load failed:', e)); };
        run();
        const unsub = room ? subscribe(room, run) : () => {};
        const timer = pollMs ? setInterval(run, pollMs) : null;
        return () => { alive = false; unsub(); if (timer) clearInterval(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, ...deps]);
}
