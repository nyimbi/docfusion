/**
 * Focus trap hook for modal dialogs.
 *
 * Traps focus within a container element, cycling through
 * focusable elements when Tab/Shift+Tab is pressed.
 */

import * as React from "react";

/**
 * Selector for all focusable elements.
 */
const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"textarea:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Options for useFocusTrap hook.
 */
export interface UseFocusTrapOptions {
	/** Whether the focus trap is enabled */
	enabled?: boolean;
	/** Element to focus when trap is activated (default: first focusable) */
	initialFocus?: React.RefObject<HTMLElement>;
	/** Element to return focus to when trap is deactivated (default: previously focused) */
	returnFocus?: boolean;
}

/**
 * Hook to trap focus within a container element.
 *
 * @param containerRef - Ref to the container element
 * @param options - Focus trap options
 *
 * @example
 * ```tsx
 * function Modal({ open, children }) {
 *   const containerRef = React.useRef<HTMLDivElement>(null);
 *   useFocusTrap(containerRef, { enabled: open });
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       {children}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(
	containerRef: React.RefObject<HTMLElement | null>,
	options: UseFocusTrapOptions = {}
): void {
	const { enabled = true, initialFocus, returnFocus = true } = options;
	const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

	// Store the previously focused element
	React.useEffect(() => {
		if (enabled) {
			previouslyFocusedRef.current = document.activeElement as HTMLElement;
		}
	}, [enabled]);

	// Set initial focus
	React.useEffect(() => {
		if (!enabled || !containerRef.current) return;

		// Small delay to ensure DOM is ready
		const timer = setTimeout(() => {
			if (initialFocus?.current) {
				initialFocus.current.focus();
			} else {
				// Focus first focusable element
				const focusableElements = containerRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
				const firstFocusable = focusableElements?.[0] as HTMLElement | undefined;
				if (firstFocusable) {
					firstFocusable.focus();
				} else {
					// If no focusable elements, focus the container itself
					containerRef.current?.focus();
				}
			}
		}, 0);

		return () => clearTimeout(timer);
	}, [enabled, containerRef, initialFocus]);

	// Return focus when deactivated
	React.useEffect(() => {
		if (!enabled || !returnFocus) return;

		return () => {
			if (previouslyFocusedRef.current && document.body.contains(previouslyFocusedRef.current)) {
				previouslyFocusedRef.current.focus();
			}
		};
	}, [enabled, returnFocus]);

	// Handle Tab key to cycle focus
	React.useEffect(() => {
		if (!enabled || !containerRef.current) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;

			const container = containerRef.current;
			if (!container) return;

			const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTOR);
			const firstFocusable = focusableElements[0] as HTMLElement | undefined;
			const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement | undefined;

			if (!firstFocusable || !lastFocusable) return;

			// Shift+Tab from first element -> focus last
			if (event.shiftKey && document.activeElement === firstFocusable) {
				event.preventDefault();
				lastFocusable.focus();
			}
			// Tab from last element -> focus first
			else if (!event.shiftKey && document.activeElement === lastFocusable) {
				event.preventDefault();
				firstFocusable.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [enabled, containerRef]);
}

/**
 * Get all focusable elements within a container.
 *
 * @param container - Container element to search within
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * Check if an element is focusable.
 *
 * @param element - Element to check
 * @returns true if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
	return element.matches(FOCUSABLE_SELECTOR);
}
