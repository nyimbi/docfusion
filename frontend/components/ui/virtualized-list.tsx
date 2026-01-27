/**
 * Virtualized list component for DocFusion.
 *
 * Provides efficient rendering for long lists by only rendering
 * visible items. Uses @tanstack/react-virtual for virtualization.
 */

"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

/**
 * Props for VirtualizedList component.
 */
export interface VirtualizedListProps<T> {
	/** Items to render */
	items: T[];
	/** Estimated size of each item (height for vertical, width for horizontal) */
	estimateSize: number;
	/** Render function for each item */
	renderItem: (item: T, index: number) => React.ReactNode;
	/** Optional key extractor for items */
	getItemKey?: (item: T, index: number) => string | number;
	/** Horizontal scrolling instead of vertical */
	horizontal?: boolean;
	/** Number of items to render outside visible area */
	overscan?: number;
	/** Gap between items in pixels */
	gap?: number;
	/** Container className */
	className?: string;
	/** List className */
	listClassName?: string;
	/** Whether to enable smooth scrolling */
	smoothScroll?: boolean;
	/** Callback when scroll position changes */
	onScroll?: (scrollOffset: number) => void;
	/** Loading indicator at the bottom */
	loadingIndicator?: React.ReactNode;
	/** Whether more items are being loaded */
	isLoading?: boolean;
	/** Empty state component */
	emptyState?: React.ReactNode;
}

/**
 * VirtualizedList component.
 *
 * Efficiently renders large lists by only mounting visible items.
 *
 * @example
 * ```tsx
 * <VirtualizedList
 *   items={documents}
 *   estimateSize={72}
 *   renderItem={(doc, index) => (
 *     <DocumentListItem key={doc.id} document={doc} />
 *   )}
 *   getItemKey={(doc) => doc.id}
 * />
 * ```
 */
export const VirtualizedList = React.memo(function VirtualizedList<T>({
	items,
	estimateSize,
	renderItem,
	getItemKey,
	horizontal = false,
	overscan = 5,
	gap = 0,
	className,
	listClassName,
	smoothScroll = false,
	onScroll,
	loadingIndicator,
	isLoading = false,
	emptyState,
}: VirtualizedListProps<T>) {
	const parentRef = React.useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateSize,
		horizontal,
		overscan,
		getItemKey: getItemKey
			? (index) => getItemKey(items[index], index)
			: undefined,
	});

	const virtualItems = virtualizer.getVirtualItems();

	// Handle scroll events
	React.useEffect(() => {
		if (!onScroll || !parentRef.current) return;

		const handleScroll = () => {
			if (parentRef.current) {
				const offset = horizontal
					? parentRef.current.scrollLeft
					: parentRef.current.scrollTop;
				onScroll(offset);
			}
		};

		const element = parentRef.current;
		element.addEventListener("scroll", handleScroll, { passive: true });
		return () => element.removeEventListener("scroll", handleScroll);
	}, [onScroll, horizontal]);

	// Empty state
	if (items.length === 0 && !isLoading) {
		return emptyState || null;
	}

	return (
		<div
			ref={parentRef}
			className={cn(
				"overflow-auto",
				smoothScroll && "scroll-smooth",
				className
			)}
		>
			<div
				className={cn("relative", listClassName)}
				style={{
					[horizontal ? "width" : "height"]: `${virtualizer.getTotalSize()}px`,
					[horizontal ? "height" : "width"]: "100%",
				}}
			>
				{virtualItems.map((virtualItem) => {
					const item = items[virtualItem.index];
					return (
						<div
							key={virtualItem.key}
							data-index={virtualItem.index}
							ref={virtualizer.measureElement}
							className="absolute top-0 left-0 w-full"
							style={{
								[horizontal ? "left" : "top"]: `${virtualItem.start + virtualItem.index * gap}px`,
								[horizontal ? "top" : "left"]: 0,
								[horizontal ? "height" : "width"]: "100%",
							}}
						>
							{renderItem(item, virtualItem.index)}
						</div>
					);
				})}
			</div>

			{/* Loading indicator */}
			{isLoading && loadingIndicator && (
				<div className="flex justify-center py-4">{loadingIndicator}</div>
			)}
		</div>
	);
}) as <T>(props: VirtualizedListProps<T>) => React.ReactElement;

/**
 * Props for VirtualizedGrid component.
 */
export interface VirtualizedGridProps<T> {
	/** Items to render */
	items: T[];
	/** Number of columns */
	columns: number;
	/** Estimated row height */
	estimateRowHeight: number;
	/** Render function for each item */
	renderItem: (item: T, index: number) => React.ReactNode;
	/** Optional key extractor */
	getItemKey?: (item: T, index: number) => string | number;
	/** Number of rows to render outside visible area */
	overscan?: number;
	/** Gap between items */
	gap?: number;
	/** Container className */
	className?: string;
	/** Grid className */
	gridClassName?: string;
	/** Empty state component */
	emptyState?: React.ReactNode;
	/** Loading indicator */
	loadingIndicator?: React.ReactNode;
	/** Whether loading */
	isLoading?: boolean;
}

/**
 * VirtualizedGrid component.
 *
 * Efficiently renders large grids by only mounting visible rows.
 *
 * @example
 * ```tsx
 * <VirtualizedGrid
 *   items={documents}
 *   columns={3}
 *   estimateRowHeight={280}
 *   renderItem={(doc) => <DocumentCard document={doc} />}
 *   getItemKey={(doc) => doc.id}
 * />
 * ```
 */
export const VirtualizedGrid = React.memo(function VirtualizedGrid<T>({
	items,
	columns,
	estimateRowHeight,
	renderItem,
	getItemKey,
	overscan = 3,
	gap = 16,
	className,
	gridClassName,
	emptyState,
	loadingIndicator,
	isLoading = false,
}: VirtualizedGridProps<T>) {
	const parentRef = React.useRef<HTMLDivElement>(null);

	// Calculate rows
	const rows = React.useMemo(() => {
		const result: T[][] = [];
		for (let i = 0; i < items.length; i += columns) {
			result.push(items.slice(i, i + columns));
		}
		return result;
	}, [items, columns]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateRowHeight,
		overscan,
	});

	const virtualRows = virtualizer.getVirtualItems();

	// Empty state
	if (items.length === 0 && !isLoading) {
		return emptyState || null;
	}

	return (
		<div ref={parentRef} className={cn("overflow-auto", className)}>
			<div
				className="relative"
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
				}}
			>
				{virtualRows.map((virtualRow) => {
					const row = rows[virtualRow.index];
					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							className="absolute top-0 left-0 w-full"
							style={{
								top: `${virtualRow.start}px`,
							}}
						>
							<div
								className={cn("grid", gridClassName)}
								style={{
									gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
									gap: `${gap}px`,
								}}
							>
								{row.map((item, colIndex) => {
									const globalIndex = virtualRow.index * columns + colIndex;
									const key = getItemKey
										? getItemKey(item, globalIndex)
										: globalIndex;
									return (
										<div key={key}>{renderItem(item, globalIndex)}</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>

			{/* Loading indicator */}
			{isLoading && loadingIndicator && (
				<div className="flex justify-center py-4">{loadingIndicator}</div>
			)}
		</div>
	);
}) as <T>(props: VirtualizedGridProps<T>) => React.ReactElement;

/**
 * Hook to get responsive column count based on container width.
 */
export function useResponsiveColumns(
	containerRef: React.RefObject<HTMLElement>,
	breakpoints: { minWidth: number; columns: number }[] = [
		{ minWidth: 0, columns: 1 },
		{ minWidth: 640, columns: 2 },
		{ minWidth: 1024, columns: 3 },
		{ minWidth: 1280, columns: 4 },
	]
): number {
	const [columns, setColumns] = React.useState(1);

	React.useEffect(() => {
		if (!containerRef.current) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			const width = entry.contentRect.width;
			const sortedBreakpoints = [...breakpoints].sort(
				(a, b) => b.minWidth - a.minWidth
			);

			for (const bp of sortedBreakpoints) {
				if (width >= bp.minWidth) {
					setColumns(bp.columns);
					break;
				}
			}
		});

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [containerRef, breakpoints]);

	return columns;
}
