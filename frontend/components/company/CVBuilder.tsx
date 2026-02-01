/**
 * CV Builder Component - DocFusion
 *
 * Wrapper component that integrates the Personnel module into the
 * Company Profile section. Uses the comprehensive personnel management
 * system for creating and editing team member CVs/resumes.
 *
 * NOTE: This is now a bridge to the Personnel module which provides
 * richer functionality including:
 * - Skills taxonomy with proficiency levels
 * - Certifications with expiration tracking
 * - Security clearance management
 * - Rich media proof-of-work (GitHub, YouTube, articles)
 * - Position matching and gap analysis
 * - Federal resume format support
 */

"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	FileText,
	Users,
	Award,
	AlertTriangle,
	Plus,
	Loader2,
	Upload,
} from "lucide-react";
import {
	PersonnelDatabase,
	PersonnelEditor,
	ResumeParser,
	ResumeGenerator,
	CertificationTracker,
} from "@/components/personnel";
import {
	searchPersonnel,
	createPersonnel,
	updatePersonnel,
	deletePersonnel,
	type PersonnelAPI,
} from "@/lib/actions/personnel";
import type { NewPersonnel } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

type ViewMode = "database" | "editor" | "parser" | "generator";

// ============================================================================
// Main Component
// ============================================================================

export function CVBuilder() {
	const [personnel, setPersonnel] = useState<PersonnelAPI[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<string>("team");
	const [viewMode, setViewMode] = useState<ViewMode>("database");
	const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelAPI | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Load personnel on mount
	useEffect(() => {
		loadPersonnel();
	}, []);

	const loadPersonnel = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const result = await searchPersonnel("");
			if (result.success && result.data) {
				setPersonnel(result.data);
			} else {
				setError(result.error || "Failed to load team members.");
			}
		} catch (err) {
			console.error("Failed to load personnel:", err);
			setError("Failed to load team members. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateNew = () => {
		setSelectedPersonnel(null);
		setViewMode("editor");
	};

	const handleEdit = (id: string) => {
		const person = personnel.find(p => p.id === id);
		if (person) {
			setSelectedPersonnel(person);
			setViewMode("editor");
		}
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handleSave = async (data: any) => {
		try {
			if (selectedPersonnel) {
				await updatePersonnel(selectedPersonnel.id, data);
			} else {
				await createPersonnel(data);
			}
			await loadPersonnel();
			setViewMode("database");
			setSelectedPersonnel(null);
		} catch (err) {
			console.error("Failed to save personnel:", err);
			throw err;
		}
	};

	const handleDelete = async (ids: string[]) => {
		try {
			await Promise.all(ids.map(id => deletePersonnel(id)));
			await loadPersonnel();
		} catch (err) {
			console.error("Failed to delete personnel:", err);
		}
	};

	const handleViewResume = (id: string) => {
		const person = personnel.find(p => p.id === id);
		if (person) {
			setSelectedPersonnel(person);
			setViewMode("generator");
		}
	};

	const handleGenerateResume = (id: string) => {
		const person = personnel.find(p => p.id === id);
		if (person) {
			setSelectedPersonnel(person);
			setViewMode("generator");
		}
	};

	const handleImport = () => {
		setViewMode("parser");
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handleParsedResume = async (data: any) => {
		// Create new personnel from parsed data
		try {
			await createPersonnel(data);
			await loadPersonnel();
			setViewMode("database");
		} catch (err) {
			console.error("Failed to create personnel from parsed resume:", err);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="py-12">
					<div className="text-center">
						<AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
						<h3 className="text-lg font-medium mb-2">Error Loading Data</h3>
						<p className="text-muted-foreground mb-4">{error}</p>
						<Button onClick={loadPersonnel}>Try Again</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Render based on view mode
	if (viewMode === "editor") {
		return (
			<PersonnelEditor
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				personnel={selectedPersonnel as any}
				onSave={handleSave}
				onCancel={() => {
					setViewMode("database");
					setSelectedPersonnel(null);
				}}
			/>
		);
	}

	if (viewMode === "parser") {
		return (
			<ResumeParser
				onParsed={handleParsedResume}
				onCancel={() => setViewMode("database")}
			/>
		);
	}

	if (viewMode === "generator" && selectedPersonnel) {
		return (
			<div className="space-y-4">
				<Button
					variant="outline"
					onClick={() => {
						setViewMode("database");
						setSelectedPersonnel(null);
					}}
				>
					← Back to Team
				</Button>
				{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
				<ResumeGenerator personnel={selectedPersonnel as any} />
			</div>
		);
	}

	// Main database view with tabs
	return (
		<div className="space-y-6">
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="team" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Team CVs ({personnel.length})
					</TabsTrigger>
					<TabsTrigger value="certifications" className="flex items-center gap-2">
						<Award className="h-4 w-4" />
						Certifications
					</TabsTrigger>
				</TabsList>

				<TabsContent value="team" className="mt-6">
					{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
					<PersonnelDatabase
						personnel={personnel as any}
						onCreateNew={handleCreateNew}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onImport={handleImport}
						onViewResume={handleViewResume}
						onGenerateResume={handleGenerateResume}
					/>
				</TabsContent>

				<TabsContent value="certifications" className="mt-6">
					{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
					<CertificationTracker personnel={personnel as any} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

export default CVBuilder;
