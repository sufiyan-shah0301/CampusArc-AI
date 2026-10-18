// Minimal iCalendar (.ics) export so interviews/sessions can be added to Google/Outlook/Apple Calendar.
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function downloadIcs({ title, start, durationMin = 30, description = '', uid }) {
    const begin = start instanceof Date ? start : start.toDate();
    const end = new Date(begin.getTime() + durationMin * 60000);
    const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampusArc AI//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        `UID:${uid || `${begin.getTime()}-${Math.random().toString(36).slice(2)}`}@campusarc`,
        `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(begin)}`, `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(title).replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'event'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
