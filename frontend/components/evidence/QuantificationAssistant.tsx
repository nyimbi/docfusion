/**
 * QuantificationAssistant - Help Quantify Claims
 *
 * AI-powered tool to help quantify vague claims with specific
 * metrics, data source suggestions, and copy/apply actions.
 */

"use client";

import { useState, useCallback } from "react";
import {
	TrendingUp,
	Loader2,
	Copy,
	Check,
	Lightbulb,
	Database,
	AlertCircle,
	Sparkles,
	RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { QuantificationSuggestion } from "@/lib/types/evidence";
import { generateQuantification } from "@/lib/actions/evidence";

// =============================================================================
// Types
// =============================================================================

export interface QuantificationAssistantProps {
	/** Initial claim text */
	claim?: string;
	/** Callback when quantified text is applied */
	onApply?: (text: string) => void;
	/** Additional CSS classes */
	className?: string;
}

// =============================================================================
// Quantified Version Card
// =============================================================================

interface QuantifiedVersionProps {
	text: string;
	confidence: number;
	metricType: string;
	dataSourceHints: string[];
	onApply: () => void;
	onCopy: () => void;
	isCopied: boolean;
}

function QuantifiedVersion({
	text,
	confidence,
	metricType,
	dataSourceHints,
	onApply,
	onCopy,
	isCopied,
}: QuantifiedVersionProps) {
	return (
		<div className="p-4 border rounded-lg space-y-3 hover:bg-muted/30 transition-colors">
			{/* Header with confidence */}
			<div className="flex items-center justify-between">
				<Badge variant="outline" className="text-xs">
					{metricType.replace("_", " ")}
				</Badge>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{Math.round(confidence * 100)}% confidence
					</span>
					<Progress value={confidence * 100} className="w-16 h-1.5" />
				</div>
			</div>

			{/* Quantified text */}
			<p className="text-sm font-medium">{text}</p>

			{/* Data source hints */}
			{dataSourceHints.length > 0 && (
				<div className="flex items-start gap-2">
					<Database className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
					<div className="text-xs text-muted-foreground">
						<span className="font-medium">Data sources: </span>
						{dataSourceHints.join(", ")}
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex gap-2">
				<Button size="sm" onClick={onApply} className="flex-1">
					<Check className="h-3 w-3 mr-1" />
					Apply
				</Button>
				<Button size="sm" variant="outline" onClick={onCopy}>
					{isCopied ? (
						<Check className="h-3 w-3" />
					) : (
						<Copy className="h-3 w-3" />
					)}
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function QuantificationAssistant({
	claim: initialClaim,
	onApply,
	className,
}: QuantificationAssistantProps) {
	// State
	const [claimText, setClaimText] = useState(initialClaim || "");
	const [suggestion, setSuggestion] = useState<QuantificationSuggestion | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

	// Generate quantifications
	const handleGenerate = useCallback(async () => {
		if (!claimText.trim()) {
			setError("Please enter a claim to quantify");
			return;
		}

		setIsGenerating(true);
		setError(null);
		setSuggestion(null);

		const result = await generateQuantification(claimText);
		if (result.success && result.data) {
			// Transform action result to QuantificationSuggestion format used by component
			const data = result.data;
			setSuggestion({
				id: crypto.randomUUID(),
				originalText: data.originalClaim,
				quantifiedVersions: data.quantifiedVersions.map((v) => ({
					text: v.text,
					confidence: 0.8, // Default confidence
					metricType: "numeric", // Default metric type
					dataSourceHints: v.dataSource ? [v.dataSource] : [],
					evidenceNeeded: v.evidenceNeeded,
					strengthIncrease: v.strengthIncrease,
					dataSource: v.dataSource,
				})),
				missingData: data.metrics?.map((m) => `${m.name} (${m.unit})`) ?? [],
				metrics: data.metrics,
				generatedAt: new Date(),
			});
		} else if (!result.success) {
			setError(result.error);
		}

		setIsGenerating(false);
	}, [claimText]);

	// Apply quantified text
	const handleApply = useCallback(
		(text: string) => {
			onApply?.(text);
		},
		[onApply]
	);

	// Copy to clipboard
	const handleCopy = useCallback(async (text: string, index: number) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedIndex(index);
			setTimeout(() => setCopiedIndex(null), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	}, []);

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="h-5 w-5" />
					Quantification Assistant
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-4">
				{/* Input Section */}
				<div className="space-y-2">
					<Label htmlFor="claim-input">Claim to Quantify</Label>
					<Textarea
						id="claim-input"
						value={claimText}
						onChange={(e) => setClaimText(e.target.value)}
						placeholder="Enter a claim that needs quantification, e.g., 'We have extensive experience delivering similar projects.'"
						rows={3}
						className="resize-none"
					/>
					<p className="text-xs text-muted-foreground">
						Enter vague or unquantified claims to get specific, measurable alternatives
					</p>
				</div>

				{/* Generate Button */}
				<Button
					onClick={handleGenerate}
					disabled={isGenerating || !claimText.trim()}
					className="w-full"
				>
					{isGenerating ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Analyzing...
						</>
					) : suggestion ? (
						<>
							<RefreshCw className="h-4 w-4 mr-2" />
							Regenerate
						</>
					) : (
						<>
							<TrendingUp className="h-4 w-4 mr-2" />
							Quantify Claim
						</>
					)}
				</Button>

				{/* Error */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Loading State */}
				{isGenerating && (
					<div className="space-y-3">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				)}

				{/* Results */}
				{suggestion && !isGenerating && (
					<>
						<Separator />

						{/* Original Text */}
						<div className="space-y-2">
							<Label className="text-muted-foreground">Original Claim</Label>
							<p className="text-sm p-3 bg-muted/50 rounded-lg italic">
								"{suggestion.originalText}"
							</p>
						</div>

						{/* Quantified Versions */}
						<div className="space-y-3">
							<Label className="flex items-center gap-2">
								<Lightbulb className="h-4 w-4" />
								Quantified Versions ({suggestion.quantifiedVersions.length})
							</Label>
							<div className="space-y-3">
								{suggestion.quantifiedVersions.map((version, idx) => (
									<QuantifiedVersion
										key={idx}
										text={version.text}
										confidence={version.confidence}
										metricType={version.metricType}
										dataSourceHints={version.dataSourceHints}
										onApply={() => handleApply(version.text)}
										onCopy={() => handleCopy(version.text, idx)}
										isCopied={copiedIndex === idx}
									/>
								))}
							</div>
						</div>

						{/* Missing Data Notice */}
						{suggestion.missingData.length > 0 && (
							<Alert>
								<Database className="h-4 w-4" />
								<AlertDescription>
									<span className="font-medium">Data needed for full quantification:</span>
									<ul className="list-disc list-inside mt-1">
										{suggestion.missingData.map((item, idx) => (
											<li key={idx} className="text-sm">{item}</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						)}
					</>
				)}

				{/* Tips */}
				{!suggestion && !isGenerating && (
					<div className="p-4 bg-muted/50 rounded-lg">
						<h4 className="text-sm font-medium flex items-center gap-2 mb-2">
							<Lightbulb className="h-4 w-4" />
							Tips for Better Results
						</h4>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>Include the type of claim (experience, capability, performance)</li>
							<li>Mention any context (timeframe, customer type, project type)</li>
							<li>Note the subject matter area for relevant metrics</li>
						</ul>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default QuantificationAssistant;
