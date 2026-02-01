"use client";

/**
 * PersonnelCard Component
 *
 * Displays a compact or expanded view of personnel information
 * including skills, certifications, clearance status, and availability.
 * Supports both card grid and list view layouts.
 */

import { useState } from "react";
import {
	User,
	Mail,
	Phone,
	MapPin,
	Shield,
	Award,
	Calendar,
	Briefcase,
	GraduationCap,
	Clock,
	Star,
	AlertTriangle,
	CheckCircle,
	ExternalLink,
	ChevronDown,
	ChevronUp,
	Edit,
	FileText,
	Copy,
	MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Personnel } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface PersonnelCardProps {
	personnel: Personnel;
	variant?: "compact" | "full" | "list";
	showSkills?: boolean;
	showCertifications?: boolean;
	showAvailability?: boolean;
	highlightSkills?: string[];
	onEdit?: (id: string) => void;
	onViewResume?: (id: string) => void;
	onGenerateResume?: (id: string) => void;
	onSelect?: (id: string, selected: boolean) => void;
	selected?: boolean;
	className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(firstName: string, lastName: string): string {
	return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getClearanceBadgeVariant(level: string | null): "default" | "secondary" | "destructive" | "outline" {
	if (!level) return "outline";
	const levelLower = level.toLowerCase();
	if (levelLower.includes("ts/sci") || levelLower.includes("top secret")) return "destructive";
	if (levelLower.includes("secret")) return "default";
	if (levelLower.includes("public trust")) return "secondary";
	return "outline";
}

function getAvailabilityColor(availability: string | null): string {
	switch (availability) {
		case "available": return "text-green-600 bg-green-50";
		case "partial": return "text-yellow-600 bg-yellow-50";
		case "committed": return "text-orange-600 bg-orange-50";
		case "unavailable": return "text-red-600 bg-red-50";
		default: return "text-gray-600 bg-gray-50";
	}
}

function getProficiencyColor(proficiency: string): string {
	switch (proficiency) {
		case "expert": return "bg-purple-100 text-purple-800 border-purple-200";
		case "advanced": return "bg-blue-100 text-blue-800 border-blue-200";
		case "intermediate": return "bg-green-100 text-green-800 border-green-200";
		case "beginner": return "bg-gray-100 text-gray-800 border-gray-200";
		default: return "bg-gray-100 text-gray-800 border-gray-200";
	}
}

function getCertificationStatus(cert: { status: string; expirationDate?: string }): {
	icon: typeof CheckCircle;
	color: string;
	label: string;
} {
	if (cert.status === "expired") {
		return { icon: AlertTriangle, color: "text-red-500", label: "Expired" };
	}

	if (cert.expirationDate) {
		const expDate = new Date(cert.expirationDate);
		const now = new Date();
		const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		if (daysUntilExpiry <= 0) {
			return { icon: AlertTriangle, color: "text-red-500", label: "Expired" };
		}
		if (daysUntilExpiry <= 30) {
			return { icon: AlertTriangle, color: "text-yellow-500", label: `Expires in ${daysUntilExpiry} days` };
		}
		if (daysUntilExpiry <= 90) {
			return { icon: Clock, color: "text-orange-500", label: `Expires in ${daysUntilExpiry} days` };
		}
	}

	return { icon: CheckCircle, color: "text-green-500", label: "Active" };
}

// ============================================================================
// Sub-Components
// ============================================================================

function SkillBadge({
	skill,
	highlighted = false
}: {
	skill: { skillName: string; proficiency: string; yearsExperience: number };
	highlighted?: boolean;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant="outline"
						className={cn(
							"text-xs",
							getProficiencyColor(skill.proficiency),
							highlighted && "ring-2 ring-blue-400 ring-offset-1"
						)}
					>
						{skill.skillName}
					</Badge>
				</TooltipTrigger>
				<TooltipContent>
					<p className="font-medium">{skill.skillName}</p>
					<p className="text-xs text-muted-foreground">
						{skill.proficiency} • {skill.yearsExperience} years
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function CertificationBadge({
	cert
}: {
	cert: { name: string; issuer: string; status: string; expirationDate?: string };
}) {
	const status = getCertificationStatus(cert);
	const StatusIcon = status.icon;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-1 text-xs">
						<StatusIcon className={cn("h-3 w-3", status.color)} />
						<span className="truncate max-w-[120px]">{cert.name}</span>
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p className="font-medium">{cert.name}</p>
					<p className="text-xs text-muted-foreground">{cert.issuer}</p>
					<p className={cn("text-xs", status.color)}>{status.label}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function PersonnelCard({
	personnel,
	variant = "compact",
	showSkills = true,
	showCertifications = true,
	showAvailability = true,
	highlightSkills = [],
	onEdit,
	onViewResume,
	onGenerateResume,
	onSelect,
	selected = false,
	className,
}: PersonnelCardProps) {
	const [expanded, setExpanded] = useState(false);

	const skills = personnel.skills || [];
	const certifications = personnel.certifications || [];
	const education = personnel.education || [];

	// Sort skills by proficiency level
	const sortedSkills = [...skills].sort((a, b) => {
		const order = { expert: 0, advanced: 1, intermediate: 2, beginner: 3 };
		return (order[a.proficiency] || 4) - (order[b.proficiency] || 4);
	});

	// Check for expiring certifications
	const expiringCerts = certifications.filter(cert => {
		if (!cert.expirationDate) return false;
		const daysUntil = Math.ceil(
			(new Date(cert.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
		);
		return daysUntil > 0 && daysUntil <= 90;
	});

	// ========================================================================
	// Compact Variant
	// ========================================================================

	if (variant === "compact") {
		return (
			<Card
				className={cn(
					"hover:shadow-md transition-shadow cursor-pointer",
					selected && "ring-2 ring-blue-500",
					className
				)}
				onClick={() => onSelect?.(personnel.id, !selected)}
			>
				<CardContent className="p-4">
					<div className="flex items-start gap-3">
						<Avatar className="h-12 w-12">
							<AvatarImage src={personnel.photoUrl || undefined} />
							<AvatarFallback className="bg-primary/10 text-primary">
								{getInitials(personnel.firstName, personnel.lastName)}
							</AvatarFallback>
						</Avatar>

						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold truncate">
									{personnel.firstName} {personnel.lastName}
								</h3>
								<DropdownMenu>
									<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
										<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => onEdit?.(personnel.id)}>
											<Edit className="h-4 w-4 mr-2" />
											Edit Profile
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onViewResume?.(personnel.id)}>
											<FileText className="h-4 w-4 mr-2" />
											View Resume
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onGenerateResume?.(personnel.id)}>
											<Copy className="h-4 w-4 mr-2" />
											Generate Resume
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							<p className="text-sm text-muted-foreground truncate">
								{personnel.currentTitle || "No title"}
							</p>

							<div className="flex items-center gap-2 mt-2 flex-wrap">
								{personnel.clearanceLevel && (
									<Badge variant={getClearanceBadgeVariant(personnel.clearanceLevel)} className="text-xs">
										<Shield className="h-3 w-3 mr-1" />
										{personnel.clearanceLevel}
									</Badge>
								)}

								{showAvailability && (
									<Badge
										variant="outline"
										className={cn("text-xs", getAvailabilityColor(personnel.availability))}
									>
										{personnel.availability || "Unknown"}
									</Badge>
								)}

								{expiringCerts.length > 0 && (
									<Badge variant="outline" className="text-xs text-yellow-600 bg-yellow-50">
										<AlertTriangle className="h-3 w-3 mr-1" />
										{expiringCerts.length} expiring
									</Badge>
								)}
							</div>

							{showSkills && sortedSkills.length > 0 && (
								<div className="flex flex-wrap gap-1 mt-2">
									{sortedSkills.slice(0, 4).map((skill, idx) => (
										<SkillBadge
											key={idx}
											skill={skill}
											highlighted={highlightSkills.includes(skill.skillId || skill.skillName)}
										/>
									))}
									{sortedSkills.length > 4 && (
										<Badge variant="outline" className="text-xs">
											+{sortedSkills.length - 4} more
										</Badge>
									)}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// ========================================================================
	// List Variant
	// ========================================================================

	if (variant === "list") {
		return (
			<div
				className={cn(
					"flex items-center gap-4 p-4 border-b hover:bg-muted/50 transition-colors",
					selected && "bg-blue-50",
					className
				)}
				onClick={() => onSelect?.(personnel.id, !selected)}
			>
				<Avatar className="h-10 w-10">
					<AvatarImage src={personnel.photoUrl || undefined} />
					<AvatarFallback className="bg-primary/10 text-primary text-sm">
						{getInitials(personnel.firstName, personnel.lastName)}
					</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0 grid grid-cols-5 gap-4 items-center">
					<div className="col-span-1">
						<p className="font-medium truncate">
							{personnel.firstName} {personnel.lastName}
						</p>
						<p className="text-xs text-muted-foreground truncate">
							{personnel.currentTitle || "No title"}
						</p>
					</div>

					<div className="col-span-1">
						<p className="text-sm text-muted-foreground">{personnel.department || "—"}</p>
					</div>

					<div className="col-span-1">
						{personnel.clearanceLevel ? (
							<Badge variant={getClearanceBadgeVariant(personnel.clearanceLevel)} className="text-xs">
								{personnel.clearanceLevel}
							</Badge>
						) : (
							<span className="text-xs text-muted-foreground">None</span>
						)}
					</div>

					<div className="col-span-1">
						<Badge
							variant="outline"
							className={cn("text-xs", getAvailabilityColor(personnel.availability))}
						>
							{personnel.availability || "Unknown"}
						</Badge>
					</div>

					<div className="col-span-1 flex items-center justify-end gap-2">
						<p className="text-sm text-muted-foreground">
							{personnel.yearsOfExperience || 0} yrs
						</p>
						<DropdownMenu>
							<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onEdit?.(personnel.id)}>
									<Edit className="h-4 w-4 mr-2" />
									Edit Profile
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onViewResume?.(personnel.id)}>
									<FileText className="h-4 w-4 mr-2" />
									View Resume
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onGenerateResume?.(personnel.id)}>
									<Copy className="h-4 w-4 mr-2" />
									Generate Resume
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		);
	}

	// ========================================================================
	// Full Variant
	// ========================================================================

	return (
		<Card className={cn("", selected && "ring-2 ring-blue-500", className)}>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-4">
						<Avatar className="h-16 w-16">
							<AvatarImage src={personnel.photoUrl || undefined} />
							<AvatarFallback className="bg-primary/10 text-primary text-lg">
								{getInitials(personnel.firstName, personnel.lastName)}
							</AvatarFallback>
						</Avatar>

						<div>
							<CardTitle className="text-xl">
								{personnel.firstName} {personnel.lastName}
							</CardTitle>
							<p className="text-muted-foreground">
								{personnel.currentTitle || "No title"}
							</p>
							<div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
								{personnel.email && (
									<span className="flex items-center gap-1">
										<Mail className="h-4 w-4" />
										{personnel.email}
									</span>
								)}
								{personnel.phone && (
									<span className="flex items-center gap-1">
										<Phone className="h-4 w-4" />
										{personnel.phone}
									</span>
								)}
								{personnel.location && (
									<span className="flex items-center gap-1">
										<MapPin className="h-4 w-4" />
										{personnel.location}
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={() => onEdit?.(personnel.id)}>
							<Edit className="h-4 w-4 mr-2" />
							Edit
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onViewResume?.(personnel.id)}>
									<FileText className="h-4 w-4 mr-2" />
									View Resume
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onGenerateResume?.(personnel.id)}>
									<Copy className="h-4 w-4 mr-2" />
									Generate Resume
								</DropdownMenuItem>
								{personnel.linkedInUrl && (
									<DropdownMenuItem asChild>
										<a href={personnel.linkedInUrl} target="_blank" rel="noopener noreferrer">
											<ExternalLink className="h-4 w-4 mr-2" />
											LinkedIn Profile
										</a>
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardHeader>

			<CardContent>
				{/* Status Badges */}
				<div className="flex flex-wrap gap-2 mb-4">
					{personnel.clearanceLevel && (
						<Badge variant={getClearanceBadgeVariant(personnel.clearanceLevel)}>
							<Shield className="h-3 w-3 mr-1" />
							{personnel.clearanceLevel}
							{personnel.clearanceStatus && ` (${personnel.clearanceStatus})`}
						</Badge>
					)}

					<Badge
						variant="outline"
						className={getAvailabilityColor(personnel.availability)}
					>
						<Calendar className="h-3 w-3 mr-1" />
						{personnel.availability || "Unknown"}
						{personnel.availableDate && ` from ${personnel.availableDate}`}
					</Badge>

					{personnel.yearsOfExperience && (
						<Badge variant="outline">
							<Briefcase className="h-3 w-3 mr-1" />
							{personnel.yearsOfExperience} years experience
						</Badge>
					)}

					{personnel.proposalWinCount !== null && personnel.proposalSubmitCount !== null && (
						<Badge variant="outline">
							<Star className="h-3 w-3 mr-1" />
							{personnel.proposalWinCount}/{personnel.proposalSubmitCount} proposals won
						</Badge>
					)}
				</div>

				{/* Professional Summary */}
				{personnel.professionalSummary && (
					<div className="mb-4">
						<p className="text-sm text-muted-foreground line-clamp-3">
							{personnel.professionalSummary}
						</p>
					</div>
				)}

				{/* Skills Section */}
				{showSkills && sortedSkills.length > 0 && (
					<div className="mb-4">
						<div className="flex items-center justify-between mb-2">
							<h4 className="text-sm font-medium flex items-center gap-1">
								<Award className="h-4 w-4" />
								Skills ({sortedSkills.length})
							</h4>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setExpanded(!expanded)}
								className="h-6 px-2 text-xs"
							>
								{expanded ? (
									<><ChevronUp className="h-3 w-3 mr-1" /> Less</>
								) : (
									<><ChevronDown className="h-3 w-3 mr-1" /> More</>
								)}
							</Button>
						</div>
						<div className="flex flex-wrap gap-1">
							{(expanded ? sortedSkills : sortedSkills.slice(0, 8)).map((skill, idx) => (
								<SkillBadge
									key={idx}
									skill={skill}
									highlighted={highlightSkills.includes(skill.skillId || skill.skillName)}
								/>
							))}
							{!expanded && sortedSkills.length > 8 && (
								<Badge variant="outline" className="text-xs">
									+{sortedSkills.length - 8} more
								</Badge>
							)}
						</div>
					</div>
				)}

				{/* Certifications Section */}
				{showCertifications && certifications.length > 0 && (
					<div className="mb-4">
						<h4 className="text-sm font-medium flex items-center gap-1 mb-2">
							<Award className="h-4 w-4" />
							Certifications ({certifications.length})
						</h4>
						<div className="grid grid-cols-2 gap-2">
							{certifications.slice(0, expanded ? undefined : 4).map((cert, idx) => (
								<CertificationBadge key={idx} cert={cert} />
							))}
						</div>
						{!expanded && certifications.length > 4 && (
							<p className="text-xs text-muted-foreground mt-1">
								+{certifications.length - 4} more certifications
							</p>
						)}
					</div>
				)}

				{/* Education Section */}
				{education.length > 0 && (
					<div>
						<h4 className="text-sm font-medium flex items-center gap-1 mb-2">
							<GraduationCap className="h-4 w-4" />
							Education
						</h4>
						<div className="space-y-1">
							{education.slice(0, expanded ? undefined : 2).map((edu, idx) => (
								<div key={idx} className="text-sm">
									<span className="font-medium">{edu.degree}</span>
									{edu.field && <span> in {edu.field}</span>}
									<span className="text-muted-foreground">
										{" — "}{edu.institution}
										{edu.year && ` (${edu.year})`}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default PersonnelCard;
