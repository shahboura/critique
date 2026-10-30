'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { createMenuCommitQueue } from './menuCommitQueue';

interface MenuOwner {
  dismiss: () => void;
}
// A document owns one transient choice surface. Submenus share their root's
// ownership; independent React trees and Select use the same handoff.
const owners = new WeakMap<Document, MenuOwner>();

function useMenuOpen({
  open: controlled,
  defaultOpen = false,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [local, setLocal] = React.useState(defaultOpen);
  const open = controlled ?? local;
  const trigger = React.useRef<HTMLButtonElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  const suppressRestore = React.useRef(false);
  const escape = React.useRef<((event: KeyboardEvent) => void) | null>(null);
  const [commits] = React.useState(createMenuCommitQueue);
  const latest = React.useRef({ open, controlled, onOpenChange });
  latest.current = { open, controlled, onOpenChange };
  const completeClose = React.useCallback(() => {
    if (!latest.current.open) commits.finish();
  }, [commits]);
  React.useEffect(() => () => commits.clear(), [commits]);
  const owner = React.useRef<MenuOwner>({ dismiss: () => {} });
  const claim = React.useCallback((synchronous = false) => {
    const doc = trigger.current?.ownerDocument ?? document;
    const previous = owners.get(doc);
    if (previous === owner.current) return;
    owners.set(doc, owner.current);
    if (previous) {
      // Release the old modal's focus trap before mounting the next surface.
      // Event-driven opens can flush this handoff; external controlled opens
      // are reconciled in the layout effect without flushing during a commit.
      if (synchronous) flushSync(previous.dismiss);
      else previous.dismiss();
    }
  }, []);
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next === latest.current.open) return;
      if (next) {
        suppressRestore.current = false;
        claim(true);
      }
      latest.current.open = next;
      if (latest.current.controlled === undefined) setLocal(next);
      latest.current.onOpenChange?.(next);
    },
    [claim],
  );
  owner.current.dismiss = () => {
    // The closing surface must not pull focus out of the new surface after
    // its exit animation. Escape/selection still restore focus normally.
    suppressRestore.current = true;
    setOpen(false);
  };
  React.useLayoutEffect(() => {
    const doc = trigger.current?.ownerDocument ?? document;
    const handle = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        !latest.current.open ||
        owners.get(doc) !== owner.current
      )
        return;
      // A retiring Radix layer remains mounted during its visual exit. Route
      // Escape to the current owner even when that old layer is still last in
      // Radix's stack, so a rapid handoff never swallows the next key press.
      escape.current?.(event);
      if (!event.defaultPrevented) setOpen(false);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    doc.addEventListener('keydown', handle, true);
    return () => doc.removeEventListener('keydown', handle, true);
  }, [setOpen]);
  React.useLayoutEffect(() => {
    if (!open) return;
    suppressRestore.current = false;
    claim();
    const doc = trigger.current?.ownerDocument ?? document;
    const current = owner.current;
    return () => {
      if (owners.get(doc) === current) owners.delete(doc);
    };
  }, [open, claim]);
  return {
    open,
    setOpen,
    trigger,
    content,
    suppressRestore,
    escape,
    afterClose: commits.defer,
    completeClose,
  };
}

export { useMenuOpen };
