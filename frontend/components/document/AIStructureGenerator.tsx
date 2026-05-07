"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
	Sparkles,
	Loader2,
	Plus,
	Trash2,
	ArrowRight,
	ChevronDown,
	FileText,
	Clock,
	BookOpen,
	RefreshCw,
	Wand2,
} from "lucide-react";
import {
	generateDocumentStructure,
	createDocumentFromStructure,
} from "@/lib/actions/document-generation";
import { useSession } from "@/lib/auth-client";
import type { DocumentStructure } from "@/lib/actions/document-generation";

// ============================================================================
// Types
// ============================================================================

interface AIStructureGeneratorProps {
	onSuccess?: (documentId: string) => void;
}

type WizardStep = "intent" | "configure" | "structure" | "preview";

interface StructureNode extends DocumentStructure {
	expanded: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function AIStructureGenerator({ onSuccess }: AIStructureGeneratorProps) {
	const router = useRouter();
	const { data: session, status } = useSession();
	const isSessionPending = status === "loading";
	const [step, setStep] = React.useState<WizardStep>("intent");
	
	// Session state for auth
	
	const [prompt, setPrompt] = React.useState("");
	const [documentType, setDocumentType] = React.useState("");
	const [tone, setTone] = React.useState<"formal" | "professional" | "friendly" | "technical">("professional");
	const [audience, setAudience] = React.useState("");
	const [minSections, setMinSections] = React.useState(5);
	const [maxSections, setMaxSections] = React.useState(10);
	
	const [isGenerating, setIsGenerating] = React.useState(false);
	const [structure, setStructure] = React.useState<StructureNode[]>([]);
	const [isCreating, setIsCreating] = React.useState(false);
	
	const handleGenerate = async () => {
		setIsGenerating(true);
		try {
			const result = await generateDocumentStructure({
				prompt,
				documentType: documentType || undefined,
				tone,
				audience: audience || undefined,
				minSections,
				maxSections,
			});
			
			const nodes = result.map((node) => ({ ...node, expanded: true }));
			setStructure(nodes);
			setStep("structure");
		} finally {
			setIsGenerating(false);
		}
	};
	
	const handleCreateDocument = async () => {
		// Wait a moment for session to load if needed
		if (isSessionPending) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}
		if (!session?.user?.id) {
			// Session not ready, will retry
			// Wait longer and try again
			await new Promise(resolve => setTimeout(resolve, 500));
			if (!session?.user?.id) {
				// Session failed after retry
				alert("Please sign in to create documents");
				return;
			}
		}
		
		// Starting document creation
		
		setIsCreating(true);
		try {
			const { id } = await createDocumentFromStructure(
				prompt.slice(0, 100) || "AI Generated Document",
				structure.map(({ expanded, ...node }) => node),
				session.user.id,
				{ autoFill: false }
			);
			
			onSuccess?.(id);
			router.push(`/documents/${id}`);
		} catch (error) {
			console.error("[AIStructureGenerator] Failed to create document:", error);
			alert(error instanceof Error ? error.message : "Failed to create document");
		} finally {
			setIsCreating(false);
		}
	};
	
	const canProceed = step === "intent" 
		? prompt.length >= 10 
		: step === "structure" 
			? structure.length > 0 
			: true;
	
	return (
		<div className="space-y-6">
			{/* Step Indicator */}
			<div className="flex items-center justify-center pb-4 border-b">
				<StepIndicator step={step} />
			</div>
			
			<div className="min-h-[400px]">
				{step === "intent" && (
					<IntentStep prompt={prompt} onChange={setPrompt} />
				)}
				
				{step === "configure" && (
					<ConfigureStep
						documentType={documentType}
						tone={tone}
						audience={audience}
						minSections={minSections}
						maxSections={maxSections}
						onDocumentTypeChange={setDocumentType}
						onToneChange={setTone}
						onAudienceChange={setAudience}
						onMinSectionsChange={setMinSections}
						onMaxSectionsChange={setMaxSections}
					/>
				)}
				
				{step === "structure" && (
					<StructureStep
						structure={structure}
						onChange={setStructure}
						isGenerating={isGenerating}
					/>
				)}
				
				{step === "preview" && (
					<PreviewStep structure={structure} prompt={prompt} />
				)}
			</div>
			
			<div className="flex items-center justify-between pt-4 border-t">
				{step !== "intent" ? (
					<Button
						variant="outline"
						onClick={() => {
							const steps: WizardStep[] = ["intent", "configure", "structure", "preview"];
							setStep(steps[steps.indexOf(step) - 1]);
						}}
					>
						Back
					</Button>
				) : <span />}
				
				{step !== "preview" ? (
					<Button
						onClick={() => {
							const steps: WizardStep[] = ["intent", "configure", "structure", "preview"];
							if (step === "configure") {
								handleGenerate();
							} else {
								const nextStep = steps[steps.indexOf(step) + 1];
								setStep(nextStep);
							}
						}}
						disabled={!canProceed || isGenerating}
					>
						{isGenerating ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<ArrowRight className="h-4 w-4 mr-2" />
						)}
						{step === "intent" ? "Start" : step === "configure" ? "Generate" : "Review"}
					</Button>
				) : (
					<Button 
						onClick={() => {
							// Create document handler
							handleCreateDocument();
						}} 
						disabled={isCreating}
					>
						{isCreating ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<Sparkles className="h-4 w-4 mr-2" />
						)}
						Create Document
					</Button>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Step Components
// ============================================================================

function StepIndicator({ step }: { step: WizardStep }) {
	const steps = [
		{ id: "intent", label: "Intent", icon: FileText },
		{ id: "configure", label: "Configure", icon: Wand2 },
		{ id: "structure", label: "Structure", icon: BookOpen },
		{ id: "preview", label: "Preview", icon: RefreshCw },
	];
	
	const idx = steps.findIndex((s) => s.id === step);
	
	return (
		<div className="flex items-center gap-2">
			{steps.map((s, i) => (
				<React.Fragment key={s.id}>
					<div
						className={cn(
							"flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
							i === idx ? "bg-primary text-primary-foreground" :
							i < idx ? "text-primary bg-primary/10" : "text-muted-foreground"
						)}
					>
						<s.icon className="h-4 w-4" />
						<span className="hidden sm:inline">{s.label}</span>
					</div>
					{i < steps.length - 1 && (
						<span className={i < idx ? "text-primary" : "text-muted-foreground/30"}>
							→
						</span>
						)}
					</React.Fragment>
				))}
			</div>
		);
	}

interface IntentStepProps {
	prompt: string;
	onChange: (value: string) => void;
}

function IntentStep({ prompt, onChange }: IntentStepProps) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="prompt" className="text-base">
					What document do you want to create?
				</Label>
				<Textarea
					id="prompt"
					placeholder="Describe your document in detail..."
					value={prompt}
					onChange={(e) => onChange(e.target.value)}
					className="min-h-[150px] text-base resize-none"
				/>
			</div>
			<p className="text-sm text-muted-foreground">
				Tip: Be specific about the type, audience, and purpose for best results.
			</p>
		</div>
	);
}

interface ConfigureStepProps {
	documentType: string;
	tone: "formal" | "professional" | "friendly" | "technical";
	audience: string;
	minSections: number;
	maxSections: number;
	onDocumentTypeChange: (value: string) => void;
	onToneChange: (value: "formal" | "professional" | "friendly" | "technical") => void;
	onAudienceChange: (value: string) => void;
	onMinSectionsChange: (value: number) => void;
	onMaxSectionsChange: (value: number) => void;
}

function ConfigureStep({
	documentType,
	tone,
	audience,
	minSections,
	maxSections,
	onDocumentTypeChange,
	onToneChange,
	onAudienceChange,
	onMinSectionsChange,
	onMaxSectionsChange,
}: ConfigureStepProps) {
	const documentTypes = [
		"Government Proposal",
		"Technical Specification",
		"Internal Policy",
		"Business Proposal",
		"Research Paper",
	];

	const audienceSuggestions = [
		"Government officials",
		"Technical teams",
		"Executive leadership",
		"General public",
		"Stakeholders",
		"Customers",
		"Investors",
		"Regulatory bodies",
		"Internal staff",
		"Partners",
	];

	const [isCustomAudience, setIsCustomAudience] = React.useState(false);

	// Ensure max >= min - when min increases past max, max follows
	const handleMinChange = (value: number) => {
		onMinSectionsChange(value);
		if (value > maxSections) {
			onMaxSectionsChange(value);
		}
	};

	// Ensure max >= min - when max decreases below min, min follows  
	const handleMaxChange = (value: number) => {
		onMaxSectionsChange(value);
		if (value < minSections) {
			onMinSectionsChange(value);
		}
	};

	// Handle audience selection - supports both preset and custom
	const handleAudienceSelect = (value: string) => {
		if (value === "__custom__") {
			setIsCustomAudience(true);
			onAudienceChange("");
		} else {
			setIsCustomAudience(false);
			onAudienceChange(value);
		}
	};

	return (
		<div className="grid gap-6">
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label>Document Type (Optional)</Label>
					<Select value={documentType} onValueChange={onDocumentTypeChange}>
						<SelectTrigger>
							<SelectValue placeholder="Auto-detect" />
						</SelectTrigger>
						<SelectContent>
							{documentTypes.map((t) => (
								<SelectItem key={t} value={t}>{t}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				
				<div className="space-y-2">
					<Label>Tone</Label>
					<Select 
						value={tone} 
						onValueChange={(v) => onToneChange(v as typeof tone)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="formal">Formal</SelectItem>
							<SelectItem value="professional">Professional</SelectItem>
							<SelectItem value="friendly">Friendly</SelectItem>
							<SelectItem value="technical">Technical</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
			
			<div className="space-y-2">
				<Label>Target Audience (Optional)</Label>
				{isCustomAudience ? (
					<div className="flex gap-2">
						<Input
							placeholder="Enter custom audience..."
							value={audience}
							onChange={(e) => onAudienceChange(e.target.value)}
							className="flex-1"
						/>
						<Button 
							variant="outline" 
							size="icon"
							onClick={() => setIsCustomAudience(false)}
							title="Back to presets"
						>
							<ChevronDown className="h-4 w-4" />
						</Button>
					</div>
				) : (
					<Select value={audience} onValueChange={handleAudienceSelect}>
						<SelectTrigger>
							<SelectValue placeholder="Select or enter custom audience..." />
						</SelectTrigger>
						<SelectContent>
							{audienceSuggestions.map((suggestion) => (
								<SelectItem key={suggestion} value={suggestion}>
									{suggestion}
								</SelectItem>
							))}
							<SelectItem value="__custom__">
								<span className="italic text-muted-foreground">+ Enter custom audience...</span>
							</SelectItem>
						</SelectContent>
					</Select>
				)}
			</div>
			
			<div className="space-y-4">
				<div className="space-y-2">
					<Label>Minimum Sections: {minSections}</Label>
					<Slider
						value={[minSections]}
						onValueChange={([v]) => handleMinChange(v)}
						min={2}
						max={15}
						step={1}
					/>
				</div>
				
				<div className="space-y-2">
					<Label>Maximum Sections: {maxSections}</Label>
					<Slider
						value={[maxSections]}
						onValueChange={([v]) => handleMaxChange(v)}
						min={5}
						max={25}
						step={1}
					/>
				</div>
				
				{minSections >= maxSections && (
					<p className="text-xs text-destructive">
						Maximum sections must be greater than minimum sections
					</p>
				)}
			</div>
		</div>
	);
}

interface StructureStepProps {
	structure: StructureNode[];
	onChange: (nodes: StructureNode[]) => void;
	isGenerating: boolean;
}

function StructureStep({ structure, onChange, isGenerating }: StructureStepProps) {
	if (isGenerating) {
		return (
			<div className="flex flex-col items-center justify-center py-12 space-y-4">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
				<p className="text-lg font-medium">AI is crafting your structure...</p>
			</div>
		);
	}
	
	if (structure.length === 0) {
		return <p className="text-center text-muted-foreground py-12">No structure generated yet.</p>;
	}
	
	return (
		<div className="space-y-2 max-h-[400px] overflow-y-auto">
			{structure.map((node) => (
				<div key={node.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
					<div className="flex items-center gap-3">
						{node.children && node.children.length > 0 && (
							<ChevronDown 
								className={cn(
									"h-4 w-4 transition-transform",
									!node.expanded && "-rotate-90"
								)} 
							/>
						)}
						<span className="font-medium">{node.title}</span>
					</div>
					<div className="flex items-center gap-2">
						<select
							value={node.length || "medium"}
							onChange={(e) => onChange(updateNodeLength(node.id, e.target.value, structure))}
							className="text-xs border rounded px-2 py-1 bg-transparent"
						>
							<option value="brief">Brief</option>
							<option value="medium">Medium</option>
							<option value="comprehensive">Comprehensive</option>
						</select>
						<button 
							onClick={() => onChange(structure.filter(n => n.id !== node.id))}
							className="p-1 text-muted-foreground hover:text-destructive rounded"
						>
							<Trash2 className="h-4 w-4" />
						</button>
					</div>
				</div>
			))}
		</div>
	);
}

function updateNodeLength(
	id: string, 
	length: string, 
	nodes: StructureNode[]
): StructureNode[] {
	return nodes.map((n) => ({
		...n,
		length: n.id === id ? (length as "brief" | "medium" | "comprehensive") : n.length,
		children: n.children ? updateNodeLength(id, length, n.children as StructureNode[]) : undefined,
	}));
}

interface PreviewStepProps {
	structure: StructureNode[];
	prompt: string;
}

function PreviewStep({ structure }: PreviewStepProps) {
	const totalWords = structure.reduce((acc, n) => {
		const wordCounts = { brief: 200, medium: 500, comprehensive: 1200 };
		const count = wordCounts[n.length || "medium"];
		return acc + count + (n.children?.length || 0) * count;
	}, 0);
	
	return (
		<div className="space-y-6">
			<div className="bg-muted/50 rounded-lg p-4 border">
				<h3 className="font-medium mb-2">Document Summary</h3>
				<p className="text-sm text-muted-foreground">
					{totalWords.toLocaleString()} words estimated across {structure.length} chapters
				</p>
			</div>
			<div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
				{structure.map((n) => (
					<div key={n.id} className="py-2 border-b last:border-0">
						<span className="font-medium">{n.title}</span>
						<span className="text-xs text-muted-foreground ml-2">({n.length})</span>
					</div>
				))}
			</div>
		</div>
	);
}
