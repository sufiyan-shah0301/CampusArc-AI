import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'framer-motion';

export function FadeUp({ children, delay = 0, className = '' }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }} className={className}>
            {children}
        </motion.div>
    );
}

/** CSS-driven entrance (runs even when JS animation frames are throttled, e.g. background tabs or slow phones). */
export function Rise({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
    return <Tag className={`animate-rise ${className}`} style={{ animationDelay: `${delay}s` }} {...rest}>{children}</Tag>;
}

export function CountUp({ value, decimals = 0, suffix = '' }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const [n, setN] = useState(0);
    useEffect(() => {
        if (!inView) return undefined;
        const c = animate(0, value, { duration: 1.4, ease: [0.21, 0.47, 0.32, 0.98], onUpdate: setN });
        return () => c.stop();
    }, [inView, value]);
    return <span ref={ref}>{n.toFixed(decimals)}{suffix}</span>;
}
