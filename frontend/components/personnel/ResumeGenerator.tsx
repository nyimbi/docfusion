"use client";

/**
 * ResumeGenerator Component
 *
 * Generates formatted resumes in various formats (Federal, Commercial, Brief).
 * Supports template selection, section customization, and export to multiple
 * formats (PDF, DOCX, LaTeX).
 */

import { useState, useMemo } from "react";
import {
	FileText,
	Download,
	Eye,
	Settings,
	RefreshCw,
	CheckCircle,
	Loader2,
	ChevronDown,
	ChevronUp,
	GripVertical,
	Plus,
	Minus,
	Copy,
	FileType,
	Printer,
	Target,
	Wand2,
	AlertCircle,
	Brain,
	Lightbulb,
	TrendingUp,
	ArrowRight,
	Zap,
	Shield,
	XCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Personnel, ResumeTemplate } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface ResumeGeneratorProps {
	personnel: Personnel;
	templates?: ResumeTemplate[];
	onGenerate?: (format: string, options: GenerateOptions) => Promise<Blob>;
	onSave?: (resumeType: string, content: string) => Promise<void>;
	className?: string;
}

interface GenerateOptions {
	templateId?: string;
	format: "federal" | "commercial" | "brief" | "technical";
	exportFormat: "pdf" | "docx" | "latex" | "html";
	sections: SectionConfig[];
	maxPages?: number;
	includePhoto?: boolean;
	tailorTo?: string; // Opportunity ID for tailoring
	jobDescription?: string; // For keyword tailoring
	extractedKeywords?: string[];
}

interface SectionConfig {
	key: string;
	label: string;
	enabled: boolean;
	order: number;
	maxItems?: number;
	customContent?: string;
}

interface KeywordMatch {
	keyword: string;
	found: boolean;
	inSkills: boolean;
	inExperience: boolean;
	inCertifications: boolean;
	inEducation: boolean;
}

// ============================================================================
// Semantic Matching Types
// ============================================================================

interface SemanticMatch {
	requirement: string;
	matchType: "exact" | "synonym" | "concept" | "capability" | "inferred";
	confidence: number; // 0-100
	matchedTerms: string[];
	source: "skills" | "experience" | "certifications" | "education" | "summary";
	explanation: string;
}

interface CapabilityMapping {
	capability: string;
	category: string;
	evidence: string[];
	strength: "strong" | "moderate" | "implied";
}

interface ConceptMatch {
	concept: string;
	relatedTerms: string[];
	foundTerms: string[];
	score: number;
}

// ============================================================================
// Skills Taxonomy & Semantic Mappings
// ============================================================================

/**
 * Hierarchical skills taxonomy for semantic matching.
 * Maps specific skills to broader concepts and related terms.
 */
const SKILLS_TAXONOMY: Record<string, {
	category: string;
	concepts: string[];
	synonyms: string[];
	impliedSkills: string[];
}> = {
	// Cloud & Infrastructure
	"aws": {
		category: "cloud",
		concepts: ["cloud computing", "infrastructure", "devops", "cloud architecture"],
		synonyms: ["amazon web services", "amazon cloud"],
		impliedSkills: ["cloud architecture", "infrastructure as code", "scalability"],
	},
	"azure": {
		category: "cloud",
		concepts: ["cloud computing", "infrastructure", "microsoft ecosystem"],
		synonyms: ["microsoft azure", "azure cloud"],
		impliedSkills: ["cloud architecture", "enterprise integration"],
	},
	"gcp": {
		category: "cloud",
		concepts: ["cloud computing", "infrastructure", "google ecosystem"],
		synonyms: ["google cloud platform", "google cloud"],
		impliedSkills: ["cloud architecture", "data analytics"],
	},
	"kubernetes": {
		category: "devops",
		concepts: ["container orchestration", "microservices", "cloud native"],
		synonyms: ["k8s", "kube"],
		impliedSkills: ["docker", "container management", "devops"],
	},
	"docker": {
		category: "devops",
		concepts: ["containerization", "devops", "microservices"],
		synonyms: ["containers", "docker containers"],
		impliedSkills: ["linux", "deployment", "infrastructure"],
	},
	"terraform": {
		category: "devops",
		concepts: ["infrastructure as code", "iac", "automation"],
		synonyms: ["tf", "hashicorp terraform"],
		impliedSkills: ["cloud architecture", "automation", "devops"],
	},

	// Programming Languages
	"python": {
		category: "programming",
		concepts: ["backend development", "data science", "automation", "scripting"],
		synonyms: ["py", "python3"],
		impliedSkills: ["software development", "scripting", "automation"],
	},
	"javascript": {
		category: "programming",
		concepts: ["web development", "frontend", "full stack"],
		synonyms: ["js", "ecmascript", "es6"],
		impliedSkills: ["web development", "frontend development"],
	},
	"typescript": {
		category: "programming",
		concepts: ["web development", "type safety", "enterprise development"],
		synonyms: ["ts"],
		impliedSkills: ["javascript", "software architecture", "type systems"],
	},
	"java": {
		category: "programming",
		concepts: ["enterprise development", "backend", "jvm"],
		synonyms: ["java se", "java ee"],
		impliedSkills: ["object oriented programming", "enterprise architecture"],
	},
	"react": {
		category: "frontend",
		concepts: ["frontend development", "spa", "component architecture", "ui development"],
		synonyms: ["reactjs", "react.js"],
		impliedSkills: ["javascript", "typescript", "frontend architecture", "state management"],
	},
	"node": {
		category: "backend",
		concepts: ["backend development", "server-side javascript", "api development"],
		synonyms: ["nodejs", "node.js"],
		impliedSkills: ["javascript", "api design", "asynchronous programming"],
	},

	// Data & AI
	"machine learning": {
		category: "ai",
		concepts: ["artificial intelligence", "data science", "predictive analytics"],
		synonyms: ["ml", "machine-learning"],
		impliedSkills: ["python", "statistics", "data analysis"],
	},
	"sql": {
		category: "data",
		concepts: ["database", "data management", "data analysis"],
		synonyms: ["structured query language"],
		impliedSkills: ["database design", "data modeling", "reporting"],
	},
	"postgresql": {
		category: "data",
		concepts: ["relational database", "sql", "data storage"],
		synonyms: ["postgres", "pg"],
		impliedSkills: ["sql", "database administration", "data modeling"],
	},

	// Security & Compliance
	"security": {
		category: "security",
		concepts: ["cybersecurity", "information security", "risk management"],
		synonyms: ["infosec", "information security"],
		impliedSkills: ["risk assessment", "compliance", "vulnerability management"],
	},
	"nist": {
		category: "compliance",
		concepts: ["security framework", "compliance", "government security"],
		synonyms: ["nist 800-53", "nist framework", "nist cybersecurity framework"],
		impliedSkills: ["security compliance", "risk management", "documentation"],
	},
	"fisma": {
		category: "compliance",
		concepts: ["federal security", "compliance", "government"],
		synonyms: ["federal information security"],
		impliedSkills: ["nist", "government contracting", "security compliance"],
	},

	// Leadership & Management
	"project management": {
		category: "management",
		concepts: ["leadership", "planning", "coordination", "delivery"],
		synonyms: ["pm", "project mgmt"],
		impliedSkills: ["stakeholder management", "scheduling", "risk management"],
	},
	"agile": {
		category: "methodology",
		concepts: ["software development", "iterative development", "team collaboration"],
		synonyms: ["agile methodology", "agile framework"],
		impliedSkills: ["scrum", "kanban", "sprint planning", "continuous improvement"],
	},
	"scrum": {
		category: "methodology",
		concepts: ["agile", "iterative development", "team coordination"],
		synonyms: ["scrum framework", "scrum master"],
		impliedSkills: ["agile", "sprint planning", "retrospectives"],
	},
};

/**
 * Capability patterns that can be inferred from experience descriptions.
 * These patterns help identify implicit capabilities from written text.
 */
const CAPABILITY_PATTERNS: Array<{
	pattern: RegExp;
	capability: string;
	category: string;
	strength: "strong" | "moderate" | "implied";
}> = [
	// Leadership patterns
	{ pattern: /\b(led|managed|directed|oversaw|supervised)\s+(a\s+)?team\s+(of\s+)?(\d+)/gi, capability: "team leadership", category: "leadership", strength: "strong" },
	{ pattern: /\b(led|managed|directed)\s+(a\s+)?project/gi, capability: "project leadership", category: "leadership", strength: "strong" },
	{ pattern: /\b(mentored|coached|trained)\s+(\w+\s+)?(developers?|engineers?|staff|team)/gi, capability: "mentorship", category: "leadership", strength: "strong" },
	{ pattern: /\breporting\s+to\s+(c-level|ceo|cto|cfo|cio|vp|director)/gi, capability: "executive communication", category: "leadership", strength: "moderate" },

	// Technical architecture patterns
	{ pattern: /\b(designed|architected|built)\s+(a\s+)?(scalable|distributed|microservices?)/gi, capability: "system architecture", category: "technical", strength: "strong" },
	{ pattern: /\b(implemented|developed|created)\s+(a\s+)?api/gi, capability: "api development", category: "technical", strength: "strong" },
	{ pattern: /\b(migrated|converted|upgraded)\s+(\w+\s+)?to\s+(cloud|aws|azure|gcp)/gi, capability: "cloud migration", category: "technical", strength: "strong" },

	// Problem solving patterns
	{ pattern: /\b(reduced|decreased|improved)\s+(\w+\s+)?(latency|response\s+time|performance)\s+by\s+(\d+)/gi, capability: "performance optimization", category: "problem-solving", strength: "strong" },
	{ pattern: /\b(resolved|fixed|debugged)\s+(\w+\s+)?(critical|production|major)\s+(issues?|bugs?|incidents?)/gi, capability: "troubleshooting", category: "problem-solving", strength: "strong" },
	{ pattern: /\b(saved|reduced\s+costs?\s+by)\s+\$?(\d+)/gi, capability: "cost optimization", category: "business", strength: "strong" },

	// Communication patterns
	{ pattern: /\b(presented|delivered|communicated)\s+to\s+(stakeholders?|executives?|clients?|customers?)/gi, capability: "stakeholder communication", category: "communication", strength: "strong" },
	{ pattern: /\b(wrote|authored|created)\s+(technical\s+)?(documentation|specs?|requirements?)/gi, capability: "technical writing", category: "communication", strength: "moderate" },
	{ pattern: /\b(collaborated|worked)\s+(closely\s+)?with\s+(cross-functional|multiple|diverse)\s+teams?/gi, capability: "cross-functional collaboration", category: "communication", strength: "moderate" },

	// Security & Compliance patterns
	{ pattern: /\b(achieved|obtained|maintained)\s+(security\s+)?(certification|clearance|authorization)/gi, capability: "security compliance", category: "security", strength: "strong" },
	{ pattern: /\b(implemented|established)\s+(security\s+)?(controls?|policies?|procedures?)/gi, capability: "security implementation", category: "security", strength: "strong" },
	{ pattern: /\b(passed|completed)\s+(security\s+)?audit/gi, capability: "audit management", category: "security", strength: "moderate" },

	// Innovation patterns
	{ pattern: /\b(invented|patented|pioneered|introduced)\s+/gi, capability: "innovation", category: "innovation", strength: "strong" },
	{ pattern: /\b(first\s+to|early\s+adopter|cutting[\s-]?edge)/gi, capability: "innovation", category: "innovation", strength: "moderate" },
];

/**
 * Concept mappings for semantic search.
 * Maps high-level job requirements to related technical terms.
 */
const CONCEPT_MAPPINGS: Record<string, string[]> = {
	// Cloud & Infrastructure
	"cloud architecture": ["aws", "azure", "gcp", "kubernetes", "docker", "terraform", "infrastructure as code", "serverless", "lambda", "ec2", "cloudformation", "arm templates", "cloud native", "multi-cloud", "hybrid cloud"],
	"cloud computing": ["aws", "azure", "gcp", "saas", "paas", "iaas", "cloud migration", "cloud security", "cost optimization", "auto-scaling", "load balancing", "cdn", "cloudfront"],
	"infrastructure": ["networking", "servers", "storage", "virtualization", "vmware", "hypervisor", "data center", "disaster recovery", "high availability", "fault tolerance", "redundancy"],

	// Development
	"frontend development": ["react", "vue", "angular", "javascript", "typescript", "html", "css", "ui/ux", "responsive design", "accessibility", "webpack", "vite", "nextjs", "nuxt", "svelte", "tailwind", "sass", "less"],
	"backend development": ["node", "python", "java", "c#", "go", "rust", "api", "rest", "graphql", "microservices", "express", "fastapi", "spring", "django", "flask", "nestjs", "rails"],
	"full stack": ["frontend", "backend", "database", "api", "deployment", "testing", "react", "node", "sql", "mongodb", "redis", "authentication", "authorization"],
	"mobile development": ["ios", "android", "react native", "flutter", "swift", "kotlin", "xamarin", "mobile ui", "app store", "google play", "push notifications", "offline first"],
	"software engineering": ["design patterns", "solid principles", "clean code", "refactoring", "code review", "version control", "git", "testing", "debugging", "performance optimization"],

	// Data & Analytics
	"data engineering": ["sql", "python", "spark", "airflow", "etl", "data pipeline", "data warehouse", "snowflake", "databricks", "kafka", "redshift", "bigquery", "data lake", "data modeling", "dbt"],
	"data science": ["python", "r", "statistics", "machine learning", "data visualization", "jupyter", "pandas", "numpy", "matplotlib", "seaborn", "tableau", "power bi", "hypothesis testing"],
	"business intelligence": ["reporting", "dashboards", "kpis", "metrics", "analytics", "tableau", "power bi", "looker", "data visualization", "sql", "excel"],
	"data analysis": ["sql", "excel", "python", "r", "statistics", "reporting", "visualization", "insights", "trends", "forecasting"],

	// AI & Machine Learning
	"machine learning": ["python", "tensorflow", "pytorch", "scikit-learn", "deep learning", "neural networks", "nlp", "computer vision", "regression", "classification", "clustering", "feature engineering"],
	"artificial intelligence": ["machine learning", "deep learning", "natural language processing", "computer vision", "reinforcement learning", "generative ai", "llm", "chatbot", "ai ethics"],
	"natural language processing": ["nlp", "text mining", "sentiment analysis", "named entity recognition", "language models", "transformers", "bert", "gpt", "tokenization", "embeddings"],

	// DevOps & Platform
	"devops": ["kubernetes", "docker", "terraform", "ansible", "ci/cd", "jenkins", "github actions", "gitlab ci", "monitoring", "prometheus", "grafana", "elk", "splunk", "datadog"],
	"site reliability engineering": ["sre", "monitoring", "alerting", "incident management", "sla", "slo", "sli", "chaos engineering", "postmortem", "runbooks", "on-call"],
	"platform engineering": ["kubernetes", "internal developer platform", "self-service", "golden paths", "developer experience", "gitops", "argocd", "backstage"],

	// Security & Compliance
	"security": ["nist", "fisma", "soc2", "penetration testing", "vulnerability assessment", "encryption", "authentication", "authorization", "oauth", "saml", "zero trust"],
	"cybersecurity": ["threat detection", "incident response", "security operations", "siem", "vulnerability management", "malware analysis", "forensics", "penetration testing", "red team", "blue team"],
	"compliance": ["nist", "fisma", "hipaa", "gdpr", "pci-dss", "sox", "fedramp", "audit", "risk assessment", "controls", "documentation", "policy"],
	"government security": ["clearance", "classified", "scif", "nist 800-53", "rmf", "fisma", "fedramp", "ato", "security controls", "ssp"],

	// Management & Leadership
	"leadership": ["team management", "mentorship", "project management", "stakeholder management", "strategic planning", "budgeting", "decision making", "conflict resolution", "coaching"],
	"project management": ["planning", "scheduling", "budgeting", "resource management", "risk management", "stakeholder communication", "pmp", "prince2", "waterfall", "hybrid"],
	"program management": ["portfolio management", "roadmap", "strategic alignment", "governance", "multi-project coordination", "resource optimization", "executive reporting"],
	"people management": ["hiring", "performance reviews", "career development", "mentoring", "team building", "conflict resolution", "feedback", "1:1s", "succession planning"],

	// Methodologies
	"agile methodologies": ["scrum", "kanban", "sprint", "retrospective", "backlog", "user stories", "continuous improvement", "jira", "velocity", "burndown", "daily standup"],
	"lean": ["continuous improvement", "waste reduction", "value stream", "kaizen", "kanban", "just in time", "efficiency", "process optimization"],
	"six sigma": ["dmaic", "process improvement", "quality control", "statistical analysis", "root cause analysis", "defect reduction", "black belt", "green belt"],

	// Business & Strategy
	"business analysis": ["requirements gathering", "stakeholder analysis", "process mapping", "gap analysis", "business cases", "user stories", "acceptance criteria", "brd", "use cases"],
	"product management": ["roadmap", "backlog", "prioritization", "user research", "market analysis", "competitive analysis", "product strategy", "okrs", "metrics", "a/b testing"],
	"strategy": ["strategic planning", "market analysis", "competitive intelligence", "business development", "partnership", "go-to-market", "growth", "innovation"],

	// Federal & Government
	"federal contracting": ["far", "dfars", "government contracting", "proposal writing", "cost estimation", "contract management", "cdrl", "gsa schedule", "idiq", "bpa"],
	"proposal writing": ["rfp", "rfi", "rfq", "technical writing", "solution design", "pricing", "past performance", "capability statement", "win themes", "orals"],
	"systems engineering": ["requirements analysis", "architecture", "integration", "verification", "validation", "lifecycle", "traceability", "configuration management"],

	// Communication & Collaboration
	"communication": ["presentation", "writing", "stakeholder engagement", "executive briefing", "technical writing", "documentation", "training", "facilitation"],
	"collaboration": ["teamwork", "cross-functional", "remote work", "virtual teams", "knowledge sharing", "pair programming", "mob programming"],
	"customer service": ["customer support", "client relations", "issue resolution", "service level", "satisfaction", "feedback", "escalation", "account management"],

	// Quality & Testing
	"quality assurance": ["testing", "test automation", "qa", "quality control", "test planning", "defect management", "regression testing", "performance testing"],
	"test automation": ["selenium", "cypress", "playwright", "jest", "pytest", "testng", "cucumber", "bdd", "tdd", "ci/cd integration"],
	"performance testing": ["load testing", "stress testing", "jmeter", "gatling", "k6", "performance optimization", "bottleneck analysis", "capacity planning"],
};

// ============================================================================
// AI-Powered Concept Enhancement
// ============================================================================

interface AISemanticAnalysisRequest {
	jobDescription: string;
	personnelProfile: {
		skills: string[];
		summary: string;
		certifications: string[];
		education: string[];
		experience?: string[];
	};
}

interface AISemanticAnalysisResponse {
	extractedRequirements: {
		requirement: string;
		importance: "critical" | "important" | "nice-to-have";
		category: string;
	}[];
	semanticMatches: {
		requirement: string;
		personnelEvidence: string;
		matchType: "direct" | "transferable" | "inferred" | "partial";
		confidence: number;
		explanation: string;
	}[];
	conceptualGaps: {
		requirement: string;
		suggestedAdditions: string[];
		reason: string;
	}[];
	overallFitScore: number;
	strengthSummary: string[];
	improvementAreas: string[];
}

function categorizeRequirement(requirement: string): string {
	const reqLower = requirement.toLowerCase();
	const categoryPatterns: Record<string, string[]> = {
		"Technical": ["programming", "software", "development", "engineering", "code", "api", "database", "cloud", "infrastructure"],
		"Data": ["data", "analytics", "sql", "machine learning", "ai", "statistics", "reporting"],
		"Security": ["security", "compliance", "clearance", "nist", "fisma", "cyber"],
		"Leadership": ["lead", "manage", "team", "stakeholder", "strategic", "mentor"],
		"Communication": ["communication", "presentation", "writing", "documentation", "client"],
		"Methodology": ["agile", "scrum", "waterfall", "devops", "lean", "process"],
	};
	for (const [category, patterns] of Object.entries(categoryPatterns)) {
		if (patterns.some(p => reqLower.includes(p))) return category;
	}
	return "General";
}

function findEvidence(requirement: string, profile: AISemanticAnalysisRequest["personnelProfile"]): string {
	const reqLower = requirement.toLowerCase();
	const matchingSkill = profile.skills.find(s => s.toLowerCase().includes(reqLower) || reqLower.includes(s.toLowerCase()));
	if (matchingSkill) return matchingSkill;
	const matchingCert = profile.certifications.find(c => c.toLowerCase().includes(reqLower));
	if (matchingCert) return matchingCert;
	if (profile.summary.toLowerCase().includes(reqLower)) {
		const summaryWords = profile.summary.split(/[.!?]/);
		const matchingSentence = summaryWords.find(s => s.toLowerCase().includes(reqLower));
		if (matchingSentence) return matchingSentence.trim().slice(0, 100);
	}
	return requirement;
}

function getSuggestedAdditions(requirement: string): string[] {
	const reqLower = requirement.toLowerCase();
	for (const [concept, terms] of Object.entries(CONCEPT_MAPPINGS)) {
		if (reqLower.includes(concept) || terms.some(t => reqLower.includes(t))) {
			return terms.slice(0, 3);
		}
	}
	for (const [skill, taxonomy] of Object.entries(SKILLS_TAXONOMY)) {
		if (reqLower.includes(skill) || taxonomy.synonyms.some(s => reqLower.includes(s))) {
			return [skill, ...taxonomy.impliedSkills.slice(0, 2)];
		}
	}
	return [requirement];
}

async function performAISemanticAnalysis(
	request: AISemanticAnalysisRequest
): Promise<AISemanticAnalysisResponse | null> {
	try {
		const { jobDescription, personnelProfile } = request;
		const allSkills = personnelProfile.skills.join(" ").toLowerCase();
		const allText = [
			personnelProfile.summary,
			...personnelProfile.certifications,
			...personnelProfile.education,
			...(personnelProfile.experience || []),
		].join(" ").toLowerCase();

		const extractedRequirements: AISemanticAnalysisResponse["extractedRequirements"] = [];

		// Extract critical requirements
		const criticalPatterns = [
			/\b(required|must have|essential|mandatory)\s*[:\-]?\s*([^.]{5,80})/gi,
			/\b(minimum|at least)\s+(\d+)\s+years?\s+(of\s+)?(experience\s+)?(in|with)\s+([^.]{5,60})/gi,
		];
		criticalPatterns.forEach(pattern => {
			let match;
			while ((match = pattern.exec(jobDescription)) !== null) {
				const requirement = match[0].replace(/^(required|must have|essential|mandatory)\s*[:\-]?\s*/i, "").trim();
				if (requirement.length > 5 && requirement.length < 100) {
					extractedRequirements.push({ requirement, importance: "critical", category: categorizeRequirement(requirement) });
				}
			}
		});

		// Extract important requirements
		const importantPatterns = [
			/\b(preferred|desired|strong)\s+(experience|knowledge|skills?|background)\s+(in|with)\s+([^.]{5,60})/gi,
			/\b(proficient|proficiency|expertise|expert)\s+(in|with)\s+([^.]{5,60})/gi,
		];
		importantPatterns.forEach(pattern => {
			let match;
			while ((match = pattern.exec(jobDescription)) !== null) {
				extractedRequirements.push({ requirement: match[0].trim(), importance: "important", category: categorizeRequirement(match[0]) });
			}
		});

		// Extract key technologies
		const techPattern = /\b(python|java|javascript|typescript|react|angular|vue|node|aws|azure|gcp|kubernetes|docker|sql|postgresql|mongodb|redis|kafka|spark|machine learning|data science|devops|ci\/cd|agile|scrum|project management|leadership)\b/gi;
		let techMatch;
		while ((techMatch = techPattern.exec(jobDescription)) !== null) {
			const tech = techMatch[0].trim();
			if (!extractedRequirements.some(r => r.requirement.toLowerCase().includes(tech.toLowerCase()))) {
				extractedRequirements.push({ requirement: tech, importance: "important", category: categorizeRequirement(tech) });
			}
		}

		// Find semantic matches
		const semanticMatches: AISemanticAnalysisResponse["semanticMatches"] = [];
		for (const req of extractedRequirements) {
			const reqLower = req.requirement.toLowerCase();

			if (allSkills.includes(reqLower) || allText.includes(reqLower)) {
				semanticMatches.push({
					requirement: req.requirement,
					personnelEvidence: findEvidence(req.requirement, personnelProfile),
					matchType: "direct",
					confidence: 95,
					explanation: `Direct match found in candidate's profile`,
				});
				continue;
			}

			let foundTransferable = false;
			for (const [concept, relatedTerms] of Object.entries(CONCEPT_MAPPINGS)) {
				if (reqLower.includes(concept) || relatedTerms.some(t => reqLower.includes(t))) {
					const matchingTerms = relatedTerms.filter(t => allSkills.includes(t) || allText.includes(t));
					if (matchingTerms.length > 0) {
						semanticMatches.push({
							requirement: req.requirement,
							personnelEvidence: matchingTerms.join(", "),
							matchType: "transferable",
							confidence: 75 + Math.min(20, matchingTerms.length * 5),
							explanation: `Related experience with: ${matchingTerms.slice(0, 3).join(", ")}`,
						});
						foundTransferable = true;
						break;
					}
				}
			}
			if (foundTransferable) continue;

			const capabilityMatch = CAPABILITY_PATTERNS.find(({ capability }) => {
				const capLower = capability.toLowerCase();
				return reqLower.includes(capLower.split(" ")[0]);
			});
			if (capabilityMatch) {
				const patternMatch = allText.match(capabilityMatch.pattern);
				if (patternMatch) {
					semanticMatches.push({
						requirement: req.requirement,
						personnelEvidence: patternMatch[0],
						matchType: "inferred",
						confidence: 70,
						explanation: `Capability inferred from: "${patternMatch[0]}"`,
					});
					continue;
				}
			}

			semanticMatches.push({
				requirement: req.requirement,
				personnelEvidence: "",
				matchType: "partial",
				confidence: 0,
				explanation: "No direct match found",
			});
		}

		const matchedRequirements = semanticMatches.filter(m => m.confidence > 0);
		const criticalMatched = semanticMatches.filter(
			m => m.confidence > 0 && extractedRequirements.find(r => r.requirement === m.requirement)?.importance === "critical"
		);
		const criticalTotal = extractedRequirements.filter(r => r.importance === "critical").length;

		const overallFitScore = semanticMatches.length > 0
			? Math.round((matchedRequirements.reduce((sum, m) => sum + m.confidence, 0) / semanticMatches.length) * (criticalTotal > 0 ? (criticalMatched.length / criticalTotal) : 1))
			: 0;

		const conceptualGaps = semanticMatches
			.filter(m => m.confidence === 0 || m.confidence < 50)
			.map(m => ({ requirement: m.requirement, suggestedAdditions: getSuggestedAdditions(m.requirement), reason: m.explanation }));

		const strengthSummary = matchedRequirements.filter(m => m.confidence >= 80).slice(0, 5).map(m => `Strong: ${m.requirement}`);
		const improvementAreas = conceptualGaps.slice(0, 5).map(g => `Add: ${g.suggestedAdditions[0] || g.requirement}`);

		return { extractedRequirements, semanticMatches, conceptualGaps, overallFitScore, strengthSummary, improvementAreas };
	} catch (error) {
		console.error("AI semantic analysis failed:", error);
		return null;
	}
}

// ============================================================================
// Semantic Matching Functions
// ============================================================================

/**
 * Extract capabilities from experience text using pattern matching.
 * Identifies leadership, technical, and soft skill indicators.
 */
function extractCapabilitiesFromText(text: string): CapabilityMapping[] {
	const capabilities: CapabilityMapping[] = [];
	const seenCapabilities = new Set<string>();

	CAPABILITY_PATTERNS.forEach(({ pattern, capability, category, strength }) => {
		// Reset regex state for global patterns
		pattern.lastIndex = 0;
		const matches = text.match(pattern);

		if (matches && !seenCapabilities.has(capability)) {
			seenCapabilities.add(capability);
			capabilities.push({
				capability,
				category,
				evidence: matches.slice(0, 3), // Keep up to 3 examples
				strength,
			});
		}
	});

	return capabilities;
}

/**
 * Find synonym matches for a given term.
 * Uses the skills taxonomy to identify equivalent terms.
 */
function findSynonymMatches(
	searchTerm: string,
	personnelData: {
		skills: string[];
		summary: string;
		experience: string;
		certifications: string[];
		education: string[];
	}
): SemanticMatch | null {
	const termLower = searchTerm.toLowerCase();

	// Check if any skill in taxonomy matches and find synonyms
	for (const [skill, taxonomy] of Object.entries(SKILLS_TAXONOMY)) {
		const allTerms = [skill, ...taxonomy.synonyms];

		if (allTerms.some(t => t.includes(termLower) || termLower.includes(t))) {
			// Search term is in our taxonomy - find matches in personnel data
			const matchedInSkills = personnelData.skills.filter(s =>
				allTerms.some(t => s.toLowerCase().includes(t) || t.includes(s.toLowerCase()))
			);
			const matchedInSummary = allTerms.some(t =>
				personnelData.summary.toLowerCase().includes(t)
			);
			const matchedInExperience = allTerms.some(t =>
				personnelData.experience.toLowerCase().includes(t)
			);

			if (matchedInSkills.length > 0 || matchedInSummary || matchedInExperience) {
				return {
					requirement: searchTerm,
					matchType: "synonym",
					confidence: 90,
					matchedTerms: [...matchedInSkills, ...(matchedInSummary ? [skill] : [])],
					source: matchedInSkills.length > 0 ? "skills" : matchedInSummary ? "summary" : "experience",
					explanation: `"${searchTerm}" matches via synonym: ${matchedInSkills.join(", ") || skill}`,
				};
			}
		}
	}

	return null;
}

/**
 * Find concept matches for a requirement.
 * Maps high-level concepts to specific technical skills.
 */
function findConceptMatches(
	requirement: string,
	personnelData: {
		skills: string[];
		summary: string;
		experience: string;
		certifications: string[];
	}
): ConceptMatch | null {
	const reqLower = requirement.toLowerCase();

	// Check if requirement maps to a concept
	for (const [concept, relatedTerms] of Object.entries(CONCEPT_MAPPINGS)) {
		if (concept.includes(reqLower) || reqLower.includes(concept.split(" ")[0])) {
			// Found a concept - check if personnel has related terms
			const allPersonnelText = [
				...personnelData.skills,
				personnelData.summary,
				personnelData.experience,
				...personnelData.certifications,
			].join(" ").toLowerCase();

			const foundTerms = relatedTerms.filter(term =>
				allPersonnelText.includes(term.toLowerCase())
			);

			if (foundTerms.length > 0) {
				const score = Math.min(100, Math.round((foundTerms.length / relatedTerms.length) * 100) + 30);
				return {
					concept,
					relatedTerms,
					foundTerms,
					score,
				};
			}
		}
	}

	// Also check if requirement matches implied skills from taxonomy
	for (const [skill, taxonomy] of Object.entries(SKILLS_TAXONOMY)) {
		const allPersonnelText = [
			...personnelData.skills,
			personnelData.summary,
			personnelData.experience,
		].join(" ").toLowerCase();

		if (allPersonnelText.includes(skill)) {
			// Personnel has this skill - check if requirement matches its concepts
			const conceptMatches = taxonomy.concepts.filter(c =>
				reqLower.includes(c.split(" ")[0]) || c.includes(reqLower.split(" ")[0])
			);

			if (conceptMatches.length > 0) {
				return {
					concept: conceptMatches[0],
					relatedTerms: [skill, ...taxonomy.impliedSkills],
					foundTerms: [skill],
					score: 75,
				};
			}
		}
	}

	return null;
}

/**
 * Find implied skill matches using the taxonomy.
 * If personnel has skill X, they likely also have related skills.
 */
function findImpliedSkillMatches(
	requirement: string,
	personnelSkills: string[]
): SemanticMatch | null {
	const reqLower = requirement.toLowerCase();

	for (const personnelSkill of personnelSkills) {
		const skillLower = personnelSkill.toLowerCase();

		// Check if personnel's skill implies the requirement
		for (const [skill, taxonomy] of Object.entries(SKILLS_TAXONOMY)) {
			if (skillLower.includes(skill) || skill.includes(skillLower)) {
				// Personnel has this taxonomized skill
				if (taxonomy.impliedSkills.some(impl => reqLower.includes(impl) || impl.includes(reqLower))) {
					return {
						requirement,
						matchType: "inferred",
						confidence: 65,
						matchedTerms: [personnelSkill],
						source: "skills",
						explanation: `"${requirement}" inferred from having "${personnelSkill}" (${skill} implies ${taxonomy.impliedSkills.join(", ")})`,
					};
				}
			}
		}
	}

	return null;
}

/**
 * Main semantic matching function.
 * Orchestrates all matching strategies to find the best matches.
 */
function findSemanticMatches(
	requirements: string[],
	personnel: Personnel
): {
	matches: SemanticMatch[];
	capabilities: CapabilityMapping[];
	conceptMatches: ConceptMatch[];
	overallScore: number;
} {
	const matches: SemanticMatch[] = [];
	const capabilities: CapabilityMapping[] = [];
	const conceptMatches: ConceptMatch[] = [];

	// Prepare personnel data for matching
	const personnelSkills = (personnel.skills || []).map(s => s.skillName);
	const personnelSummary = personnel.professionalSummary || "";
	const personnelCerts = (personnel.certifications || []).map(c => c.name);
	const personnelEdu = (personnel.education || []).map(e => `${e.degree} ${e.field} ${e.institution}`);

	// Build experience text from summary (would be enhanced with actual experience records)
	const experienceText = personnelSummary; // In production, concatenate all experience descriptions

	const personnelData = {
		skills: personnelSkills,
		summary: personnelSummary,
		experience: experienceText,
		certifications: personnelCerts,
		education: personnelEdu,
	};

	// Extract capabilities from experience
	const extractedCapabilities = extractCapabilitiesFromText(experienceText);
	capabilities.push(...extractedCapabilities);

	// Process each requirement
	for (const requirement of requirements) {
		const reqLower = requirement.toLowerCase();

		// 1. Check for exact matches first
		const exactInSkills = personnelSkills.some(s => s.toLowerCase().includes(reqLower));
		const exactInCerts = personnelCerts.some(c => c.toLowerCase().includes(reqLower));
		const exactInSummary = personnelSummary.toLowerCase().includes(reqLower);

		if (exactInSkills || exactInCerts || exactInSummary) {
			matches.push({
				requirement,
				matchType: "exact",
				confidence: 100,
				matchedTerms: [requirement],
				source: exactInSkills ? "skills" : exactInCerts ? "certifications" : "summary",
				explanation: `Exact match found in ${exactInSkills ? "skills" : exactInCerts ? "certifications" : "professional summary"}`,
			});
			continue;
		}

		// 2. Check for synonym matches
		const synonymMatch = findSynonymMatches(requirement, personnelData);
		if (synonymMatch) {
			matches.push(synonymMatch);
			continue;
		}

		// 3. Check for concept matches
		const conceptMatch = findConceptMatches(requirement, personnelData);
		if (conceptMatch) {
			conceptMatches.push(conceptMatch);
			matches.push({
				requirement,
				matchType: "concept",
				confidence: conceptMatch.score,
				matchedTerms: conceptMatch.foundTerms,
				source: "experience",
				explanation: `Concept "${conceptMatch.concept}" matched via: ${conceptMatch.foundTerms.join(", ")}`,
			});
			continue;
		}

		// 4. Check for implied skill matches
		const impliedMatch = findImpliedSkillMatches(requirement, personnelSkills);
		if (impliedMatch) {
			matches.push(impliedMatch);
			continue;
		}

		// 5. Check if requirement matches a capability we extracted
		const capabilityMatch = capabilities.find(c =>
			c.capability.toLowerCase().includes(reqLower) ||
			reqLower.includes(c.capability.toLowerCase().split(" ")[0])
		);
		if (capabilityMatch) {
			matches.push({
				requirement,
				matchType: "capability",
				confidence: capabilityMatch.strength === "strong" ? 85 : capabilityMatch.strength === "moderate" ? 70 : 55,
				matchedTerms: capabilityMatch.evidence,
				source: "experience",
				explanation: `Capability "${capabilityMatch.capability}" inferred from experience: "${capabilityMatch.evidence[0]}"`,
			});
			continue;
		}

		// No match found
		matches.push({
			requirement,
			matchType: "exact",
			confidence: 0,
			matchedTerms: [],
			source: "skills",
			explanation: "No match found - consider adding this skill or experience",
		});
	}

	// Calculate overall semantic score
	const matchedCount = matches.filter(m => m.confidence > 0).length;
	const totalConfidence = matches.reduce((sum, m) => sum + m.confidence, 0);
	const overallScore = matches.length > 0 ? Math.round(totalConfidence / matches.length) : 0;

	return {
		matches,
		capabilities,
		conceptMatches,
		overallScore,
	};
}

/**
 * Calculate ATS compatibility score based on various factors.
 * Considers keyword density, formatting, and match quality.
 */
function calculateATSScore(
	semanticMatches: SemanticMatch[],
	keywordMatches: KeywordMatch[],
	capabilities: CapabilityMapping[]
): {
	score: number;
	breakdown: { category: string; score: number; weight: number }[];
	recommendations: string[];
} {
	const breakdown: { category: string; score: number; weight: number }[] = [];
	const recommendations: string[] = [];

	// Exact keyword match score (40% weight)
	const exactMatches = keywordMatches.filter(k => k.found).length;
	const keywordScore = keywordMatches.length > 0 ? Math.round((exactMatches / keywordMatches.length) * 100) : 0;
	breakdown.push({ category: "Keyword Matches", score: keywordScore, weight: 40 });

	if (keywordScore < 50) {
		recommendations.push("Add more exact keyword matches from the job description to your skills and experience sections");
	}

	// Semantic match score (30% weight)
	const semanticScore = semanticMatches.length > 0
		? Math.round(semanticMatches.reduce((sum, m) => sum + m.confidence, 0) / semanticMatches.length)
		: 0;
	breakdown.push({ category: "Semantic Matches", score: semanticScore, weight: 30 });

	if (semanticScore < 60) {
		recommendations.push("Expand your experience descriptions to include related concepts and capabilities");
	}

	// Capability evidence score (20% weight)
	const strongCapabilities = capabilities.filter(c => c.strength === "strong").length;
	const capabilityScore = Math.min(100, strongCapabilities * 20);
	breakdown.push({ category: "Demonstrated Capabilities", score: capabilityScore, weight: 20 });

	if (capabilityScore < 40) {
		recommendations.push("Quantify your achievements (e.g., 'Led team of 10', 'Reduced costs by 30%')");
	}

	// Skill variety score (10% weight)
	const matchTypes = new Set(semanticMatches.map(m => m.matchType));
	const varietyScore = Math.min(100, matchTypes.size * 25);
	breakdown.push({ category: "Match Variety", score: varietyScore, weight: 10 });

	// Calculate weighted total
	const totalScore = Math.round(
		breakdown.reduce((sum, item) => sum + (item.score * item.weight / 100), 0)
	);

	// Add general recommendations
	if (totalScore < 70) {
		recommendations.push("Consider tailoring your professional summary to directly address the key requirements");
	}
	if (semanticMatches.filter(m => m.matchType === "exact").length < semanticMatches.length * 0.3) {
		recommendations.push("Use exact phrases from the job description where they genuinely apply");
	}

	return { score: totalScore, breakdown, recommendations };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SECTIONS: SectionConfig[] = [
	{ key: "contact", label: "Contact Information", enabled: true, order: 0 },
	{ key: "summary", label: "Professional Summary", enabled: true, order: 1 },
	{ key: "experience", label: "Work Experience", enabled: true, order: 2, maxItems: 10 },
	{ key: "education", label: "Education", enabled: true, order: 3 },
	{ key: "certifications", label: "Certifications", enabled: true, order: 4 },
	{ key: "skills", label: "Technical Skills", enabled: true, order: 5 },
	{ key: "clearance", label: "Security Clearance", enabled: true, order: 6 },
	{ key: "publications", label: "Publications", enabled: false, order: 7 },
	{ key: "awards", label: "Awards & Recognition", enabled: false, order: 8 },
	{ key: "languages", label: "Languages", enabled: false, order: 9 },
];

const FEDERAL_SECTIONS: SectionConfig[] = [
	{ key: "contact", label: "Contact Information", enabled: true, order: 0 },
	{ key: "clearance", label: "Security Clearance", enabled: true, order: 1 },
	{ key: "summary", label: "Professional Summary", enabled: true, order: 2 },
	{ key: "experience", label: "Relevant Experience", enabled: true, order: 3, maxItems: 15 },
	{ key: "education", label: "Education", enabled: true, order: 4 },
	{ key: "certifications", label: "Certifications & Training", enabled: true, order: 5 },
	{ key: "skills", label: "Technical Qualifications", enabled: true, order: 6 },
	{ key: "publications", label: "Publications & Presentations", enabled: true, order: 7 },
	{ key: "awards", label: "Awards & Honors", enabled: true, order: 8 },
];

const FORMAT_PRESETS: Record<string, { sections: SectionConfig[]; maxPages?: number }> = {
	federal: { sections: FEDERAL_SECTIONS, maxPages: undefined },
	commercial: { sections: DEFAULT_SECTIONS, maxPages: 2 },
	brief: { sections: DEFAULT_SECTIONS.slice(0, 5), maxPages: 1 },
	technical: { sections: DEFAULT_SECTIONS, maxPages: 3 },
};

// ============================================================================
// Helper Functions
// ============================================================================

function estimateWordCount(personnel: Personnel, sections: SectionConfig[]): number {
	let count = 0;

	sections.forEach(section => {
		if (!section.enabled) return;

		switch (section.key) {
			case "contact":
				count += 30;
				break;
			case "summary":
				count += (personnel.professionalSummary?.split(/\s+/).length || 0);
				break;
			case "experience":
				const exp = personnel.skills || []; // Using skills as proxy
				count += Math.min(exp.length, section.maxItems || 10) * 100;
				break;
			case "education":
				count += (personnel.education?.length || 0) * 40;
				break;
			case "certifications":
				count += (personnel.certifications?.length || 0) * 20;
				break;
			case "skills":
				count += (personnel.skills?.length || 0) * 5;
				break;
			case "clearance":
				count += personnel.clearanceLevel ? 20 : 0;
				break;
			default:
				count += 50;
		}
	});

	return count;
}

function estimatePages(wordCount: number): number {
	return Math.ceil(wordCount / 400); // ~400 words per page
}

// ============================================================================
// Sub-Components
// ============================================================================

function SectionEditor({
	section,
	onUpdate,
	onMoveUp,
	onMoveDown,
	isFirst,
	isLast,
}: {
	section: SectionConfig;
	onUpdate: (section: SectionConfig) => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	isFirst: boolean;
	isLast: boolean;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className={cn(
			"border rounded-lg p-3 transition-colors",
			!section.enabled && "opacity-50 bg-muted"
		)}>
			<div className="flex items-center gap-3">
				<div className="flex flex-col gap-0.5">
					<Button
						variant="ghost"
						size="sm"
						className="h-5 w-5 p-0"
						onClick={onMoveUp}
						disabled={isFirst}
					>
						<ChevronUp className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-5 w-5 p-0"
						onClick={onMoveDown}
						disabled={isLast}
					>
						<ChevronDown className="h-3 w-3" />
					</Button>
				</div>

				<Checkbox
					checked={section.enabled}
					onCheckedChange={(checked) => onUpdate({ ...section, enabled: !!checked })}
				/>

				<span className="flex-1 text-sm font-medium">{section.label}</span>

				{section.maxItems !== undefined && (
					<Badge variant="outline" className="text-xs">
						Max: {section.maxItems}
					</Badge>
				)}

				<Button
					variant="ghost"
					size="sm"
					onClick={() => setExpanded(!expanded)}
				>
					<Settings className="h-4 w-4" />
				</Button>
			</div>

			{expanded && (
				<div className="mt-3 pt-3 border-t space-y-3">
					{section.maxItems !== undefined && (
						<div className="space-y-2">
							<Label className="text-xs">Maximum Items</Label>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="h-8 w-8 p-0"
									onClick={() => onUpdate({ ...section, maxItems: Math.max(1, (section.maxItems || 5) - 1) })}
								>
									<Minus className="h-3 w-3" />
								</Button>
								<span className="w-8 text-center text-sm">{section.maxItems}</span>
								<Button
									variant="outline"
									size="sm"
									className="h-8 w-8 p-0"
									onClick={() => onUpdate({ ...section, maxItems: (section.maxItems || 5) + 1 })}
								>
									<Plus className="h-3 w-3" />
								</Button>
							</div>
						</div>
					)}

					<div className="space-y-2">
						<Label className="text-xs">Custom Content (Override)</Label>
						<Textarea
							value={section.customContent || ""}
							onChange={(e) => onUpdate({ ...section, customContent: e.target.value })}
							placeholder="Leave empty to use default content"
							rows={3}
							className="text-sm"
						/>
					</div>
				</div>
			)}
		</div>
	);
}

function PreviewPane({
	personnel,
	sections,
	format,
}: {
	personnel: Personnel;
	sections: SectionConfig[];
	format: string;
}) {
	const enabledSections = sections
		.filter(s => s.enabled)
		.sort((a, b) => a.order - b.order);

	return (
		<div className="bg-white border rounded-lg p-8 font-serif text-sm space-y-6 min-h-[600px]">
			{/* Header */}
			<div className="text-center border-b pb-4">
				<h1 className="text-2xl font-bold">
					{personnel.firstName} {personnel.lastName}
				</h1>
				{personnel.currentTitle && (
					<p className="text-lg text-muted-foreground">{personnel.currentTitle}</p>
				)}
				<div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
					{personnel.email && <span>{personnel.email}</span>}
					{personnel.phone && <span>{personnel.phone}</span>}
					{personnel.location && <span>{personnel.location}</span>}
				</div>
			</div>

			{/* Sections */}
			{enabledSections.map(section => (
				<div key={section.key} className="space-y-2">
					<h2 className="text-base font-bold uppercase tracking-wide border-b pb-1">
						{section.label}
					</h2>

					{section.key === "summary" && personnel.professionalSummary && (
						<p className="text-sm leading-relaxed">{personnel.professionalSummary}</p>
					)}

					{section.key === "clearance" && personnel.clearanceLevel && (
						<p className="text-sm">
							<strong>{personnel.clearanceLevel}</strong>
							{personnel.clearanceStatus && ` (${personnel.clearanceStatus})`}
						</p>
					)}

					{section.key === "education" && personnel.education?.length && (
						<div className="space-y-2">
							{personnel.education.map((edu, i) => (
								<div key={i} className="text-sm">
									<p className="font-semibold">{edu.degree} in {edu.field}</p>
									<p className="text-muted-foreground">{edu.institution}, {edu.year}</p>
								</div>
							))}
						</div>
					)}

					{section.key === "certifications" && personnel.certifications?.length && (
						<ul className="list-disc list-inside text-sm space-y-1">
							{personnel.certifications
								.slice(0, section.maxItems)
								.map((cert, i) => (
									<li key={i}>
										{cert.name} - {cert.issuer}
										{cert.status === "active" && <Badge variant="outline" className="ml-2 text-xs">Active</Badge>}
									</li>
								))}
						</ul>
					)}

					{section.key === "skills" && personnel.skills?.length && (
						<div className="flex flex-wrap gap-2">
							{personnel.skills.map((skill, i) => (
								<Badge key={i} variant="secondary" className="text-xs">
									{skill.skillName}
									{skill.yearsExperience > 0 && ` (${skill.yearsExperience}y)`}
								</Badge>
							))}
						</div>
					)}

					{section.key === "languages" && personnel.languages?.length && (
						<div className="flex gap-4 text-sm">
							{personnel.languages.map((lang, i) => (
								<span key={i}>
									{lang.language} ({lang.proficiency})
								</span>
							))}
						</div>
					)}

					{!["summary", "clearance", "education", "certifications", "skills", "languages", "contact"].includes(section.key) && (
						<p className="text-xs text-muted-foreground italic">
							[{section.label} content would appear here]
						</p>
					)}
				</div>
			))}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ResumeGenerator({
	personnel,
	templates = [],
	onGenerate,
	onSave,
	className,
}: ResumeGeneratorProps) {
	const [format, setFormat] = useState<"federal" | "commercial" | "brief" | "technical">("commercial");
	const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
	const [selectedTemplate, setSelectedTemplate] = useState<string>("");
	const [maxPages, setMaxPages] = useState<number>(2);
	const [includePhoto, setIncludePhoto] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");

	// Job Description Tailoring
	const [jobDescription, setJobDescription] = useState<string>("");
	const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
	const [analyzing, setAnalyzing] = useState(false);

	// Semantic Analysis State
	const [semanticAnalysis, setSemanticAnalysis] = useState<AISemanticAnalysisResponse | null>(null);
	const [showSemanticDetails, setShowSemanticDetails] = useState(false);

	// Extract keywords and perform semantic analysis
	const extractKeywords = async (text: string) => {
		setAnalyzing(true);
		try {
			// Enhanced keyword extraction with semantic analysis
			const stopWords = new Set([
				"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
				"of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
				"been", "being", "have", "has", "had", "do", "does", "did", "will",
				"would", "could", "should", "may", "might", "must", "shall", "can",
				"need", "dare", "ought", "used", "this", "that", "these", "those",
				"i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
				"whom", "whose", "where", "when", "why", "how", "all", "each", "every",
				"both", "few", "more", "most", "other", "some", "such", "no", "nor",
				"not", "only", "own", "same", "so", "than", "too", "very", "just",
				"also", "now", "here", "there", "then", "once", "if", "because",
				"about", "against", "between", "into", "through", "during", "before",
				"after", "above", "below", "up", "down", "out", "off", "over", "under",
				"again", "further", "any", "our", "your", "their", "its"
			]);

			const words = text.toLowerCase()
				.replace(/[^a-z0-9\s+#.-]/g, " ")
				.split(/\s+/)
				.filter(w => w.length > 2 && !stopWords.has(w));

			const wordCount = new Map<string, number>();
			words.forEach(word => {
				wordCount.set(word, (wordCount.get(word) || 0) + 1);
			});

			// Extract multi-word phrases
			const phrasePatterns = [
				/\b(project\s+management)\b/gi,
				/\b(software\s+development)\b/gi,
				/\b(machine\s+learning)\b/gi,
				/\b(artificial\s+intelligence)\b/gi,
				/\b(cloud\s+computing)\b/gi,
				/\b(data\s+analysis)\b/gi,
				/\b(system\s+design)\b/gi,
				/\b(agile\s+methodology)\b/gi,
				/\b(security\s+clearance)\b/gi,
				/\b(top\s+secret)\b/gi,
				/\b(problem\s+solving)\b/gi,
				/\b(full\s+stack)\b/gi,
				/\b(front[\s-]?end)\b/gi,
				/\b(back[\s-]?end)\b/gi,
				/\b(ci[\s\/]?cd)\b/gi,
				/\b(test[\s-]?driven)\b/gi,
				/\b(cross[\s-]?functional)\b/gi,
			];

			const phrases: string[] = [];
			phrasePatterns.forEach(pattern => {
				const matches = text.match(pattern);
				if (matches) {
					phrases.push(...matches.map(m => m.toLowerCase().replace(/\s+/g, " ")));
				}
			});

			const sortedKeywords = [...wordCount.entries()]
				.filter(([word]) => !stopWords.has(word))
				.sort((a, b) => b[1] - a[1])
				.slice(0, 20)
				.map(([word]) => word);

			const allKeywords = [...new Set([...phrases, ...sortedKeywords])].slice(0, 25);
			setExtractedKeywords(allKeywords);

			// Perform semantic analysis
			const personnelProfile = {
				skills: (personnel.skills || []).map(s => s.skillName),
				summary: personnel.professionalSummary || "",
				certifications: (personnel.certifications || []).map(c => c.name),
				education: (personnel.education || []).map(e => `${e.degree} ${e.field} ${e.institution}`),
			};

			const analysis = await performAISemanticAnalysis({
				jobDescription: text,
				personnelProfile,
			});

			setSemanticAnalysis(analysis);
		} finally {
			setAnalyzing(false);
		}
	};

	// Check keyword matches against personnel data
	const keywordMatches = useMemo((): KeywordMatch[] => {
		if (!extractedKeywords.length) return [];

		const personnelSkills = (personnel.skills || []).map(s => s.skillName.toLowerCase());
		const personnelCerts = (personnel.certifications || []).map(c => c.name.toLowerCase());
		const personnelEdu = (personnel.education || []).map(e =>
			`${e.degree} ${e.field} ${e.institution}`.toLowerCase()
		);
		const personnelSummary = (personnel.professionalSummary || "").toLowerCase();

		return extractedKeywords.map(keyword => {
			const kw = keyword.toLowerCase();
			return {
				keyword,
				found: personnelSkills.some(s => s.includes(kw)) ||
					personnelCerts.some(c => c.includes(kw)) ||
					personnelSummary.includes(kw),
				inSkills: personnelSkills.some(s => s.includes(kw)),
				inExperience: personnelSummary.includes(kw),
				inCertifications: personnelCerts.some(c => c.includes(kw)),
				inEducation: personnelEdu.some(e => e.includes(kw)),
			};
		});
	}, [extractedKeywords, personnel]);

	// Calculate match percentage
	const matchPercentage = useMemo(() => {
		if (!keywordMatches.length) return 0;
		const matched = keywordMatches.filter(k => k.found).length;
		return Math.round((matched / keywordMatches.length) * 100);
	}, [keywordMatches]);

	// Apply format preset
	const applyPreset = (newFormat: typeof format) => {
		setFormat(newFormat);
		const preset = FORMAT_PRESETS[newFormat];
		setSections(preset.sections.map((s, i) => ({ ...s, order: i })));
		if (preset.maxPages) setMaxPages(preset.maxPages);
	};

	// Section operations
	const updateSection = (key: string, updates: Partial<SectionConfig>) => {
		setSections(prev =>
			prev.map(s => s.key === key ? { ...s, ...updates } : s)
		);
	};

	const moveSection = (key: string, direction: "up" | "down") => {
		setSections(prev => {
			const index = prev.findIndex(s => s.key === key);
			if (index === -1) return prev;

			const newIndex = direction === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= prev.length) return prev;

			const newSections = [...prev];
			[newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];

			return newSections.map((s, i) => ({ ...s, order: i }));
		});
	};

	// Estimates
	const wordCount = useMemo(() => estimateWordCount(personnel, sections), [personnel, sections]);
	const pageEstimate = useMemo(() => estimatePages(wordCount), [wordCount]);

	// Generate resume
	const handleGenerate = async (exportFormat: "pdf" | "docx" | "latex" | "html") => {
		setGenerating(true);
		try {
			const options: GenerateOptions = {
				templateId: selectedTemplate || undefined,
				format,
				exportFormat,
				sections: sections.filter(s => s.enabled),
				maxPages,
				includePhoto,
			};

			if (onGenerate) {
				const blob = await onGenerate(format, options);
				// Download the file
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `${personnel.firstName}_${personnel.lastName}_Resume.${exportFormat}`;
				a.click();
				URL.revokeObjectURL(url);
			}
		} finally {
			setGenerating(false);
		}
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<FileText className="h-6 w-6" />
						Resume Generator
					</h2>
					<p className="text-muted-foreground">
						Generate formatted resumes for {personnel.firstName} {personnel.lastName}
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button disabled={generating}>
							{generating ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Download className="h-4 w-4 mr-2" />
							)}
							Export
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => handleGenerate("pdf")}>
							<FileType className="h-4 w-4 mr-2" />
							Export as PDF
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => handleGenerate("docx")}>
							<FileText className="h-4 w-4 mr-2" />
							Export as Word
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => handleGenerate("latex")}>
							<FileText className="h-4 w-4 mr-2" />
							Export as LaTeX
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => handleGenerate("html")}>
							<FileText className="h-4 w-4 mr-2" />
							Export as HTML
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Job Description Tailoring */}
			<Card className="border-blue-200 bg-blue-50/50">
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<Target className="h-4 w-4" />
						Tailor to Job Description (ATS Optimized)
					</CardTitle>
					<CardDescription>
						Paste a job description to automatically extract keywords and optimize your resume for Applicant Tracking Systems
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Textarea
							placeholder="Paste the job description here to extract keywords and tailor your resume..."
							value={jobDescription}
							onChange={(e) => setJobDescription(e.target.value)}
							rows={4}
							className="bg-white"
						/>
						<div className="flex items-center justify-between">
							<Button
								variant="outline"
								size="sm"
								onClick={() => extractKeywords(jobDescription)}
								disabled={!jobDescription.trim() || analyzing}
							>
								{analyzing ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Wand2 className="h-4 w-4 mr-2" />
								)}
								Extract Keywords
							</Button>
							{extractedKeywords.length > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant={matchPercentage >= 70 ? "default" : matchPercentage >= 50 ? "secondary" : "outline"}>
										{matchPercentage}% Match
									</Badge>
									<span className="text-xs text-muted-foreground">
										{keywordMatches.filter(k => k.found).length}/{extractedKeywords.length} keywords found
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Keyword Analysis */}
					{extractedKeywords.length > 0 && (
						<div className="space-y-3 pt-3 border-t">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-medium">Keyword Analysis</h4>
								<div className="text-xs text-muted-foreground">
									Keyword Match: <span className={cn(
										"font-bold",
										matchPercentage >= 70 ? "text-green-600" :
											matchPercentage >= 50 ? "text-yellow-600" : "text-red-600"
									)}>{matchPercentage}%</span>
								</div>
							</div>

							{/* Matched Keywords */}
							<div>
								<p className="text-xs text-muted-foreground mb-1">
									<CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
									Found in Resume ({keywordMatches.filter(k => k.found).length})
								</p>
								<div className="flex flex-wrap gap-1">
									{keywordMatches.filter(k => k.found).map(k => (
										<Badge key={k.keyword} variant="outline" className="text-xs text-green-700 bg-green-50 border-green-200">
											{k.keyword}
											{k.inSkills && <span className="ml-1 opacity-60">(skills)</span>}
										</Badge>
									))}
								</div>
							</div>

							{/* Missing Keywords */}
							{keywordMatches.filter(k => !k.found).length > 0 && (
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										<AlertCircle className="h-3 w-3 inline mr-1 text-yellow-500" />
										Missing - Consider Adding ({keywordMatches.filter(k => !k.found).length})
									</p>
									<div className="flex flex-wrap gap-1">
										{keywordMatches.filter(k => !k.found).map(k => (
											<Badge key={k.keyword} variant="outline" className="text-xs text-yellow-700 bg-yellow-50 border-yellow-200">
												{k.keyword}
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Semantic Analysis */}
					{semanticAnalysis && (
						<div className="space-y-4 pt-4 border-t">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-medium flex items-center gap-2">
									<Brain className="h-4 w-4 text-purple-500" />
									AI Semantic Analysis
								</h4>
								<div className="flex items-center gap-2">
									<span className="text-xs text-muted-foreground">Overall Fit:</span>
									<Badge variant={semanticAnalysis.overallFitScore >= 70 ? "default" : semanticAnalysis.overallFitScore >= 50 ? "secondary" : "outline"}>
										{semanticAnalysis.overallFitScore}%
									</Badge>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2"
										onClick={() => setShowSemanticDetails(!showSemanticDetails)}
									>
										{showSemanticDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
									</Button>
								</div>
							</div>

							{/* Semantic Match Summary */}
							<div className="grid grid-cols-4 gap-2">
								<div className="bg-green-50 rounded-lg p-2 text-center">
									<p className="text-lg font-bold text-green-700">
										{semanticAnalysis.semanticMatches.filter(m => m.matchType === "direct").length}
									</p>
									<p className="text-xs text-green-600">Direct</p>
								</div>
								<div className="bg-blue-50 rounded-lg p-2 text-center">
									<p className="text-lg font-bold text-blue-700">
										{semanticAnalysis.semanticMatches.filter(m => m.matchType === "transferable").length}
									</p>
									<p className="text-xs text-blue-600">Transferable</p>
								</div>
								<div className="bg-purple-50 rounded-lg p-2 text-center">
									<p className="text-lg font-bold text-purple-700">
										{semanticAnalysis.semanticMatches.filter(m => m.matchType === "inferred").length}
									</p>
									<p className="text-xs text-purple-600">Inferred</p>
								</div>
								<div className="bg-red-50 rounded-lg p-2 text-center">
									<p className="text-lg font-bold text-red-700">
										{semanticAnalysis.conceptualGaps.length}
									</p>
									<p className="text-xs text-red-600">Gaps</p>
								</div>
							</div>

							{showSemanticDetails && (
								<>
									{/* Direct Matches */}
									{semanticAnalysis.semanticMatches.filter(m => m.matchType === "direct").length > 0 && (
										<div className="bg-white rounded-lg p-3">
											<p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
												<CheckCircle className="h-3 w-3" />
												Direct Matches (Exact or Near-Exact)
											</p>
											<div className="space-y-1">
												{semanticAnalysis.semanticMatches.filter(m => m.matchType === "direct").map((m, i) => (
													<div key={i} className="text-xs flex items-center gap-2">
														<Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
															{m.confidence}%
														</Badge>
														<span className="font-medium">{m.requirement}</span>
														<ArrowRight className="h-3 w-3 text-muted-foreground" />
														<span className="text-muted-foreground truncate">{m.personnelEvidence}</span>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Transferable Skills */}
									{semanticAnalysis.semanticMatches.filter(m => m.matchType === "transferable").length > 0 && (
										<div className="bg-white rounded-lg p-3">
											<p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
												<Zap className="h-3 w-3" />
												Transferable Skills (Related Experience)
											</p>
											<div className="space-y-1">
												{semanticAnalysis.semanticMatches.filter(m => m.matchType === "transferable").map((m, i) => (
													<div key={i} className="text-xs">
														<div className="flex items-center gap-2">
															<Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
																{m.confidence}%
															</Badge>
															<span className="font-medium">{m.requirement}</span>
														</div>
														<p className="text-muted-foreground ml-12 mt-0.5">{m.explanation}</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Inferred Capabilities */}
									{semanticAnalysis.semanticMatches.filter(m => m.matchType === "inferred").length > 0 && (
										<div className="bg-white rounded-lg p-3">
											<p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
												<Lightbulb className="h-3 w-3" />
												Inferred Capabilities (From Experience)
											</p>
											<div className="space-y-1">
												{semanticAnalysis.semanticMatches.filter(m => m.matchType === "inferred").map((m, i) => (
													<div key={i} className="text-xs">
														<div className="flex items-center gap-2">
															<Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
																{m.confidence}%
															</Badge>
															<span className="font-medium">{m.requirement}</span>
														</div>
														<p className="text-muted-foreground ml-12 mt-0.5">{m.explanation}</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Gaps and Recommendations */}
									{semanticAnalysis.conceptualGaps.length > 0 && (
										<div className="bg-white rounded-lg p-3">
											<p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
												<XCircle className="h-3 w-3" />
												Gaps - Consider Adding These
											</p>
											<div className="space-y-2">
												{semanticAnalysis.conceptualGaps.slice(0, 5).map((g, i) => (
													<div key={i} className="text-xs border-l-2 border-red-200 pl-2">
														<p className="font-medium">{g.requirement}</p>
														<p className="text-muted-foreground">
															Suggested: {g.suggestedAdditions.slice(0, 3).join(", ")}
														</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Improvement Areas */}
									{semanticAnalysis.improvementAreas.length > 0 && (
										<div className="bg-amber-50 rounded-lg p-3">
											<p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
												<TrendingUp className="h-3 w-3" />
												Recommended Improvements
											</p>
											<ul className="text-xs text-amber-800 space-y-1">
												{semanticAnalysis.improvementAreas.map((area, i) => (
													<li key={i}>• {area}</li>
												))}
											</ul>
										</div>
									)}

									{/* Strength Summary */}
									{semanticAnalysis.strengthSummary.length > 0 && (
										<div className="bg-green-50 rounded-lg p-3">
											<p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
												<Shield className="h-3 w-3" />
												Your Strengths
											</p>
											<ul className="text-xs text-green-800 space-y-1">
												{semanticAnalysis.strengthSummary.map((s, i) => (
													<li key={i}>• {s}</li>
												))}
											</ul>
										</div>
									)}
								</>
							)}
						</div>
					)}

					{/* ATS Tips */}
					{extractedKeywords.length > 0 && (
						<div className="bg-white rounded-lg p-3 text-xs">
							<p className="font-medium mb-1">ATS Optimization Tips:</p>
							<ul className="text-muted-foreground space-y-1">
								<li>• Use exact keyword matches from the job description</li>
								<li>• Include both spelled out terms and acronyms (e.g., "AWS" and "Amazon Web Services")</li>
								<li>• Place key skills in a dedicated skills section</li>
								<li>• Use standard section headers (Experience, Education, Skills)</li>
								<li>• Quantify achievements (led team of 10, reduced costs by 30%)</li>
							</ul>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Format Selection */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Resume Format</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-4 gap-3">
						{(["federal", "commercial", "brief", "technical"] as const).map(f => (
							<Button
								key={f}
								variant={format === f ? "primary" : "outline"}
								className="h-auto py-3 flex-col"
								onClick={() => applyPreset(f)}
							>
								<span className="capitalize font-medium">{f}</span>
								<span className="text-xs text-muted-foreground mt-1">
									{f === "federal" && "Detailed, no page limit"}
									{f === "commercial" && "Standard 2-page"}
									{f === "brief" && "1-page summary"}
									{f === "technical" && "Skills-focused"}
								</span>
							</Button>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Main Editor */}
			<div className="grid grid-cols-2 gap-6">
				{/* Left: Settings */}
				<div className="space-y-4">
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Sections</CardTitle>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<span>~{wordCount} words</span>
									<span>•</span>
									<span>~{pageEstimate} pages</span>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[400px] pr-4">
								<div className="space-y-2">
									{sections
										.sort((a, b) => a.order - b.order)
										.map((section, i) => (
											<SectionEditor
												key={section.key}
												section={section}
												onUpdate={(s) => updateSection(section.key, s)}
												onMoveUp={() => moveSection(section.key, "up")}
												onMoveDown={() => moveSection(section.key, "down")}
												isFirst={i === 0}
												isLast={i === sections.length - 1}
											/>
										))}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Options</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{templates.length > 0 && (
								<div className="space-y-2">
									<Label>Template</Label>
									<Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
										<SelectTrigger>
											<SelectValue placeholder="Default template" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="">Default</SelectItem>
											{templates.map(t => (
												<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							<div className="space-y-2">
								<Label>Max Pages</Label>
								<div className="flex items-center gap-4">
									<Slider
										value={[maxPages]}
										onValueChange={([v]) => setMaxPages(v)}
										min={1}
										max={10}
										step={1}
										className="flex-1"
									/>
									<span className="w-8 text-sm text-center">{maxPages}</span>
								</div>
							</div>

							<div className="flex items-center justify-between">
								<Label>Include Photo</Label>
								<Switch
									checked={includePhoto}
									onCheckedChange={setIncludePhoto}
								/>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Right: Preview */}
				<div>
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base flex items-center gap-2">
								<Eye className="h-4 w-4" />
								Preview
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[600px]">
								<PreviewPane
									personnel={personnel}
									sections={sections}
									format={format}
								/>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

export default ResumeGenerator;
