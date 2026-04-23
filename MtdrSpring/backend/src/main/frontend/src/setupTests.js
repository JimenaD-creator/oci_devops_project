import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, vi } from 'vitest';

// Do not load the real framer-motion runtime in tests (animations, layout, etc.).
// Strip animation-only props so MUI `component={motion.div}` and `<motion.div>` still render.
configure({
  asyncUtilTimeout: 2000,
  reactStrictMode: false,
});

// Vitest does not wire Jest’s Testing Library auto-cleanup; unmount after each test.
afterEach(() => {
  cleanup();
});
vi.mock('framer-motion', () => {
  const strip = (p = {}) => {
    const { whileInView, initial, animate, viewport, transition, variants, ...rest } = p;
    return rest;
  };
  const wrap = (Tag) =>
    React.forwardRef((props, ref) => {
      const C = typeof Tag === 'string' ? Tag : Tag || 'div';
      return React.createElement(C, { ref, ...strip(props) }, props.children);
    });
  const motionFn = (Tag) => wrap(Tag);
  motionFn.div = wrap('div');
  motionFn.span = wrap('span');
  motionFn.h4 = wrap('h4');
  motionFn.section = wrap('section');
  motionFn.p = wrap('p');
  motionFn.article = wrap('article');
  return {
    motion: motionFn,
    AnimatePresence: ({ children }) => children,
    useInView: () => true,
  };
});

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation((msg) => {
    if (typeof msg === 'string' && msg.includes('React Router Future Flag Warning')) return;
    console.warn(msg);
  });
});
