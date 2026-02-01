/**
 * Personnel Server Actions
 *
 * Server-side actions for managing personnel records, resumes,
 * skills matching, and position assignments.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

interface PersonnelFilters {
	search?: string;
	department?: string;
	employmentType?: string;
	clearanceLevel?: string;
	availability?: string;
	skills?: string[];
	minExperience?: number;
	hasCertification?: string;
}

interface PersonnelMatch {
	personnelId: string;
	personnelName: string;
	matchScore: number;
	matchDetails: {
		skillsMatch: number;
		experienceMatch: number;
		educationMatch: number;
		clearanceMatch: number;
		certificationMatch: number;
		availabilityMatch: number;
		gaps: string[];
	};
	availability: string;
}

interface GapAnalysis {
	opportunityId: string;
	totalPositions: number;
	filledPositions: number;
	openPositions: number;
	gaps: {
		positionId: string;
		positionTitle: string;
		missingRequirements: string[];
		suggestedActions: string[];
		urgency: "critical" | "high" | "medium" | "low";
	}[];
	recommendations: string[];
}

interface ParsedResume {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	currentTitle?: string;
	professionalSummary?: string;
	education: Array<{
		degree: string;
		field: string;
		institution: string;
		year: number;
	}>;
	experience: Array<{
		title: string;
		company: string;
		startDate: string;
		endDate?: string;
		description: string;
		accomplishments: string[];
	}>;
	skills: Array<{
		skillName: string;
		proficiency: string;
		yearsExperience?: number;
	}>;
	certifications: Array<{
		name: string;
		issuer: string;
		dateObtained?: string;
	}>;
	clearance?: {
		level: string;
		status: string;
	};
}

interface DateRange {
	start: Date;
	end: Date;
}

interface OrgChartData {
	nodes: Array<{
		id: string;
		personnelId?: string;
		name: string;
		title: string;
		level: number;
		parentId?: string;
	}>;
	edges: Array<{
		from: string;
		to: string;
	}>;
}

interface StaffingMatrix {
	positions: Array<{
		id: string;
		title: string;
		laborCategory: string;
		headcount: number;
		assigned: Array<{
			personnelId: string;
			name: string;
			matchScore: number;
		}>;
		status: string;
	}>;
	summary: {
		totalPositions: number;
		totalHeadcount: number;
		assignedCount: number;
		openCount: number;
		fillRate: number;
	};
}

// ============================================================================
// Validation Schemas
// ============================================================================

const PersonnelSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	email: z.string().email().optional().nullable(),
	phone: z.string().optional().nullable(),
	employmentType: z.string().optional().nullable(),
	startDate: z.string().optional().nullable(),
	department: z.string().optional().nullable(),
	currentTitle: z.string().optional().nullable(),
	clearanceLevel: z.string().optional().nullable(),
	clearanceStatus: z.string().optional().nullable(),
	availability: z.string().optional().nullable(),
});

const PositionSchema = z.object({
	opportunityId: z.string().uuid().optional(),
	positionTitle: z.string().min(1, "Position title is required"),
	positionCategory: z.string().optional().nullable(),
	laborCategory: z.string().optional().nullable(),
	headcount: z.number().int().positive().default(1),
	requiredExperience: z.number().int().optional().nullable(),
	requiredClearance: z.string().optional().nullable(),
	requiredEducation: z.string().optional().nullable(),
});

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new personnel record
 */
export async function createPersonnel(
	data: z.infer<typeof PersonnelSchema>
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
	try {
		const validated = PersonnelSchema.parse(data);

		// In production, insert into database
		const newPersonnel = {
			id: crypto.randomUUID(),
			...validated,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		revalidatePath("/personnel");

		return { success: true, data: { id: newPersonnel.id } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		return { success: false, error: "Failed to create personnel record" };
	}
}

/**
 * Update an existing personnel record
 */
export async function updatePersonnel(
	id: string,
	data: Partial<z.infer<typeof PersonnelSchema>>
): Promise<{ success: boolean; error?: string }> {
	try {
		// Validate partial data
		const validated = PersonnelSchema.partial().parse(data);

		// In production, update database
		console.log("Updating personnel:", id, validated);

		revalidatePath("/personnel");
		revalidatePath(`/personnel/${id}`);

		return { success: true };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		return { success: false, error: "Failed to update personnel record" };
	}
}

/**
 * Delete a personnel record
 */
export async function deletePersonnel(
	id: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// In production, soft delete from database
		console.log("Deleting personnel:", id);

		revalidatePath("/personnel");

		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to delete personnel record" };
	}
}

/**
 * Get a single personnel record with full details
 */
export async function getPersonnel(
	id: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		// In production, fetch from database with relations
		const personnel = {
			id,
			firstName: "John",
			lastName: "Smith",
			email: "john.smith@example.com",
			currentTitle: "Senior Software Engineer",
			department: "Engineering",
			employmentType: "employee",
			clearanceLevel: "Secret",
			clearanceStatus: "active",
			availability: "available",
			yearsOfExperience: 15,
			skills: [
				{ skillName: "JavaScript", proficiency: "expert", yearsExperience: 10 },
				{ skillName: "Python", proficiency: "advanced", yearsExperience: 8 },
				{ skillName: "Cloud Architecture", proficiency: "advanced", yearsExperience: 5 },
			],
			experience: [],
			education: [
				{
					degree: "Master of Science",
					field: "Computer Science",
					institution: "MIT",
					year: 2012,
				},
			],
			certifications: [
				{
					name: "AWS Solutions Architect",
					issuer: "Amazon Web Services",
					dateObtained: "2022-03-15",
					status: "active",
				},
			],
		};

		return { success: true, data: personnel };
	} catch (error) {
		return { success: false, error: "Failed to fetch personnel record" };
	}
}

/**
 * Search personnel with filters
 */
export async function searchPersonnel(
	query: string,
	filters?: PersonnelFilters
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
	try {
		// In production, search database with filters
		console.log("Searching personnel:", query, filters);

		// Mock results
		const results = [
			{
				id: "1",
				firstName: "John",
				lastName: "Smith",
				currentTitle: "Senior Software Engineer",
				clearanceLevel: "Secret",
				availability: "available",
				matchScore: 95,
			},
			{
				id: "2",
				firstName: "Jane",
				lastName: "Doe",
				currentTitle: "Project Manager",
				clearanceLevel: "Top Secret",
				availability: "partial",
				matchScore: 88,
			},
		];

		return { success: true, data: results };
	} catch (error) {
		return { success: false, error: "Failed to search personnel" };
	}
}

// ============================================================================
// Resume Operations
// ============================================================================

/**
 * Parse a resume file using AI
 */
export async function parseResume(
	fileContent: string,
	fileName: string
): Promise<{ success: boolean; data?: ParsedResume; error?: string }> {
	try {
		// In production, use AI to parse resume
		console.log("Parsing resume:", fileName);

		// Mock parsed result
		const parsed: ParsedResume = {
			firstName: "John",
			lastName: "Doe",
			email: "john.doe@email.com",
			phone: "(555) 123-4567",
			currentTitle: "Senior Software Engineer",
			professionalSummary:
				"Experienced software engineer with 15+ years in government contracting...",
			education: [
				{
					degree: "Master of Science",
					field: "Computer Science",
					institution: "Stanford University",
					year: 2010,
				},
			],
			experience: [
				{
					title: "Senior Software Engineer",
					company: "Tech Solutions Inc.",
					startDate: "2018-01",
					description: "Led development of enterprise applications...",
					accomplishments: [
						"Reduced system latency by 40%",
						"Led team of 8 developers",
					],
				},
			],
			skills: [
				{ skillName: "Java", proficiency: "expert", yearsExperience: 12 },
				{ skillName: "Python", proficiency: "advanced", yearsExperience: 8 },
			],
			certifications: [
				{
					name: "PMP",
					issuer: "PMI",
					dateObtained: "2019-06",
				},
			],
			clearance: {
				level: "Secret",
				status: "active",
			},
		};

		return { success: true, data: parsed };
	} catch (error) {
		return { success: false, error: "Failed to parse resume" };
	}
}

/**
 * Bulk import resumes
 */
export async function bulkImportResumes(
	files: Array<{ content: string; fileName: string }>
): Promise<{ success: boolean; imported: number; errors: number; details?: string[] }> {
	try {
		const results = {
			imported: 0,
			errors: 0,
			details: [] as string[],
		};

		for (const file of files) {
			try {
				const parseResult = await parseResume(file.content, file.fileName);
				if (parseResult.success && parseResult.data) {
					// Create personnel record
					await createPersonnel({
						firstName: parseResult.data.firstName,
						lastName: parseResult.data.lastName,
						email: parseResult.data.email,
						phone: parseResult.data.phone,
						currentTitle: parseResult.data.currentTitle,
						clearanceLevel: parseResult.data.clearance?.level,
						clearanceStatus: parseResult.data.clearance?.status,
					});
					results.imported++;
					results.details.push(`Imported: ${file.fileName}`);
				} else {
					results.errors++;
					results.details.push(`Failed: ${file.fileName} - ${parseResult.error}`);
				}
			} catch {
				results.errors++;
				results.details.push(`Failed: ${file.fileName}`);
			}
		}

		revalidatePath("/personnel");

		return { success: true, ...results };
	} catch (error) {
		return { success: false, imported: 0, errors: files.length };
	}
}

/**
 * Generate a formatted resume for a personnel
 */
export async function generateResume(
	personnelId: string,
	format: "federal" | "commercial" | "brief" | "technical"
): Promise<{ success: boolean; data?: string; error?: string }> {
	try {
		// In production, use AI to generate formatted resume
		console.log("Generating resume:", personnelId, format);

		// Mock generated content
		const templates = {
			federal: "FEDERAL RESUME FORMAT\n\nName: John Smith\nTitle: Senior Software Engineer...",
			commercial: "JOHN SMITH\nSenior Software Engineer\n\nPROFESSIONAL SUMMARY...",
			brief: "John Smith - Senior Software Engineer with 15+ years experience...",
			technical: "JOHN SMITH\nTechnical Resume\n\nCORE COMPETENCIES...",
		};

		return { success: true, data: templates[format] };
	} catch (error) {
		return { success: false, error: "Failed to generate resume" };
	}
}

// ============================================================================
// Position Matching
// ============================================================================

/**
 * Match personnel to a position requirement
 */
export async function matchPersonnelToPosition(
	positionId: string
): Promise<{ success: boolean; data?: PersonnelMatch[]; error?: string }> {
	try {
		// In production, run matching algorithm against all personnel
		console.log("Matching personnel to position:", positionId);

		// Mock matches
		const matches: PersonnelMatch[] = [
			{
				personnelId: "1",
				personnelName: "John Smith",
				matchScore: 92,
				matchDetails: {
					skillsMatch: 95,
					experienceMatch: 90,
					educationMatch: 100,
					clearanceMatch: 100,
					certificationMatch: 80,
					availabilityMatch: 90,
					gaps: ["Missing PMP certification"],
				},
				availability: "available",
			},
			{
				personnelId: "2",
				personnelName: "Jane Doe",
				matchScore: 85,
				matchDetails: {
					skillsMatch: 88,
					experienceMatch: 85,
					educationMatch: 90,
					clearanceMatch: 100,
					certificationMatch: 70,
					availabilityMatch: 80,
					gaps: ["Below required years of experience"],
				},
				availability: "partial",
			},
		];

		return { success: true, data: matches };
	} catch (error) {
		return { success: false, error: "Failed to match personnel" };
	}
}

/**
 * Analyze staffing gaps for an opportunity
 */
export async function analyzeGaps(
	opportunityId: string
): Promise<{ success: boolean; data?: GapAnalysis; error?: string }> {
	try {
		// In production, analyze all positions and current assignments
		console.log("Analyzing gaps for opportunity:", opportunityId);

		const analysis: GapAnalysis = {
			opportunityId,
			totalPositions: 10,
			filledPositions: 6,
			openPositions: 4,
			gaps: [
				{
					positionId: "pos-1",
					positionTitle: "Lead Systems Architect",
					missingRequirements: ["TS/SCI Clearance", "DoD Cloud Experience"],
					suggestedActions: [
						"Partner with cleared subcontractor",
						"Initiate clearance upgrade for John Smith",
					],
					urgency: "critical",
				},
				{
					positionId: "pos-2",
					positionTitle: "Senior Data Scientist",
					missingRequirements: ["PhD in relevant field"],
					suggestedActions: ["Recruit external candidate", "Consider internal training"],
					urgency: "high",
				},
			],
			recommendations: [
				"Consider teaming arrangement for TS/SCI positions",
				"Prioritize clearance processing for key personnel",
				"Engage recruiting for specialized skills",
			],
		};

		return { success: true, data: analysis };
	} catch (error) {
		return { success: false, error: "Failed to analyze gaps" };
	}
}

/**
 * Assign personnel to a position
 */
export async function assignToPosition(
	personnelId: string,
	positionId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// In production, update position assignment
		console.log("Assigning personnel to position:", personnelId, positionId);

		revalidatePath("/staffing");
		revalidatePath(`/positions/${positionId}`);
		revalidatePath(`/personnel/${personnelId}`);

		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to assign personnel" };
	}
}

/**
 * Unassign personnel from a position
 */
export async function unassignFromPosition(
	positionId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// In production, clear position assignment
		console.log("Unassigning personnel from position:", positionId);

		revalidatePath("/staffing");
		revalidatePath(`/positions/${positionId}`);

		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to unassign personnel" };
	}
}

// ============================================================================
// Availability & Scheduling
// ============================================================================

/**
 * Check availability for multiple personnel over a date range
 */
export async function checkAvailability(
	personnelIds: string[],
	dates: DateRange
): Promise<{
	success: boolean;
	data?: Record<string, { available: boolean; commitment: number; conflicts: string[] }>;
	error?: string;
}> {
	try {
		// In production, check availability table
		console.log("Checking availability:", personnelIds, dates);

		const availability: Record<string, { available: boolean; commitment: number; conflicts: string[] }> = {};

		for (const id of personnelIds) {
			availability[id] = {
				available: Math.random() > 0.3,
				commitment: Math.floor(Math.random() * 100),
				conflicts: Math.random() > 0.5 ? ["Project Alpha"] : [],
			};
		}

		return { success: true, data: availability };
	} catch (error) {
		return { success: false, error: "Failed to check availability" };
	}
}

/**
 * Update personnel availability
 */
export async function updateAvailability(
	personnelId: string,
	availability: {
		startDate: string;
		endDate: string;
		commitment: number;
		opportunityId?: string;
		opportunityName?: string;
		status: string;
	}
): Promise<{ success: boolean; error?: string }> {
	try {
		// In production, insert/update availability record
		console.log("Updating availability:", personnelId, availability);

		revalidatePath(`/personnel/${personnelId}`);
		revalidatePath("/staffing");

		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to update availability" };
	}
}

// ============================================================================
// Certification Tracking
// ============================================================================

/**
 * Get certifications expiring soon
 */
export async function getExpiringCertifications(
	daysAhead: number = 90
): Promise<{
	success: boolean;
	data?: Array<{
		personnelId: string;
		personnelName: string;
		certification: string;
		expirationDate: string;
		daysUntilExpiration: number;
	}>;
	error?: string;
}> {
	try {
		// In production, query certifications table
		console.log("Getting expiring certifications within", daysAhead, "days");

		const expiring = [
			{
				personnelId: "1",
				personnelName: "John Smith",
				certification: "PMP",
				expirationDate: "2024-03-15",
				daysUntilExpiration: 45,
			},
			{
				personnelId: "2",
				personnelName: "Jane Doe",
				certification: "AWS Solutions Architect",
				expirationDate: "2024-04-01",
				daysUntilExpiration: 62,
			},
		];

		return { success: true, data: expiring };
	} catch (error) {
		return { success: false, error: "Failed to get expiring certifications" };
	}
}

/**
 * Send certification renewal reminders
 */
export async function sendCertificationReminders(
	personnelIds: string[]
): Promise<{ success: boolean; sent: number; error?: string }> {
	try {
		// In production, send email notifications
		console.log("Sending certification reminders to:", personnelIds);

		return { success: true, sent: personnelIds.length };
	} catch (error) {
		return { success: false, sent: 0, error: "Failed to send reminders" };
	}
}

// ============================================================================
// Org Chart & Staffing Matrix
// ============================================================================

/**
 * Generate org chart data for an opportunity
 */
export async function generateOrgChart(
	opportunityId: string
): Promise<{ success: boolean; data?: OrgChartData; error?: string }> {
	try {
		// In production, build org chart from positions and assignments
		console.log("Generating org chart for:", opportunityId);

		const orgChart: OrgChartData = {
			nodes: [
				{ id: "pm", name: "John Smith", title: "Program Manager", level: 0 },
				{ id: "tl1", name: "Jane Doe", title: "Technical Lead", level: 1, parentId: "pm" },
				{ id: "tl2", name: "Bob Wilson", title: "Development Lead", level: 1, parentId: "pm" },
				{ id: "dev1", name: "Alice Brown", title: "Senior Developer", level: 2, parentId: "tl2" },
				{ id: "dev2", name: "Charlie Davis", title: "Developer", level: 2, parentId: "tl2" },
			],
			edges: [
				{ from: "pm", to: "tl1" },
				{ from: "pm", to: "tl2" },
				{ from: "tl2", to: "dev1" },
				{ from: "tl2", to: "dev2" },
			],
		};

		return { success: true, data: orgChart };
	} catch (error) {
		return { success: false, error: "Failed to generate org chart" };
	}
}

/**
 * Generate staffing matrix for an opportunity
 */
export async function generateStaffingMatrix(
	opportunityId: string
): Promise<{ success: boolean; data?: StaffingMatrix; error?: string }> {
	try {
		// In production, compile staffing matrix from positions
		console.log("Generating staffing matrix for:", opportunityId);

		const matrix: StaffingMatrix = {
			positions: [
				{
					id: "pos-1",
					title: "Program Manager",
					laborCategory: "Senior Manager",
					headcount: 1,
					assigned: [{ personnelId: "1", name: "John Smith", matchScore: 95 }],
					status: "assigned",
				},
				{
					id: "pos-2",
					title: "Senior Software Engineer",
					laborCategory: "Technical Staff III",
					headcount: 3,
					assigned: [
						{ personnelId: "2", name: "Jane Doe", matchScore: 90 },
						{ personnelId: "3", name: "Bob Wilson", matchScore: 88 },
					],
					status: "partial",
				},
				{
					id: "pos-3",
					title: "Data Scientist",
					laborCategory: "Technical Staff II",
					headcount: 2,
					assigned: [],
					status: "open",
				},
			],
			summary: {
				totalPositions: 3,
				totalHeadcount: 6,
				assignedCount: 3,
				openCount: 3,
				fillRate: 50,
			},
		};

		return { success: true, data: matrix };
	} catch (error) {
		return { success: false, error: "Failed to generate staffing matrix" };
	}
}

// ============================================================================
// Skills Taxonomy
// ============================================================================

/**
 * Search skills taxonomy
 */
export async function searchSkills(
	query: string,
	category?: string
): Promise<{ success: boolean; data?: Array<{ id: string; name: string; category: string }>; error?: string }> {
	try {
		// In production, search skills table
		console.log("Searching skills:", query, category);

		const skills = [
			{ id: "1", name: "JavaScript", category: "technical" },
			{ id: "2", name: "Python", category: "technical" },
			{ id: "3", name: "Project Management", category: "management" },
			{ id: "4", name: "AWS", category: "technical" },
		].filter(
			(s) =>
				s.name.toLowerCase().includes(query.toLowerCase()) &&
				(!category || s.category === category)
		);

		return { success: true, data: skills };
	} catch (error) {
		return { success: false, error: "Failed to search skills" };
	}
}

/**
 * Get skill suggestions based on job title
 */
export async function suggestSkillsForTitle(
	title: string
): Promise<{ success: boolean; data?: string[]; error?: string }> {
	try {
		// In production, use AI or lookup table
		console.log("Suggesting skills for title:", title);

		const suggestions = ["JavaScript", "Python", "AWS", "Agile", "Team Leadership"];

		return { success: true, data: suggestions };
	} catch (error) {
		return { success: false, error: "Failed to suggest skills" };
	}
}

// ============================================================================
// Position Requirements
// ============================================================================

/**
 * Create a position requirement
 */
export async function createPosition(
	data: z.infer<typeof PositionSchema>
): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
	try {
		const validated = PositionSchema.parse(data);

		const newPosition = {
			id: crypto.randomUUID(),
			...validated,
			assignmentStatus: "open",
			createdAt: new Date(),
		};

		revalidatePath("/staffing");

		return { success: true, data: { id: newPosition.id } };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		return { success: false, error: "Failed to create position" };
	}
}

/**
 * Get positions for an opportunity
 */
export async function getPositionsForOpportunity(
	opportunityId: string
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
	try {
		// In production, query positions table
		console.log("Getting positions for opportunity:", opportunityId);

		const positions = [
			{
				id: "pos-1",
				positionTitle: "Program Manager",
				laborCategory: "Senior Manager",
				headcount: 1,
				requiredClearance: "Top Secret",
				assignmentStatus: "assigned",
				assignedPersonnel: { id: "1", name: "John Smith" },
			},
			{
				id: "pos-2",
				positionTitle: "Senior Software Engineer",
				laborCategory: "Technical Staff III",
				headcount: 3,
				requiredClearance: "Secret",
				assignmentStatus: "partial",
				assignedCount: 2,
			},
		];

		return { success: true, data: positions };
	} catch (error) {
		return { success: false, error: "Failed to get positions" };
	}
}

/**
 * Update position requirement
 */
export async function updatePosition(
	id: string,
	data: Partial<z.infer<typeof PositionSchema>>
): Promise<{ success: boolean; error?: string }> {
	try {
		const validated = PositionSchema.partial().parse(data);
		console.log("Updating position:", id, validated);

		revalidatePath("/staffing");
		revalidatePath(`/positions/${id}`);

		return { success: true };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, error: `Validation error: ${error.issues[0].message}` };
		}
		return { success: false, error: "Failed to update position" };
	}
}

/**
 * Delete position requirement
 */
export async function deletePosition(
	id: string
): Promise<{ success: boolean; error?: string }> {
	try {
		console.log("Deleting position:", id);

		revalidatePath("/staffing");

		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to delete position" };
	}
}
