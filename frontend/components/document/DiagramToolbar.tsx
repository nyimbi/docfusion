/**
 * Diagram Toolbar - DocFusion
 *
 * Toolbar component for diagram actions including:
 * - Format switching
 * - AI generation
 * - Export options
 * - Template library
 * - Settings
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DiagramFormat, DiagramTheme } from "@/lib/diagrams/types";
import {
	Code2,
	Copy,
	Download,
	FileCode,
	LayoutGrid,
	Palette,
	RefreshCw,
	Save,
	Settings,
	Share,
	Wand2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface DiagramToolbarProps {
	currentFormat: DiagramFormat;
	currentTheme: DiagramTheme;
	canUndo?: boolean;
	canRedo?: boolean;
	isDirty?: boolean;
	className?: string;
	onFormatChange?: (format: DiagramFormat) => void;
	onThemeChange?: (theme: DiagramTheme) => void;
	onFormatCode?: () => void;
	onGenerate?: () => void;
	onTemplates?: () => void;
	onSave?: () => void;
	onExport?: (format: "svg" | "png" | "txt") => void;
	onCopy?: () => void;
	onShare?: () => void;
	onSettings?: () => void;
	onUndo?: () => void;
	onRedo?: () => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onReset?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function DiagramToolbar({
	currentFormat,
	currentTheme,
	canUndo = false,
	canRedo = false,
	isDirty = false,
	className,
	onFormatChange,
	onThemeChange,
	onFormatCode,
	onGenerate,
	onTemplates,
	onSave,
	onExport,
	onCopy,
	onShare,
	onSettings,
	onUndo,
	onRedo,
	onZoomIn,
	onZoomOut,
	onReset,
}: DiagramToolbarProps) {
	return (
		<TooltipProvider>
			<div
				className={cn(
					"flex items-center gap-2 p-3 border-b bg-muted/50 flex-wrap",
					className
				)}
			>
				{/* Format Selector */}
				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Select value={currentFormat} onValueChange={(v) => onFormatChange?.(v as DiagramFormat)}>
								<SelectTrigger className="w-28">
									<Code2 className="h-4 w-4 mr-2" />
									<SelectValue />
								</SelectTrigger>
								<SelectContent align="start">
									<SelectItem value="plantuml">PlantUML</SelectItem>
									<SelectItem value="structurizr">Structurizr</SelectItem>
									<SelectItem value="d2">D2</SelectItem>
									<SelectItem value="mermaid">Mermaid</SelectItem>
								</SelectContent>
							</Select>
						</TooltipTrigger>
						<TooltipContent>Diagram format</TooltipContent>
					</Tooltip>
				</div>

				<div className="h-4 w-px bg-border" />

				{/* Editor Actions */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onFormatCode} title="Format">
								<LayoutGrid className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Format code</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onGenerate} title="AI Generate">
								<Wand2 className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>AI Generate diagram</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onTemplates} title="Templates">
								<FileCode className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Browse templates</TooltipContent>
					</Tooltip>
				</div>

				<div className="h-4 w-px bg-border" />

				{/* Theme Selector */}
				<div className="flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Select value={currentTheme} onValueChange={(v) => onThemeChange?.(v as DiagramTheme)}>
								<SelectTrigger className="w-28">
									<Palette className="h-4 w-4 mr-2" />
									<SelectValue />
								</SelectTrigger>
								<SelectContent align="start">
									<SelectItem value="default">Default</SelectItem>
									<SelectItem value="dark">Dark</SelectItem>
									<SelectItem value="light">Light</SelectItem>
									<SelectItem value="forest">Forest</SelectItem>
									<SelectItem value="ocean">Ocean</SelectItem>
									<SelectItem value="cyber">Cyber</SelectItem>
								</SelectContent>
							</Select>
						</TooltipTrigger>
						<TooltipContent>Diagram theme</TooltipContent>
					</Tooltip>
				</div>

				<div className="h-4 w-px bg-border" />

				{/* History Actions */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={onUndo}
								disabled={!canUndo}
								title="Undo"
							>
								<RefreshCw className="h-4 w-4 -scale-x-100" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Undo</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								onClick={onRedo}
								disabled={!canRedo}
								title="Redo"
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Redo</TooltipContent>
					</Tooltip>
				</div>

				<div className="flex-1" />

				{/* Status */}
				{isDirty && (
					<span className="text-xs text-muted-foreground hidden sm:inline">
						Unsaved changes
					</span>
				)}

				<div className="h-4 w-px bg-border" />

				{/* Zoom Actions */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onZoomIn} title="Zoom in">
								<ZoomIn className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Zoom in</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onZoomOut} title="Zoom out">
								<ZoomOut className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Zoom out</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onReset} title="Reset view">
								<RefreshCw className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Reset view</TooltipContent>
					</Tooltip>
				</div>

				<div className="h-4 w-px bg-border" />

				{/* File Actions */}
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onSave} title="Save">
								<Save className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Save diagram</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onCopy} title="Copy">
								<Copy className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Copy code</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Select onValueChange={(v) => onExport?.(v as "svg" | "png" | "txt")}>
								<SelectTrigger className="w-24">
									<Download className="h-4 w-4 mr-2" />
									<span className="text-xs">Export</span>
								</SelectTrigger>
								<SelectContent align="end">
									<SelectItem value="svg">SVG</SelectItem>
									<SelectItem value="png">PNG</SelectItem>
									<SelectItem value="txt">Text</SelectItem>
								</SelectContent>
							</Select>
						</TooltipTrigger>
						<TooltipContent>Export diagram</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onShare} title="Share">
								<Share className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Share diagram</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={onSettings} title="Settings">
								<Settings className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Settings</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}
