import '@testing-library/jest-dom';

jest.mock('framer-motion', () => {
  const React = require('react');
  const strip = (p = {}) => {
    const {
      whileInView,
      initial,
      animate,
      viewport,
      transition,
      variants,
      ...rest
    } = p;
    return rest;
  };
  const wrap =
    (Tag) =>
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
  jest.spyOn(console, 'warn').mockImplementation((msg) => {
    if (typeof msg === 'string' && msg.includes('React Router Future Flag Warning')) return;
    console.warn(msg);
  });
});
