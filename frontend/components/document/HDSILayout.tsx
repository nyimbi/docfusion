"use client";

/**
 * HDSILayout - 4-Pane Resizable Layout per HDSI Specification
 *
 * Layout Structure:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      Toolbar (external)                      │
 * ├──────────┬───────────────────────────────────┬──────────────┤
 * │ Tree     │    Node Property Matrix           │ Context      │
 * │ (28%)    │         (52%)                     │ Buffer       │
 * │          │                                   │ Inspector    │
 * │          │                                   │ (collapsible)│
 * ├──────────┴───────────────────────────────────┴──────────────┤
 * │              Generation Control Surface (120px)              │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Uses react-resizable-panels for persistent, draggable panel sizes.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { Button } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ChevronLeft,
	ChevronRight,
	PanelRightOpen,
	PanelRightClose,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface HDSILayoutProps {
	/** Content for the tree panel (28% default width) */
	treePanel: React.ReactNode;
	/** Content for the properties panel (52% default width) */
	propertiesPanel: React.ReactNode;
	/** Content for the context buffer inspector (collapsible) */
	contextBufferPanel?: React.ReactNode;
	/** Content for the generation control surface (fixed bottom) */
	controlSurface?: React.ReactNode;
	/** Whether context buffer is initially collapsed */
	contextBufferCollapsed?: boolean;
	/** Callback when context buffer collapse state changes */
	onContextBufferToggle?: (collapsed: boolean) => void;
	/** Unique ID for persisting panel sizes */
	persistenceId?: string;
	/** Additional className for the root container */
	className?: string;
	/** Show the control surface (bottom bar) */
	showControlSurface?: boolean;
}

// ============================================================================
// Panel Size Constants (percentages per spec)
// ============================================================================

const PANEL_SIZES = {
	tree: {
		default: 28,
		min: 15,
		max: 40,
	},
	properties: {
		default: 52,
		min: 30,
		max: 70,
	},
	contextBuffer: {
		default: 20,
		min: 0,
		collapsed: 0,
		expanded: 20,
		max: 35,
	},
	controlSurface: {
		height: 120, // Fixed pixel height
	},
} as const;

// ============================================================================
// Main Component
// ============================================================================

export function HDSILayout({
	treePanel,
	propertiesPanel,
	contextBufferPanel,
	controlSurface,
	contextBufferCollapsed: initialCollapsed = false,
	onContextBufferToggle,
	persistenceId = "hdsi-layout",
	className,
	showControlSurface = true,
}: HDSILayoutProps) {
	const [isContextBufferCollapsed, setIsContextBufferCollapsed] =
		React.useState(initialCollapsed);
	const contextBufferRef = usePanelRef();

	// Handle context buffer toggle
	const handleContextBufferToggle = React.useCallback(() => {
		const newCollapsed = !isContextBufferCollapsed;
		setIsContextBufferCollapsed(newCollapsed);
		onContextBufferToggle?.(newCollapsed);

		// Programmatically resize panel
		if (contextBufferRef.current) {
			if (newCollapsed) {
				contextBufferRef.current.collapse();
			} else {
				contextBufferRef.current.expand();
			}
		}
	}, [isContextBufferCollapsed, onContextBufferToggle]);

	// Calculate default sizes based on whether context buffer is shown
	const getDefaultSizes = () => {
		if (!contextBufferPanel || isContextBufferCollapsed) {
			// Two-pane mode: tree + properties
			return {
				tree: PANEL_SIZES.tree.default,
				properties: 100 - PANEL_SIZES.tree.default,
				contextBuffer: 0,
			};
		}
		// Three-pane mode: tree + properties + context buffer
		return {
			tree: PANEL_SIZES.tree.default,
			properties: PANEL_SIZES.properties.default,
			contextBuffer: PANEL_SIZES.contextBuffer.default,
		};
	};

	const defaultSizes = getDefaultSizes();

	return (
		<div className={cn("h-full flex flex-col", className)}>
			{/* Main Content Area */}
			<div className="flex-1 overflow-hidden">
				<ResizablePanelGroup
					orientation="horizontal"
					id={persistenceId}
					className="h-full"
				>
					{/* Tree Panel - 28% default */}
					<ResizablePanel
						defaultSize={defaultSizes.tree}
						minSize={PANEL_SIZES.tree.min}
						maxSize={PANEL_SIZES.tree.max}
						className="bg-background"
					>
						<div className="h-full flex flex-col">
							<TreePanelHeader />
							<div className="flex-1 overflow-auto">{treePanel}</div>
						</div>
					</ResizablePanel>

					<ResizableHandle withHandle />

					{/* Properties Panel - 52% default */}
					<ResizablePanel
						defaultSize={defaultSizes.properties}
						minSize={PANEL_SIZES.properties.min}
						className="bg-background"
					>
						<div className="h-full flex flex-col">
							<PropertiesPanelHeader />
							<div className="flex-1 overflow-auto">{propertiesPanel}</div>
						</div>
					</ResizablePanel>

					{/* Context Buffer Panel - Collapsible (20% default) */}
					{contextBufferPanel && (
						<>
							<ResizableHandle withHandle />
							<ResizablePanel
								panelRef={contextBufferRef}
								defaultSize={
									isContextBufferCollapsed ? 0 : defaultSizes.contextBuffer
								}
								minSize={PANEL_SIZES.contextBuffer.min}
								maxSize={PANEL_SIZES.contextBuffer.max}
								collapsible
								collapsedSize={0}
								onResize={(size) => {
									// Detect collapse/expand via size changes
									const isNowCollapsed = size.asPercentage <= 1;
									if (isNowCollapsed !== isContextBufferCollapsed) {
										setIsContextBufferCollapsed(isNowCollapsed);
										onContextBufferToggle?.(isNowCollapsed);
									}
								}}
								className={cn(
									"bg-muted/30 transition-all",
									isContextBufferCollapsed && "hidden"
								)}
							>
								<div className="h-full flex flex-col">
									<ContextBufferPanelHeader
										isCollapsed={isContextBufferCollapsed}
										onToggle={handleContextBufferToggle}
									/>
									<div className="flex-1 overflow-auto">
										{contextBufferPanel}
									</div>
								</div>
							</ResizablePanel>
						</>
					)}
				</ResizablePanelGroup>

				{/* Context Buffer Toggle Button (when collapsed) */}
				{contextBufferPanel && isContextBufferCollapsed && (
					<ContextBufferExpandButton onToggle={handleContextBufferToggle} />
				)}
			</div>

			{/* Generation Control Surface - Fixed Bottom */}
			{showControlSurface && controlSurface && (
				<div
					className="border-t bg-card/95 backdrop-blur-sm"
					style={{ height: PANEL_SIZES.controlSurface.height }}
				>
					{controlSurface}
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Panel Header Components
// ============================================================================

function TreePanelHeader() {
	return (
		<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
			<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Document Structure
			</span>
		</div>
	);
}

function PropertiesPanelHeader() {
	return (
		<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
			<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Node Properties
			</span>
		</div>
	);
}

interface ContextBufferPanelHeaderProps {
	isCollapsed: boolean;
	onToggle: () => void;
}

function ContextBufferPanelHeader({
	isCollapsed,
	onToggle,
}: ContextBufferPanelHeaderProps) {
	return (
		<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
			<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Context Buffer
			</span>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={onToggle}
							aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
						>
							{isCollapsed ? (
								<PanelRightOpen className="h-3.5 w-3.5" />
							) : (
								<PanelRightClose className="h-3.5 w-3.5" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="left">
						{isCollapsed ? "Expand panel" : "Collapse panel"}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}

// ============================================================================
// Context Buffer Expand Button (shown when panel is collapsed)
// ============================================================================

interface ContextBufferExpandButtonProps {
	onToggle: () => void;
}

function ContextBufferExpandButton({
	onToggle,
}: ContextBufferExpandButtonProps) {
	return (
		<div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="secondary"
							size="sm"
							className="h-20 w-6 rounded-l-md rounded-r-none border-r-0 shadow-md"
							onClick={onToggle}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="left">Open Context Buffer</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}

// ============================================================================
// Exports
// ============================================================================

export default HDSILayout;
