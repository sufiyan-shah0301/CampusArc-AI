import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ isDark: false, setIsDark: () => {} });

const read = () => {
    try { return localStorage.getItem('theme') === 'dark'; } catch { return false; }
};

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(read);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    }, [isDark]);

    return <ThemeContext.Provider value={{ isDark, setIsDark }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
