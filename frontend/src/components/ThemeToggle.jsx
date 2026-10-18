import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
    const { isDark, setIsDark } = useTheme();
    return (
        <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-lg text-slate-600 transition hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
        >
            {isDark ? '☀️' : '🌙'}
        </button>
    );
}
