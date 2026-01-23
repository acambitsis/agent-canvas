/**
 * Custom Tooltip component with styled appearance
 * Replaces native browser title tooltips with a consistent design
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  /** The content to display in the tooltip */
  content: React.ReactNode;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Tooltip placement relative to trigger */
  placement?: TooltipPlacement;
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Additional class name for the tooltip popup */
  className?: string;
  /** Additional class name for the trigger wrapper */
  triggerClassName?: string;
  /** Whether the tooltip is disabled */
  disabled?: boolean;
  /** Whether to render as inline (span) or block (div) wrapper */
  inline?: boolean;
  /** Only show tooltip when child text is truncated (useful for overflow text) */
  showOnlyWhenTruncated?: boolean;
}

interface Position {
  top: number;
  left: number;
  arrowOffset?: number; // Horizontal offset for top/bottom, vertical for left/right
}

const TOOLTIP_OFFSET = 8;

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 400,
  className = '',
  triggerClassName = '',
  disabled = false,
  inline = true,
  showOnlyWhenTruncated = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Only render portal on client
  useEffect(() => {
    setMounted(true);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Use viewport-relative coordinates for position: fixed
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + TOOLTIP_OFFSET;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - TOOLTIP_OFFSET;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + TOOLTIP_OFFSET;
        break;
    }

    // Keep tooltip within viewport and calculate arrow offset
    const padding = 8;
    const maxLeft = window.innerWidth - tooltipRect.width - padding;
    const maxTop = window.innerHeight - tooltipRect.height - padding;

    const originalLeft = left;
    const originalTop = top;

    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    // Calculate arrow offset when tooltip is clamped
    let arrowOffset = 0;
    if (placement === 'top' || placement === 'bottom') {
      arrowOffset = originalLeft - left; // Horizontal offset
    } else {
      arrowOffset = originalTop - top; // Vertical offset
    }

    setPosition({ top, left, arrowOffset });
  }, [placement]);

  // Check if any child element has truncated text
  const isTruncated = useCallback(() => {
    if (!triggerRef.current) return false;

    // Check the trigger's first child element for text overflow
    const child = triggerRef.current.firstElementChild as HTMLElement;
    if (child) {
      return child.scrollWidth > child.clientWidth || child.scrollHeight > child.clientHeight;
    }

    // Fallback: check the trigger itself
    return triggerRef.current.scrollWidth > triggerRef.current.clientWidth;
  }, []);

  const showTooltip = useCallback(() => {
    if (disabled || !content) return;

    // Skip showing if truncation check is enabled and text isn't truncated
    if (showOnlyWhenTruncated && !isTruncated()) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled, content, showOnlyWhenTruncated, isTruncated]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Dismiss tooltip on Escape key (accessibility)
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideTooltip();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, hideTooltip]);

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to ensure tooltip is rendered before measuring
      rafRef.current = requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [isVisible, calculatePosition]);

  // Reset position when hiding
  useEffect(() => {
    if (!isVisible) {
      setPosition(null);
    }
  }, [isVisible]);

  // Calculate arrow inline style based on offset
  const getArrowStyle = (): React.CSSProperties | undefined => {
    if (!position?.arrowOffset) return undefined;

    if (placement === 'top' || placement === 'bottom') {
      // Horizontal adjustment: offset from center
      return { marginLeft: position.arrowOffset };
    } else {
      // Vertical adjustment: offset from center
      return { marginTop: position.arrowOffset };
    }
  };

  const tooltipElement = isVisible && mounted ? (
    <div
      ref={tooltipRef}
      className={`tooltip tooltip--${placement} ${className}`}
      style={{
        position: 'fixed',
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
      role="tooltip"
    >
      <div className="tooltip__content">
        {content}
      </div>
      <div className="tooltip__arrow" style={getArrowStyle()} />
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={`tooltip-trigger ${inline ? '' : 'tooltip-trigger--block'} ${triggerClassName}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </span>
      {mounted && tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
}
