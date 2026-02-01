/**
 * Project Metrics Component
 *
 * Detailed visualization of CPAR ratings, quantified results,
 * and performance metrics with trend analysis.
 */

"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
	Star,
	TrendingUp,
	TrendingDown,
	Minus,
	Award,
	Target,
	BarChart3,
	FileText,
	CheckCircle,
	AlertTriangle,
	Info,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface CPARRatings {
	quality: number;
	schedule: number;
	cost: number;
	management: number;
	smallBusiness?: number;
	overall: number;
	narratives?: {
		quality?: string;
		schedule?: string;
		cost?: string;
		management?: string;
	};
}

interface QuantifiedResult {
	metric: string;
	value: string;
	context: string;
	impactArea?: string;
}

interface Challenge {
	challenge: string;
	resolution: string;
	outcome: string;
}

interface ProjectMetricsProps {
	cparRatings?: CPARRatings | null;
	quantifiedResults?: QuantifiedResult[] | null;
	keyAccomplishments?: string[] | null;
	challenges?: Challenge[] | null;
	historicalRatings?: CPARRatings[];
	showNarratives?: boolean;
	onGenerateNarrative?: (category: string) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * CPAR Rating description mapping
 */
const CPAR_DESCRIPTIONS = {
	5: { label: "Exceptional", description: "Performance that exceeds all requirements" },
	4: { label: "Very Good", description: "Performance that exceeds many requirements" },
	3: { label: "Satisfactory", description: "Performance meets all requirements" },
	2: { label: "Marginal", description: "Performance does not meet some requirements" },
	1: { label: "Unsatisfactory", description: "Performance does not meet requirements" },
};

/**
 * Get rating category info
 */
function getRatingInfo(rating: number) {
	const rounded = Math.round(rating);
	return CPAR_DESCRIPTIONS[rounded as keyof typeof CPAR_DESCRIPTIONS] ||
		CPAR_DESCRIPTIONS[3];
}

/**
 * Color coding for ratings
 */
function getRatingColor(rating: number) {
	if (rating >= 4.5) return "text-emerald-600 bg-emerald-50 border-emerald-200";
	if (rating >= 3.5) return "text-green-600 bg-green-50 border-green-200";
	if (rating >= 2.5) return "text-yellow-600 bg-yellow-50 border-yellow-200";
	if (rating >= 1.5) return "text-orange-600 bg-orange-50 border-orange-200";
	return "text-red-600 bg-red-50 border-red-200";
}

/**
 * Progress bar color
 */
function getProgressColor(rating: number) {
	if (rating >= 4.5) return "bg-emerald-500";
	if (rating >= 3.5) return "bg-green-500";
	if (rating >= 2.5) return "bg-yellow-500";
	if (rating >= 1.5) return "bg-orange-500";
	return "bg-red-500";
}

/**
 * Single CPAR rating display with gauge
 */
function CPARRatingGauge({
	label,
	rating,
	narrative,
	showNarrative = false,
	onGenerateNarrative,
}: {
	label: string;
	rating: number;
	narrative?: string;
	showNarrative?: boolean;
	onGenerateNarrative?: () => void;
}) {
	const info = getRatingInfo(rating);
	const percentage = (rating / 5) * 100;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="font-medium">{label}</span>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger>
								<Info className="h-3 w-3 text-muted-foreground" />
							</TooltipTrigger>
							<TooltipContent>
								<p className="font-medium">{info.label}</p>
								<p className="text-xs">{info.description}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<div className="flex items-center gap-2">
					<Badge
						variant="outline"
						className={getRatingColor(rating)}
					>
						{rating.toFixed(1)}
					</Badge>
					<span className="text-sm text-muted-foreground">{info.label}</span>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="relative h-3 bg-muted rounded-full overflow-hidden">
				<div
					className={`absolute inset-y-0 left-0 ${getProgressColor(rating)} transition-all duration-500`}
					style={{ width: `${percentage}%` }}
				/>
				{/* Scale markers */}
				<div className="absolute inset-0 flex justify-between px-1">
					{[1, 2, 3, 4, 5].map((n) => (
						<div
							key={n}
							className="w-px h-full bg-white/50"
							style={{ marginLeft: n === 1 ? 0 : undefined }}
						/>
					))}
				</div>
			</div>

			{/* Narrative Section */}
			{showNarrative && (
				<div className="mt-2">
					{narrative ? (
						<p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
							{narrative}
						</p>
					) : (
						<Button
							variant="ghost"
							size="sm"
							className="text-xs"
							onClick={onGenerateNarrative}
						>
							<FileText className="h-3 w-3 mr-1" />
							Generate Narrative
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Overall score radial display
 */
function OverallScoreRadial({ rating }: { rating: number }) {
	const circumference = 2 * Math.PI * 45;
	const progress = ((rating / 5) * circumference);
	const info = getRatingInfo(rating);

	return (
		<div className="flex flex-col items-center justify-center">
			<div className="relative w-32 h-32">
				<svg className="w-32 h-32 transform -rotate-90">
					{/* Background circle */}
					<circle
						cx="64"
						cy="64"
						r="45"
						stroke="currentColor"
						strokeWidth="10"
						fill="none"
						className="text-muted"
					/>
					{/* Progress circle */}
					<circle
						cx="64"
						cy="64"
						r="45"
						stroke="currentColor"
						strokeWidth="10"
						fill="none"
						strokeDasharray={circumference}
						strokeDashoffset={circumference - progress}
						strokeLinecap="round"
						className={
							rating >= 4.5
								? "text-emerald-500"
								: rating >= 3.5
									? "text-green-500"
									: rating >= 2.5
										? "text-yellow-500"
										: "text-orange-500"
						}
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-3xl font-bold">{rating.toFixed(1)}</span>
					<span className="text-xs text-muted-foreground">of 5.0</span>
				</div>
			</div>
			<Badge variant="outline" className={`mt-2 ${getRatingColor(rating)}`}>
				{info.label}
			</Badge>
		</div>
	);
}

/**
 * Quantified result card
 */
function QuantifiedResultCard({ result }: { result: QuantifiedResult }) {
	return (
		<div className="p-3 border rounded-lg">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1">
					<p className="font-medium text-sm">{result.metric}</p>
					<p className="text-2xl font-bold text-primary mt-1">{result.value}</p>
				</div>
				{result.impactArea && (
					<Badge variant="secondary" className="text-xs">
						{result.impactArea}
					</Badge>
				)}
			</div>
			<p className="text-xs text-muted-foreground mt-2">{result.context}</p>
		</div>
	);
}

/**
 * Challenge/Resolution card
 */
function ChallengeCard({ challenge }: { challenge: Challenge }) {
	return (
		<div className="p-4 border rounded-lg space-y-3">
			<div className="flex items-start gap-3">
				<AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
				<div>
					<p className="font-medium text-sm">Challenge</p>
					<p className="text-sm text-muted-foreground">{challenge.challenge}</p>
				</div>
			</div>
			<div className="flex items-start gap-3">
				<Target className="h-5 w-5 text-blue-500 mt-0.5" />
				<div>
					<p className="font-medium text-sm">Resolution</p>
					<p className="text-sm text-muted-foreground">{challenge.resolution}</p>
				</div>
			</div>
			<div className="flex items-start gap-3">
				<CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
				<div>
					<p className="font-medium text-sm">Outcome</p>
					<p className="text-sm text-muted-foreground">{challenge.outcome}</p>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectMetrics({
	cparRatings,
	quantifiedResults,
	keyAccomplishments,
	challenges,
	historicalRatings,
	showNarratives = false,
	onGenerateNarrative,
}: ProjectMetricsProps) {
	const [activeTab, setActiveTab] = useState("ratings");

	if (!cparRatings && !quantifiedResults?.length && !keyAccomplishments?.length) {
		return (
			<Card>
				<CardContent className="p-6 text-center text-muted-foreground">
					<BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p>No performance metrics available</p>
					<p className="text-sm">Add CPAR ratings or quantified results to see metrics</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<BarChart3 className="h-5 w-5" />
					Performance Metrics
				</CardTitle>
				<CardDescription>
					CPAR ratings, quantified results, and key accomplishments
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="ratings" className="gap-1">
							<Star className="h-4 w-4" />
							Ratings
						</TabsTrigger>
						<TabsTrigger value="results" className="gap-1">
							<TrendingUp className="h-4 w-4" />
							Results
						</TabsTrigger>
						<TabsTrigger value="accomplishments" className="gap-1">
							<Award className="h-4 w-4" />
							Accomplishments
						</TabsTrigger>
						<TabsTrigger value="challenges" className="gap-1">
							<Target className="h-4 w-4" />
							Challenges
						</TabsTrigger>
					</TabsList>

					{/* CPAR Ratings Tab */}
					<TabsContent value="ratings" className="mt-4">
						{cparRatings ? (
							<div className="space-y-6">
								{/* Overall Score */}
								<div className="flex items-center justify-center py-4">
									<OverallScoreRadial rating={cparRatings.overall} />
								</div>

								{/* Individual Ratings */}
								<div className="space-y-4">
									<CPARRatingGauge
										label="Quality of Product/Service"
										rating={cparRatings.quality}
										narrative={cparRatings.narratives?.quality}
										showNarrative={showNarratives}
										onGenerateNarrative={() => onGenerateNarrative?.("quality")}
									/>
									<CPARRatingGauge
										label="Schedule"
										rating={cparRatings.schedule}
										narrative={cparRatings.narratives?.schedule}
										showNarrative={showNarratives}
										onGenerateNarrative={() => onGenerateNarrative?.("schedule")}
									/>
									<CPARRatingGauge
										label="Cost Control"
										rating={cparRatings.cost}
										narrative={cparRatings.narratives?.cost}
										showNarrative={showNarratives}
										onGenerateNarrative={() => onGenerateNarrative?.("cost")}
									/>
									<CPARRatingGauge
										label="Management"
										rating={cparRatings.management}
										narrative={cparRatings.narratives?.management}
										showNarrative={showNarratives}
										onGenerateNarrative={() => onGenerateNarrative?.("management")}
									/>
									{cparRatings.smallBusiness !== undefined && (
										<CPARRatingGauge
											label="Small Business Subcontracting"
											rating={cparRatings.smallBusiness}
										/>
									)}
								</div>

								{/* Rating Scale Legend */}
								<div className="mt-6 p-4 bg-muted/50 rounded-lg">
									<p className="text-sm font-medium mb-2">Rating Scale</p>
									<div className="grid grid-cols-5 gap-2 text-xs">
										{[5, 4, 3, 2, 1].map((n) => {
											const info = CPAR_DESCRIPTIONS[n as keyof typeof CPAR_DESCRIPTIONS];
											return (
												<div key={n} className="text-center">
													<div className={`w-full h-2 rounded ${getProgressColor(n)} mb-1`} />
													<p className="font-medium">{n}</p>
													<p className="text-muted-foreground">{info.label}</p>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
								<p>No CPAR ratings recorded</p>
							</div>
						)}
					</TabsContent>

					{/* Quantified Results Tab */}
					<TabsContent value="results" className="mt-4">
						{quantifiedResults && quantifiedResults.length > 0 ? (
							<div className="grid gap-4 md:grid-cols-2">
								{quantifiedResults.map((result, index) => (
									<QuantifiedResultCard key={index} result={result} />
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
								<p>No quantified results recorded</p>
								<p className="text-sm">Add measurable outcomes and metrics</p>
							</div>
						)}
					</TabsContent>

					{/* Accomplishments Tab */}
					<TabsContent value="accomplishments" className="mt-4">
						{keyAccomplishments && keyAccomplishments.length > 0 ? (
							<div className="space-y-3">
								{keyAccomplishments.map((accomplishment, index) => (
									<div
										key={index}
										className="flex items-start gap-3 p-3 border rounded-lg"
									>
										<CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
										<p className="text-sm">{accomplishment}</p>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
								<p>No key accomplishments recorded</p>
								<p className="text-sm">Document significant achievements and milestones</p>
							</div>
						)}
					</TabsContent>

					{/* Challenges Tab */}
					<TabsContent value="challenges" className="mt-4">
						{challenges && challenges.length > 0 ? (
							<div className="space-y-4">
								{challenges.map((challenge, index) => (
									<ChallengeCard key={index} challenge={challenge} />
								))}
							</div>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
								<p>No challenges documented</p>
								<p className="text-sm">Record challenges overcome to demonstrate problem-solving</p>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

export default ProjectMetrics;
