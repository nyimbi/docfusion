/**
 * HeaderFooterEditor Component
 *
 * Visual editor for document headers and footers with position-based
 * content, page numbering options, and live preview.
 */

"use client";

import * as React from "react";
import {
	PanelTop,
	PanelBottom,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Save,
	RefreshCw,
	Type,
	Hash,
	Calendar,
	FileText,
	Eye,
	Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type {
	HeaderFooterSettings,
	HeaderFooterElement,
	PageNumberFormat,
	HeaderFooterPosition,
} from "@/lib/types/formatting";
import { useHeaderFooter } from "@/lib/hooks/useFormatting";

// =============================================================================
// Types
// =============================================================================

export interface HeaderFooterEditorProps {
	/** Document ID to edit */
	documentId: string;
	/** Callback when settings are saved */
	onSave?: (settings: HeaderFooterSettings) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PAGE_NUMBER_FORMATS: { value: PageNumberFormat; label: string; example: string }[] = [
	{ value: "arabic", label: "Arabic", example: "1, 2, 3" },
	{ value: "roman-lower", label: "Roman (lowercase)", example: "i, ii, iii" },
	{ value: "roman-upper", label: "Roman (uppercase)", example: "I, II, III" },
	{ value: "alpha-lower", label: "Alpha (lowercase)", example: "a, b, c" },
	{ value: "alpha-upper", label: "Alpha (uppercase)", example: "A, B, C" },
	{ value: "none", label: "No page numbers", example: "-" },
];

const CONTENT_TOKENS: { token: string; label: string; icon: React.ElementType }[] = [
	{ token: "{page}", label: "Page number", icon: Hash },
	{ token: "{pages}", label: "Total pages", icon: Hash },
	{ token: "{date}", label: "Current date", icon: Calendar },
	{ token: "{title}", label: "Document title", icon: FileText },
];

const DEFAULT_SETTINGS: HeaderFooterSettings = {
	header: [
		{ position: "left", content: "" },
		{ position: "center", content: "" },
		{ position: "right", content: "" },
	],
	footer: [
		{ position: "left", content: "" },
		{ position: "center", content: "Page {page} of {pages}" },
		{ position: "right", content: "" },
	],
	pageNumberFormat: "arabic",
	startPageNumber: 1,
	differentFirstPage: false,
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Position editor for header or footer.
 */
interface PositionEditorProps {
	elements: HeaderFooterElement[];
	onChange: (elements: HeaderFooterElement[]) => void;
	type: "header" | "footer";
}

function PositionEditor({ elements, onChange, type }: PositionEditorProps) {
	const getElement = (position: HeaderFooterPosition): HeaderFooterElement => {
		return (
			elements.find((e) => e.position === position) || {
				position,
				content: "",
			}
		);
	};

	const updateElement = (position: HeaderFooterPosition, content: string) => {
		const newElements = elements.filter((e) => e.position !== position);
		newElements.push({ position, content });
		newElements.sort((a, b) => {
			const order: HeaderFooterPosition[] = ["left", "center", "right"];
			return order.indexOf(a.position) - order.indexOf(b.position);
		});
		onChange(newElements);
	};

	const insertToken = (position: HeaderFooterPosition, token: string) => {
		const element = getElement(position);
		updateElement(position, element.content + token);
	};

	const positions: { position: HeaderFooterPosition; icon: React.ElementType }[] = [
		{ position: "left", icon: AlignLeft },
		{ position: "center", icon: AlignCenter },
		{ position: "right", icon: AlignRight },
	];

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-3 gap-4">
				{positions.map(({ position, icon: Icon }) => {
					const element = getElement(position);

					return (
						<div key={position} className="space-y-2">
							<div className="flex items-center gap-2">
								<Icon className="h-4 w-4 text-muted-foreground" />
								<Label className="text-sm capitalize">{position}</Label>
							</div>
							<div className="relative">
								<Input
									value={element.content}
									onChange={(e) => updateElement(position, e.target.value)}
									placeholder={`${type} ${position}`}
									className="pr-24"
								/>
								<div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
									<TooltipProvider>
										{CONTENT_TOKENS.map(({ token, label, icon: TokenIcon }) => (
											<Tooltip key={token}>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6"
														onClick={() => insertToken(position, token)}
													>
														<TokenIcon className="h-3 w-3" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>
													<p>Insert {label}</p>
													<p className="text-xs text-muted-foreground">
														{token}
													</p>
												</TooltipContent>
											</Tooltip>
										))}
									</TooltipProvider>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Live preview of header/footer.
 */
interface PreviewProps {
	settings: HeaderFooterSettings;
	pageNumber?: number;
	isFirstPage?: boolean;
}

function Preview({ settings, pageNumber = 1, isFirstPage = false }: PreviewProps) {
	// Determine which elements to show
	const headerElements =
		isFirstPage && settings.differentFirstPage && settings.firstPageHeader
			? settings.firstPageHeader
			: settings.header;
	const footerElements =
		isFirstPage && settings.differentFirstPage && settings.firstPageFooter
			? settings.firstPageFooter
			: settings.footer;

	// Format page number based on format
	const formatPageNumber = (num: number): string => {
		const actualNum = num + (settings.startPageNumber || 1) - 1;
		switch (settings.pageNumberFormat) {
			case "roman-lower":
				return toRoman(actualNum).toLowerCase();
			case "roman-upper":
				return toRoman(actualNum);
			case "alpha-lower":
				return String.fromCharCode(96 + actualNum);
			case "alpha-upper":
				return String.fromCharCode(64 + actualNum);
			case "none":
				return "";
			default:
				return actualNum.toString();
		}
	};

	const toRoman = (num: number): string => {
		const romanNumerals: [number, string][] = [
			[1000, "M"],
			[900, "CM"],
			[500, "D"],
			[400, "CD"],
			[100, "C"],
			[90, "XC"],
			[50, "L"],
			[40, "XL"],
			[10, "X"],
			[9, "IX"],
			[5, "V"],
			[4, "IV"],
			[1, "I"],
		];
		let result = "";
		for (const [value, numeral] of romanNumerals) {
			while (num >= value) {
				result += numeral;
				num -= value;
			}
		}
		return result;
	};

	// Replace tokens in content
	const replaceTokens = (content: string): string => {
		return content
			.replace(/{page}/g, formatPageNumber(pageNumber))
			.replace(/{pages}/g, "42")
			.replace(/{date}/g, new Date().toLocaleDateString())
			.replace(/{title}/g, "Document Title");
	};

	const renderElement = (element: HeaderFooterElement) => {
		const content = replaceTokens(element.content);
		if (!content) return null;
		return (
			<span
				className={cn(
					"text-xs",
					element.position === "center" && "text-center",
					element.position === "right" && "text-right"
				)}
			>
				{content}
			</span>
		);
	};

	return (
		<div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm">
			{/* Header Preview */}
			<div className="px-6 py-2 border-b border-dashed border-border/50">
				<div className="grid grid-cols-3 gap-4 text-muted-foreground">
					{(["left", "center", "right"] as HeaderFooterPosition[]).map((pos) => {
						const element = headerElements.find((e) => e.position === pos);
						return (
							<div
								key={pos}
								className={cn(
									"min-h-[1.25rem]",
									pos === "center" && "text-center",
									pos === "right" && "text-right"
								)}
							>
								{element && renderElement(element)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Page Content Preview */}
			<div className="px-6 py-12 flex items-center justify-center text-muted-foreground/30">
				<div className="text-center">
					<Eye className="h-8 w-8 mx-auto mb-2" />
					<p className="text-xs">Page {pageNumber} Content</p>
					{isFirstPage && settings.differentFirstPage && (
						<Badge variant="secondary" className="mt-2 text-xs">
							First Page
						</Badge>
					)}
				</div>
			</div>

			{/* Footer Preview */}
			<div className="px-6 py-2 border-t border-dashed border-border/50">
				<div className="grid grid-cols-3 gap-4 text-muted-foreground">
					{(["left", "center", "right"] as HeaderFooterPosition[]).map((pos) => {
						const element = footerElements.find((e) => e.position === pos);
						return (
							<div
								key={pos}
								className={cn(
									"min-h-[1.25rem]",
									pos === "center" && "text-center",
									pos === "right" && "text-right"
								)}
							>
								{element && renderElement(element)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

/**
 * Loading skeleton.
 */
function EditorSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-4 w-64 mt-1" />
			</CardHeader>
			<CardContent className="space-y-6">
				<Skeleton className="h-10 w-full" />
				<div className="grid grid-cols-3 gap-4">
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
					<Skeleton className="h-20" />
				</div>
				<Skeleton className="h-48" />
			</CardContent>
		</Card>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function HeaderFooterEditor({
	documentId,
	onSave,
	className,
}: HeaderFooterEditorProps) {
	// Use hook for header/footer settings
	const {
		settings: loadedSettings,
		isLoading,
		isSaving,
		error,
		save,
		refetch: loadSettings,
	} = useHeaderFooter(documentId);

	// Local state for editing
	const [localSettings, setLocalSettings] = React.useState<HeaderFooterSettings>(DEFAULT_SETTINGS);
	const [originalSettings, setOriginalSettings] = React.useState<HeaderFooterSettings>(DEFAULT_SETTINGS);
	const [activeTab, setActiveTab] = React.useState<"header" | "footer">("header");
	const [previewPage, setPreviewPage] = React.useState(1);
	const [showFirstPage, setShowFirstPage] = React.useState(false);

	// Sync loaded settings to local state
	React.useEffect(() => {
		if (loadedSettings) {
			setLocalSettings(loadedSettings);
			setOriginalSettings(loadedSettings);
		}
	}, [loadedSettings]);

	// Use local settings for display
	const settings = localSettings;

	// Check if settings have changed
	const hasChanges = React.useMemo(() => {
		return JSON.stringify(settings) !== JSON.stringify(originalSettings);
	}, [settings, originalSettings]);

	// Save settings
	const handleSave = React.useCallback(async () => {
		const success = await save(localSettings);
		if (success) {
			setOriginalSettings(localSettings);
			onSave?.(localSettings);
		}
	}, [localSettings, save, onSave]);

	// Reset changes
	const handleReset = React.useCallback(() => {
		setLocalSettings(originalSettings);
	}, [originalSettings]);

	// Update helper
	const updateSettings = <K extends keyof HeaderFooterSettings>(
		key: K,
		value: HeaderFooterSettings[K]
	) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }));
	};

	// Loading state
	if (isLoading) {
		return <EditorSkeleton />;
	}

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<Type className="h-5 w-5" />
						Headers & Footers
					</CardTitle>
					<CardDescription>
						Customize document headers and footers
					</CardDescription>
				</div>
				<div className="flex gap-2">
					{hasChanges && (
						<Button variant="ghost" size="sm" onClick={handleReset}>
							<Undo2 className="h-4 w-4 mr-2" />
							Reset
						</Button>
					)}
					<Button
						size="sm"
						onClick={handleSave}
						disabled={isSaving || !hasChanges}
					>
						{isSaving ? (
							<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Save className="h-4 w-4 mr-2" />
						)}
						Save
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Header/Footer Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as "header" | "footer")}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="header" className="gap-2">
							<PanelTop className="h-4 w-4" />
							Header
						</TabsTrigger>
						<TabsTrigger value="footer" className="gap-2">
							<PanelBottom className="h-4 w-4" />
							Footer
						</TabsTrigger>
					</TabsList>

					<TabsContent value="header" className="mt-4">
						<PositionEditor
							elements={settings.header}
							onChange={(elements) => updateSettings("header", elements)}
							type="header"
						/>
					</TabsContent>

					<TabsContent value="footer" className="mt-4">
						<PositionEditor
							elements={settings.footer}
							onChange={(elements) => updateSettings("footer", elements)}
							type="footer"
						/>
					</TabsContent>
				</Tabs>

				{/* Page Number Settings */}
				<div className="space-y-4 pt-4 border-t">
					<h4 className="font-medium text-sm">Page Number Settings</h4>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Format</Label>
							<Select
								value={settings.pageNumberFormat}
								onValueChange={(v) =>
									updateSettings("pageNumberFormat", v as PageNumberFormat)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PAGE_NUMBER_FORMATS.map((format) => (
										<SelectItem key={format.value} value={format.value}>
											<div className="flex justify-between gap-4">
												<span>{format.label}</span>
												<span className="text-muted-foreground">
													{format.example}
												</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Start At</Label>
							<Input
								type="number"
								min={1}
								value={settings.startPageNumber || 1}
								onChange={(e) =>
									updateSettings("startPageNumber", parseInt(e.target.value) || 1)
								}
							/>
						</div>
					</div>
				</div>

				{/* First Page Options */}
				<div className="space-y-4 pt-4 border-t">
					<div className="flex items-center justify-between">
						<div>
							<Label className="text-sm font-medium">
								Different First Page
							</Label>
							<p className="text-xs text-muted-foreground">
								Use different header/footer on the first page
							</p>
						</div>
						<Switch
							checked={settings.differentFirstPage}
							onCheckedChange={(v) => updateSettings("differentFirstPage", v)}
						/>
					</div>

					{settings.differentFirstPage && (
						<div className="space-y-4 p-4 bg-muted/30 rounded-lg">
							<h5 className="font-medium text-sm">First Page Header</h5>
							<PositionEditor
								elements={settings.firstPageHeader || []}
								onChange={(elements) =>
									updateSettings("firstPageHeader", elements)
								}
								type="header"
							/>

							<h5 className="font-medium text-sm pt-4">First Page Footer</h5>
							<PositionEditor
								elements={settings.firstPageFooter || []}
								onChange={(elements) =>
									updateSettings("firstPageFooter", elements)
								}
								type="footer"
							/>
						</div>
					)}
				</div>

				{/* Live Preview */}
				<div className="space-y-3 pt-4 border-t">
					<div className="flex items-center justify-between">
						<h4 className="font-medium text-sm flex items-center gap-2">
							<Eye className="h-4 w-4" />
							Preview
						</h4>
						{settings.differentFirstPage && (
							<div className="flex items-center gap-2">
								<Button
									variant={showFirstPage ? "primary" : "outline"}
									size="sm"
									onClick={() => setShowFirstPage(true)}
								>
									First Page
								</Button>
								<Button
									variant={!showFirstPage ? "primary" : "outline"}
									size="sm"
									onClick={() => setShowFirstPage(false)}
								>
									Other Pages
								</Button>
							</div>
						)}
					</div>

					<Preview
						settings={settings}
						pageNumber={showFirstPage ? 1 : 5}
						isFirstPage={showFirstPage}
					/>
				</div>

				{/* Token Reference */}
				<div className="pt-4 border-t">
					<p className="text-xs text-muted-foreground">
						<strong>Available tokens:</strong>{" "}
						{CONTENT_TOKENS.map((t) => t.token).join(", ")}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

export default HeaderFooterEditor;
