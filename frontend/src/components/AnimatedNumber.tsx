import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, motion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  suffix?: string;
  duration?: number;
}

export default function AnimatedNumber({ value, className = '', suffix = '', duration = 1.2 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    mass: 0.5,
    stiffness: 100,
    damping: 20,
    duration: duration * 1000,
  });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${Math.round(latest)}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, suffix]);

  return <motion.span ref={ref} className={`font-mono ${className}`}>{`0${suffix}`}</motion.span>;
}
