'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** The chevron bends through its center, without a sideways turn. */
function SelectChevron({ open }: { open: boolean }) {
  const reduced = useReducedMotion();
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <motion.path
        initial={false}
        animate={{ d: open ? 'M17 14L12 9L7 14' : 'M17 9L12 14L7 9' }}
        transition={{ duration: reduced ? 0 : 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </svg>
  );
}

export { SelectChevron };
