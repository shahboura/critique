"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Primitive from "@radix-ui/react-select";
import { useReducedMotion } from "framer-motion";
import { TextMotion } from "../TextMotion";
import { SelectChevron } from "./SelectChevron";
import { SelectViewport } from "./SelectViewport";
import { useMenuOpen } from "./useMenuOpen";
import { useMenuReentryFocus } from "./useMenuReentryFocus";
import styles from "./Select.module.css";

type SelectProps = {
  id: string;
  value: string;
  options: readonly string[];
  onValueChange: (value: string) => void;
};

export function Select({ id, value, options, onValueChange }: SelectProps) {
  const surface = useMenuOpen({});
  const reduced = useReducedMotion();
  const pressedOpen = useRef<boolean | null>(null);
  const visibleSelection = useRef(value);
  const [frozen, setFrozen] = useState(false);
  const keyboard = useRef(false);
  const [focusVisible, setFocusVisible] = useState(false);

  useEffect(() => {
    const doc = surface.trigger.current?.ownerDocument ?? document;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      keyboard.current = true;
      if (doc.activeElement === surface.trigger.current) setFocusVisible(true);
    };
    const onPointerDown = () => {
      keyboard.current = false;
      setFocusVisible(false);
    };
    doc.addEventListener("keydown", onKeyDown, true);
    doc.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [surface.trigger]);

  useLayoutEffect(() => {
    surface.escape.current = () => { keyboard.current = true; };
  }, [surface.escape]);

  useLayoutEffect(() => {
    setFrozen(false);
  }, [surface.open]);
  useLayoutEffect(() => {
    if (surface.open && !frozen) visibleSelection.current = value;
  }, [value, surface.open, frozen]);

  useMenuReentryFocus(surface.open, surface.content, (element) => {
    const selected = element.querySelector<HTMLElement>(
      '[role="option"][data-state="checked"]',
    );
    (selected ?? element).focus({ preventScroll: true });
  });

  // Close immediately without flashing the next selection's mark during exit.
  const markedValue = surface.open && !frozen ? value : visibleSelection.current;

  return (
    <Primitive.Root
      value={value}
      open={surface.open}
      onOpenChange={surface.setOpen}
      onValueChange={(next) => {
        if (surface.open) setFrozen(true);
        onValueChange(next);
      }}
    >
      <Primitive.Trigger
        id={id}
        ref={surface.trigger}
        className={styles.root}
        data-select-trigger=""
        data-focus-visible={focusVisible || undefined}
        onFocus={() => setFocusVisible(keyboard.current)}
        onBlur={() => setFocusVisible(false)}
        onPointerDown={(event) => {
          pressedOpen.current = surface.open;
          if (surface.open) event.preventDefault();
        }}
        onPointerCancel={() => { pressedOpen.current = null; }}
        onClick={(event) => {
          const wasOpen = pressedOpen.current ?? surface.open;
          pressedOpen.current = null;
          if (wasOpen) {
            event.preventDefault();
            surface.setOpen(false);
          }
        }}
      >
        <Primitive.Value data-select-value="">
          <TextMotion animated={!reduced}>{value}</TextMotion>
        </Primitive.Value>
        <Primitive.Icon className={styles.chevron}>
          <SelectChevron open={surface.open} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <div className={styles.portal}>
          <Primitive.Content
            ref={surface.content}
            className={`${styles.surface} ${styles.content}`}
            data-select-surface=""
            position="popper"
            sideOffset={6}
            collisionPadding={8}
            onPointerDownOutside={(event) => {
              if (surface.trigger.current?.contains(event.target as Node)) {
                event.preventDefault();
              }
            }}
            onCloseAutoFocus={(event) => {
              if (surface.suppressRestore.current) event.preventDefault();
              surface.completeClose();
            }}
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <SelectViewport>
              {options.map((option) => (
                <Primitive.Item key={option} value={option} className={styles.item}>
                  <Primitive.ItemText>{option}</Primitive.ItemText>
                  <span className={styles.indicator} data-selected={markedValue === option || undefined} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7.25 12.25L10 15.25L16.25 8.75" />
                    </svg>
                  </span>
                </Primitive.Item>
              ))}
            </SelectViewport>
          </Primitive.Content>
        </div>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
