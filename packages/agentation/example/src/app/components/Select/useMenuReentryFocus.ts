'use client';

import * as React from 'react';

/** Radix auto-focus runs on mount. Interrupting an exit reuses that mount,
 * so explicitly re-enter its focus policy without replacing the visual node. */
function useMenuReentryFocus(
  open: boolean,
  content: React.RefObject<HTMLElement | null>,
  focus: (element: HTMLElement) => void,
) {
  const retiring = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (!open) {
      retiring.current = content.current;
      return;
    }
    const previous = retiring.current;
    retiring.current = null;
    if (previous?.isConnected && previous === content.current) focus(previous);
  });
}

export { useMenuReentryFocus };
