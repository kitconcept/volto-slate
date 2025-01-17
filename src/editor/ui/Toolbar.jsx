import React, { useRef, useEffect } from 'react';
import { Portal } from 'react-portal';
import { useSlate } from 'slate-react';

import Separator from './Separator';
import BasicToolbar from './BasicToolbar';

const Toolbar = ({
  enableExpando = false,
  toggleButton,
  className,
  children,
}) => {
  const ref = useRef();
  const editor = useSlate();

  useEffect(() => {
    const el = ref.current;

    if ((children || []).length === 0) {
      el.removeAttribute('style');
      return;
    }

    const { selection } = editor;
    // const savedSelection = editor.getSavedSelection();
    if (!selection) {
      el.removeAttribute('style');
      return;
    }

    if (editor.isSidebarOpen) {
      el.removeAttribute('style');
      return;
    }

    const domSelection = window.getSelection();
    if (domSelection.rangeCount < 1) {
      // don't do anything here, this happens when opening a focus-stealing
      // component, in which case we actually want to keep the toolbar open
      // See
      // https://stackoverflow.com/questions/22935320/uncaught-indexsizeerror-failed-to-execute-getrangeat-on-selection-0-is-not
      return;
    }
    const domRange = domSelection.getRangeAt(0);
    const rect = domRange.getBoundingClientRect();

    el.style.opacity = 1;
    el.style.top = `${rect.top + window.pageYOffset - el.offsetHeight - 6}px`;
    el.style.left = `${Math.max(
      rect.left + window.pageXOffset - el.offsetWidth / 2 + rect.width / 2,
      0, // if the left edge of the toolbar should be otherwise offscreen
    )}px`;
  });

  return (
    <Portal>
      <BasicToolbar className={`slate-inline-toolbar ${className}`} ref={ref}>
        {children}
        {enableExpando && toggleButton && (
          <>
            <Separator />
            {toggleButton}
          </>
        )}
      </BasicToolbar>
    </Portal>
  );
};

export default Toolbar;
