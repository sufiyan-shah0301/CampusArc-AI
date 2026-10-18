import React from 'react';

// One consistent stroke icon set (24px grid) for the app shell and dashboards.
const PATHS = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    briefcase: 'M3 8h18v12H3zM9 8V5h6v3M3 13h18',
    clipboard: 'M8 4h8v3H8zM6 5h12v16H6zM9 12h6M9 16h6',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    book: 'M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1zM12 6v14',
    library: 'M4 4h4v16H4zM10 4h4v16h-4zM16 6l4 1-3 13-4-1',
    building: 'M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
    chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
    file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    mic: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4',
    pencil: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    chat: 'M4 5h16v11H9l-5 4z',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3',
    plus: 'M12 5v14M5 12h14',
    users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 5a3 3 0 010 6M17 14a6 6 0 014 6',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
    cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
    flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
    menu: 'M4 6h16M4 12h16M4 18h16',
    x: 'M6 6l12 12M18 6L6 18',
    logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    trending: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    store: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0M10 20v-6h4v6',
    check: 'M5 12l5 5 9-10',
    bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
};

export default function Icon({ name, className = 'h-5 w-5', stroke = 1.8 }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
            <path d={PATHS[name] || PATHS.grid} />
        </svg>
    );
}
