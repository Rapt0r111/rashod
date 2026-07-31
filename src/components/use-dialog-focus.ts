"use client";

import { useEffect, useRef } from "react";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type UseDialogFocusOptions = {
  /** When false, focus trap is inactive (e.g. closed sheet). Default true. */
  open?: boolean;
  /** Prefer only visible focusables (offsetParent). Default false. */
  visibleOnly?: boolean;
};

/**
 * Focus trap + Escape close + restore focus for modal panels/drawers.
 * Pass `open: false` while mounted-but-hidden; omit open when unmount closes.
 */
export function useDialogFocus(
  onClose: () => void,
  options: UseDialogFocusOptions = {},
) {
  const { open = true, visibleOnly = false } = options;
  const ref = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = ref.current;
    const focusTimeout = window.setTimeout(() => {
      panel?.querySelector<HTMLElement>(focusableSelector)?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => {
        if (element.hasAttribute("disabled")) return false;
        if (visibleOnly && element.offsetParent === null) return false;
        return true;
      });
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, visibleOnly]);

  return ref;
}
