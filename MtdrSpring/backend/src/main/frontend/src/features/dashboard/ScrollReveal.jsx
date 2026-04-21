import React from 'react';
import { motion } from 'framer-motion';

/** Viewport shared by scroll-reveal blocks: fire once, slightly before the block is centered. */
export const DASHBOARD_SCROLL_VIEWPORT = {
  once: true,
  margin: '0px 0px -14% 0px',
  amount: 0.12,
};

const easeOut = [0.22, 1, 0.36, 1];

/**
 * Fade + slide up when the block enters the viewport (scroll-driven).
 */
export default function ScrollReveal({
  children,
  delay = 0,
  y = 22,
  duration = 0.48,
  viewport = DASHBOARD_SCROLL_VIEWPORT,
  style,
  ...rest
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration, delay, ease: easeOut }}
      style={{ width: '100%', minWidth: 0, ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
