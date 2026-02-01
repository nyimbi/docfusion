"use client";

/**
 * PositionMatcher Component
 *
 * Matches personnel to position requirements with scoring visualization,
 * gap analysis, and candidate ranking. Supports drag-and-drop assignment.
 */

import { useState, useMemo } from "react";
import {
	Users,
	Target,
	CheckCircle,
	AlertTriangle,
	ArrowRight,
	Search,
	Filter,
	Star,
	X,
	ChevronDown,
	ChevronUp,
	UserCheck,
	UserX,
	Percent,
	Award,
	Shield,
	GraduationCap,
	Briefcase,
	Clock
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Personnel, PositionRequirement } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface PositionMatcherProps {
	position: PositionRequirement;
	candidates: Personnel[];
	onAssign: (personnelId: string, positionId: string) => Promise<void>;
	onAddBackup: (personnelId: string, positionId: string) => Promise<void>;
	className?: string;
}

interface MatchScore {
	overall: number;
	skills: number;
	experience: number;
	education: number;
	clearance: number;
	certifications: number;
	availability: number;
	gaps: string[];
	strengths: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateMatchScore(personnel: Personnel, position: PositionRequirement): MatchScore {
	const scores: MatchScore = {
		overall: 0,
		skills: 0,
		experience: 0,
		education: 0,
		clearance: 0,
		certifications: 0,
		availability: 0,
		gaps: [],
		strengths: [],
	};

	// Skills matching
	const requiredSkills = position.requiredSkills || [];
	const personnelSkills = personnel.skills || [];
	let skillMatches = 0;

	requiredSkills.forEach(req => {
		const match = personnelSkills.find(ps =>
			ps.skillName.toLowerCase().includes(req.skillName.toLowerCase()) ||
			req.skillName.toLowerCase().includes(ps.skillName.toLowerCase())
		);

		if (match) {
			const proficiencyOrder = ["beginner", "intermediate", "advanced", "expert"];
			const requiredLevel = proficiencyOrder.indexOf(req.minProficiency);
			const actualLevel = proficiencyOrder.indexOf(match.proficiency);

			if (actualLevel >= requiredLevel) {
				skillMatches++;
				if (actualLevel > requiredLevel) {
					scores.strengths.push(`Exceeds ${req.skillName} requirement`);
				}
			} else {
				scores.gaps.push(`${req.skillName}: ${match.proficiency} (need ${req.minProficiency})`);
			}
		} else if (req.required) {
			scores.gaps.push(`Missing required skill: ${req.skillName}`);
		}
	});

	scores.skills = requiredSkills.length > 0
		? (skillMatches / requiredSkills.length) * 100
		: 100;

	// Experience matching
	const requiredExp = position.requiredExperience || 0;
	const actualExp = personnel.yearsOfExperience || 0;

	if (actualExp >= requiredExp) {
		scores.experience = 100;
		if (actualExp > requiredExp + 3) {
			scores.strengths.push(`${actualExp - requiredExp} extra years experience`);
		}
	} else {
		scores.experience = (actualExp / requiredExp) * 100;
		scores.gaps.push(`Experience: ${actualExp} years (need ${requiredExp})`);
	}

	// Education matching
	const educationLevels = ["high_school", "bachelors", "masters", "doctorate"];
	const requiredEduLevel = educationLevels.indexOf(position.minimumEducation || "");
	const personnelEducation = personnel.education || [];

	let maxEducationLevel = -1;
	personnelEducation.forEach(edu => {
		const level = edu.degree.toLowerCase();
		if (level.includes("doctor") || level.includes("phd")) maxEducationLevel = Math.max(maxEducationLevel, 3);
		else if (level.includes("master")) maxEducationLevel = Math.max(maxEducationLevel, 2);
		else if (level.includes("bachelor")) maxEducationLevel = Math.max(maxEducationLevel, 1);
		else maxEducationLevel = Math.max(maxEducationLevel, 0);
	});

	if (maxEducationLevel >= requiredEduLevel) {
		scores.education = 100;
	} else if (requiredEduLevel > 0) {
		scores.education = (maxEducationLevel / requiredEduLevel) * 100;
		scores.gaps.push(`Education: needs ${position.minimumEducation}`);
	} else {
		scores.education = 100;
	}

	// Clearance matching
	const clearanceLevels = ["none", "public_trust", "secret", "top_secret", "ts_sci"];
	const requiredClearance = position.requiredClearance?.toLowerCase().replace(/[\s/]/g, "_") || "";
	const actualClearance = personnel.clearanceLevel?.toLowerCase().replace(/[\s/]/g, "_") || "none";

	const reqClearanceLevel = clearanceLevels.indexOf(requiredClearance);
	const actualClearanceLevel = clearanceLevels.indexOf(actualClearance);

	if (actualClearanceLevel >= reqClearanceLevel) {
		scores.clearance = 100;
		if (actualClearanceLevel > reqClearanceLevel && reqClearanceLevel > 0) {
			scores.strengths.push(`Higher clearance: ${personnel.clearanceLevel}`);
		}
	} else if (reqClearanceLevel > 0) {
		scores.clearance = 0;
		scores.gaps.push(`Clearance: ${personnel.clearanceLevel || "None"} (need ${position.requiredClearance})`);
	} else {
		scores.clearance = 100;
	}

	// Certifications matching
	const requiredCerts = position.requiredCertifications || [];
	const personnelCerts = (personnel.certifications || []).map(c => c.name.toLowerCase());

	let certMatches = 0;
	requiredCerts.forEach(cert => {
		if (personnelCerts.some(pc => pc.includes(cert.toLowerCase()))) {
			certMatches++;
		} else {
			scores.gaps.push(`Missing cert: ${cert}`);
		}
	});

	scores.certifications = requiredCerts.length > 0
		? (certMatches / requiredCerts.length) * 100
		: 100;

	// Availability
	if (personnel.availability === "available") {
		scores.availability = 100;
	} else if (personnel.availability === "partial") {
		scores.availability = 70;
		scores.gaps.push("Only partially available");
	} else if (personnel.availability === "committed") {
		scores.availability = 30;
		scores.gaps.push("Currently committed to other work");
	} else {
		scores.availability = 0;
		scores.gaps.push("Currently unavailable");
	}

	// Calculate overall (weighted)
	scores.overall = (
		scores.skills * 0.30 +
		scores.experience * 0.20 +
		scores.education * 0.10 +
		scores.clearance * 0.20 +
		scores.certifications * 0.10 +
		scores.availability * 0.10
	);

	return scores;
}

function getScoreColor(score: number): string {
	if (score >= 90) return "text-green-600";
	if (score >= 70) return "text-blue-600";
	if (score >= 50) return "text-yellow-600";
	return "text-red-600";
}

function getScoreBgColor(score: number): string {
	if (score >= 90) return "bg-green-100";
	if (score >= 70) return "bg-blue-100";
	if (score >= 50) return "bg-yellow-100";
	return "bg-red-100";
}

// ============================================================================
// Sub-Components
// ============================================================================

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: typeof Award }) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between text-sm">
				<span className="flex items-center gap-1 text-muted-foreground">
					<Icon className="h-3 w-3" />
					{label}
				</span>
				<span className={cn("font-medium", getScoreColor(score))}>
					{Math.round(score)}%
				</span>
			</div>
			<Progress value={score} className="h-2" />
		</div>
	);
}

function CandidateCard({
	personnel,
	score,
	isAssigned = false,
	isBackup = false,
	onSelect,
	onAssign,
	onAddBackup,
}: {
	personnel: Personnel;
	score: MatchScore;
	isAssigned?: boolean;
	isBackup?: boolean;
	onSelect: () => void;
	onAssign: () => void;
	onAddBackup: () => void;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<Card className={cn(
			"transition-all cursor-pointer hover:shadow-md",
			isAssigned && "ring-2 ring-green-500 bg-green-50",
			isBackup && "ring-2 ring-blue-300 bg-blue-50"
		)}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{/* Score Indicator */}
					<div className={cn(
						"w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold",
						getScoreBgColor(score.overall),
						getScoreColor(score.overall)
					)}>
						{Math.round(score.overall)}
					</div>

					{/* Info */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between">
							<div>
								<h4 className="font-semibold">
									{personnel.firstName} {personnel.lastName}
								</h4>
								<p className="text-sm text-muted-foreground">
									{personnel.currentTitle || "No title"}
								</p>
							</div>
							<div className="flex items-center gap-1">
								{isAssigned && (
									<Badge className="bg-green-500">Assigned</Badge>
								)}
								{isBackup && (
									<Badge variant="secondary">Backup</Badge>
								)}
							</div>
						</div>

						{/* Quick Stats */}
						<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<Briefcase className="h-3 w-3" />
								{personnel.yearsOfExperience || 0} yrs
							</span>
							{personnel.clearanceLevel && (
								<span className="flex items-center gap-1">
									<Shield className="h-3 w-3" />
									{personnel.clearanceLevel}
								</span>
							)}
							<Badge
								variant="outline"
								className={cn(
									"text-xs",
									personnel.availability === "available" && "text-green-600",
									personnel.availability === "partial" && "text-yellow-600",
									personnel.availability === "committed" && "text-orange-600"
								)}
							>
								{personnel.availability || "Unknown"}
							</Badge>
						</div>

						{/* Gaps/Strengths Preview */}
						{(score.gaps.length > 0 || score.strengths.length > 0) && (
							<div className="flex flex-wrap gap-1 mt-2">
								{score.strengths.slice(0, 2).map((s, i) => (
									<Badge key={i} variant="outline" className="text-xs text-green-600 bg-green-50">
										<CheckCircle className="h-3 w-3 mr-1" />
										{s}
									</Badge>
								))}
								{score.gaps.slice(0, 2).map((g, i) => (
									<Badge key={i} variant="outline" className="text-xs text-yellow-600 bg-yellow-50">
										<AlertTriangle className="h-3 w-3 mr-1" />
										{g}
									</Badge>
								))}
								{(score.gaps.length + score.strengths.length) > 4 && (
									<Badge variant="outline" className="text-xs">
										+{score.gaps.length + score.strengths.length - 4} more
									</Badge>
								)}
							</div>
						)}

						{/* Expanded Details */}
						{expanded && (
							<div className="mt-4 pt-4 border-t space-y-3">
								<div className="grid grid-cols-2 gap-3">
									<ScoreBar label="Skills" score={score.skills} icon={Award} />
									<ScoreBar label="Experience" score={score.experience} icon={Briefcase} />
									<ScoreBar label="Education" score={score.education} icon={GraduationCap} />
									<ScoreBar label="Clearance" score={score.clearance} icon={Shield} />
									<ScoreBar label="Certifications" score={score.certifications} icon={Award} />
									<ScoreBar label="Availability" score={score.availability} icon={Clock} />
								</div>

								{score.gaps.length > 0 && (
									<div>
										<h5 className="text-sm font-medium text-red-600 mb-1">Gaps</h5>
										<ul className="text-xs text-muted-foreground space-y-1">
											{score.gaps.map((gap, i) => (
												<li key={i} className="flex items-start gap-1">
													<X className="h-3 w-3 mt-0.5 text-red-500" />
													{gap}
												</li>
											))}
										</ul>
									</div>
								)}

								{score.strengths.length > 0 && (
									<div>
										<h5 className="text-sm font-medium text-green-600 mb-1">Strengths</h5>
										<ul className="text-xs text-muted-foreground space-y-1">
											{score.strengths.map((s, i) => (
												<li key={i} className="flex items-start gap-1">
													<CheckCircle className="h-3 w-3 mt-0.5 text-green-500" />
													{s}
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center justify-between mt-3 pt-3 border-t">
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
					>
						{expanded ? (
							<><ChevronUp className="h-4 w-4 mr-1" /> Less</>
						) : (
							<><ChevronDown className="h-4 w-4 mr-1" /> Details</>
						)}
					</Button>
					<div className="flex items-center gap-2">
						{!isAssigned && !isBackup && (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={(e) => { e.stopPropagation(); onAddBackup(); }}
								>
									<Star className="h-4 w-4 mr-1" />
									Backup
								</Button>
								<Button
									size="sm"
									onClick={(e) => { e.stopPropagation(); onAssign(); }}
								>
									<UserCheck className="h-4 w-4 mr-1" />
									Assign
								</Button>
							</>
						)}
						{isAssigned && (
							<Button variant="outline" size="sm" onClick={onSelect}>
								<UserX className="h-4 w-4 mr-1" />
								Unassign
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function PositionMatcher({
	position,
	candidates,
	onAssign,
	onAddBackup,
	className,
}: PositionMatcherProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [minScore, setMinScore] = useState(0);
	const [assignDialogOpen, setAssignDialogOpen] = useState(false);
	const [selectedCandidate, setSelectedCandidate] = useState<Personnel | null>(null);

	// Calculate scores for all candidates
	const scoredCandidates = useMemo(() => {
		return candidates
			.map(c => ({
				personnel: c,
				score: calculateMatchScore(c, position),
			}))
			.sort((a, b) => b.score.overall - a.score.overall);
	}, [candidates, position]);

	// Filter candidates
	const filteredCandidates = useMemo(() => {
		return scoredCandidates.filter(({ personnel, score }) => {
			if (score.overall < minScore) return false;
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const nameMatch = `${personnel.firstName} ${personnel.lastName}`.toLowerCase().includes(query);
				const titleMatch = personnel.currentTitle?.toLowerCase().includes(query);
				const skillMatch = personnel.skills?.some(s => s.skillName.toLowerCase().includes(query));
				if (!nameMatch && !titleMatch && !skillMatch) return false;
			}
			return true;
		});
	}, [scoredCandidates, searchQuery, minScore]);

	// Check assignment status
	const assignedPersonnelId = position.assignedPersonnelId;
	const backupIds = new Set((position.backupCandidates || []).map(b => b.personnelId));

	const handleAssign = async (personnelId: string) => {
		await onAssign(personnelId, position.id);
		setAssignDialogOpen(false);
	};

	const handleAddBackup = async (personnelId: string) => {
		await onAddBackup(personnelId, position.id);
	};

	// Stats
	const stats = {
		total: candidates.length,
		qualified: scoredCandidates.filter(c => c.score.overall >= 70).length,
		highMatch: scoredCandidates.filter(c => c.score.overall >= 90).length,
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Position Header */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								{position.positionTitle}
							</CardTitle>
							<CardDescription className="mt-1">
								{position.laborCategory && `${position.laborCategory} • `}
								{position.headcount} position(s) • {position.hoursPerWeek || 40} hrs/week
							</CardDescription>
						</div>
						<Badge
							variant={position.assignmentStatus === "assigned" ? "default" : "outline"}
						>
							{position.assignmentStatus || "Open"}
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-4 gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">Required Experience</p>
							<p className="font-medium">{position.requiredExperience || 0} years</p>
						</div>
						<div>
							<p className="text-muted-foreground">Education</p>
							<p className="font-medium capitalize">{position.minimumEducation || "Any"}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Clearance</p>
							<p className="font-medium">{position.requiredClearance || "None required"}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Location</p>
							<p className="font-medium">
								{position.locationRequired || "Any"}
								{position.remoteAllowed && " (Remote OK)"}
							</p>
						</div>
					</div>

					{position.requiredSkills && position.requiredSkills.length > 0 && (
						<div className="mt-4">
							<p className="text-sm text-muted-foreground mb-2">Required Skills</p>
							<div className="flex flex-wrap gap-1">
								{position.requiredSkills.map((skill, i) => (
									<Badge key={i} variant={skill.required ? "default" : "secondary"}>
										{skill.skillName}
										<span className="ml-1 text-xs opacity-70">
											({skill.minProficiency})
										</span>
									</Badge>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center gap-2">
							<Users className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-2xl font-bold">{stats.total}</p>
								<p className="text-xs text-muted-foreground">Total Candidates</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-blue-500" />
							<div>
								<p className="text-2xl font-bold">{stats.qualified}</p>
								<p className="text-xs text-muted-foreground">Qualified (70%+)</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="py-4">
						<div className="flex items-center gap-2">
							<Star className="h-5 w-5 text-green-500" />
							<div>
								<p className="text-2xl font-bold">{stats.highMatch}</p>
								<p className="text-xs text-muted-foreground">High Match (90%+)</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<div className="flex-1">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name, title, or skills..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Min Score:</span>
					<Input
						type="number"
						value={minScore}
						onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
						className="w-20"
						min={0}
						max={100}
					/>
					<Percent className="h-4 w-4 text-muted-foreground" />
				</div>
			</div>

			{/* Candidate List */}
			<div className="space-y-4">
				<h3 className="font-medium flex items-center gap-2">
					<Users className="h-4 w-4" />
					Candidates ({filteredCandidates.length})
				</h3>

				{filteredCandidates.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium">No matching candidates</h3>
							<p className="text-sm text-muted-foreground">
								Try adjusting the search or score filters
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{filteredCandidates.map(({ personnel, score }) => (
							<CandidateCard
								key={personnel.id}
								personnel={personnel}
								score={score}
								isAssigned={personnel.id === assignedPersonnelId}
								isBackup={backupIds.has(personnel.id)}
								onSelect={() => setSelectedCandidate(personnel)}
								onAssign={() => handleAssign(personnel.id)}
								onAddBackup={() => handleAddBackup(personnel.id)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default PositionMatcher;
