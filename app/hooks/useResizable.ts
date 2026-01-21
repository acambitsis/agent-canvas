/**
 * Hook for drag-to-resize functionality with touch and keyboard support
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  minWidth: number;
  maxWidth: number;
  currentWidth: number;
  onResize: (width: number) => void;
}

const KEYBOARD_STEP = 10;

export function useResizable({ minWidth, maxWidth, currentWidth, onResize }: UseResizableOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const clampWidth = useCallback((width: number) => {
    return Math.min(maxWidth, Math.max(minWidth, width));
  }, [minWidth, maxWidth]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    setIsDragging(true);
  }, [currentWidth]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startWidthRef.current = currentWidth;
    setIsDragging(true);
  }, [currentWidth]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newWidth: number | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newWidth = clampWidth(currentWidth - KEYBOARD_STEP);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newWidth = clampWidth(currentWidth + KEYBOARD_STEP);
        break;
      case 'Home':
        e.preventDefault();
        newWidth = minWidth;
        break;
      case 'End':
        e.preventDefault();
        newWidth = maxWidth;
        break;
    }

    if (newWidth !== null) {
      onResize(newWidth);
    }
  }, [currentWidth, minWidth, maxWidth, clampWidth, onResize]);

  // Mouse/touch move and end handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      const delta = clientX - startXRef.current;
      const newWidth = clampWidth(startWidthRef.current + delta);
      onResize(newWidth);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('is-resizing-sidebar');

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.body.classList.remove('is-resizing-sidebar');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, clampWidth, onResize]);

  // ARIA props for accessibility
  const resizeHandleProps = {
    role: 'separator' as const,
    'aria-orientation': 'vertical' as const,
    'aria-valuenow': currentWidth,
    'aria-valuemin': minWidth,
    'aria-valuemax': maxWidth,
    'aria-label': 'Resize sidebar',
    tabIndex: 0,
    onMouseDown: handleMouseDown,
    onTouchStart: handleTouchStart,
    onKeyDown: handleKeyDown,
  };

  return { isDragging, resizeHandleProps };
}
