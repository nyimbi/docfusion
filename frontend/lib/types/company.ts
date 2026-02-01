/**
 * Company Setup Types - DocFusion
 *
 * Type definitions for company profile management, roles, CVs,
 * clients, products, services, and custom variables.
 */

// ============================================================================
// Area of Business Types
// ============================================================================

/**
 * Standard areas of business for categorization.
 */
export const AREA_OF_BUSINESS_OPTIONS = [
	"technology",
	"consulting",
	"engineering",
	"healthcare",
	"finance",
	"government",
	"education",
	"manufacturing",
	"retail",
	"legal",
	"nonprofit",
	"media",
	"telecommunications",
	"energy",
	"transportation",
	"real_estate",
	"hospitality",
	"agriculture",
	"construction",
	"other",
] as const;

export type AreaOfBusiness = (typeof AREA_OF_BUSINESS_OPTIONS)[number];

/**
 * Display labels for areas of business.
 */
export const AREA_OF_BUSINESS_LABELS: Record<AreaOfBusiness, string> = {
	technology: "Technology",
	consulting: "Consulting",
	engineering: "Engineering",
	healthcare: "Healthcare",
	finance: "Finance",
	government: "Government",
	education: "Education",
	manufacturing: "Manufacturing",
	retail: "Retail",
	legal: "Legal Services",
	nonprofit: "Non-Profit",
	media: "Media & Entertainment",
	telecommunications: "Telecommunications",
	energy: "Energy",
	transportation: "Transportation & Logistics",
	real_estate: "Real Estate",
	hospitality: "Hospitality",
	agriculture: "Agriculture",
	construction: "Construction",
	other: "Other",
};

// ============================================================================
// Company Variable Types
// ============================================================================

/**
 * Value types for company variables.
 */
export const VARIABLE_VALUE_TYPES = [
	"text",
	"number",
	"date",
	"url",
	"email",
	"phone",
	"currency",
	"boolean",
] as const;

export type VariableValueType = (typeof VARIABLE_VALUE_TYPES)[number];

/**
 * Categories for organizing company variables.
 */
export const VARIABLE_CATEGORIES = [
	"general",
	"contact",
	"legal",
	"branding",
	"financial",
	"custom",
] as const;

export type VariableCategory = (typeof VARIABLE_CATEGORIES)[number];

/**
 * A user-defined company variable for template substitution.
 */
export interface CompanyVariable {
	id: string;
	organizationId: string;
	/** Variable name (used as {{custom.name}} in templates) */
	name: string;
	/** Human-readable label */
	label: string;
	/** Variable value */
	value: string | null;
	/** Description/help text */
	description: string | null;
	/** Value type for validation */
	valueType: VariableValueType;
	/** Category for grouping */
	category: VariableCategory | null;
	/** Sort order within category */
	sortOrder: number;
	/** Whether this variable is active */
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a company variable.
 */
export interface CreateVariableInput {
	name: string;
	label: string;
	value?: string;
	description?: string;
	valueType?: VariableValueType;
	category?: VariableCategory;
	sortOrder?: number;
}

/**
 * Input for updating a company variable.
 */
export interface UpdateVariableInput {
	name?: string;
	label?: string;
	value?: string | null;
	description?: string | null;
	valueType?: VariableValueType;
	category?: VariableCategory | null;
	sortOrder?: number;
	isActive?: boolean;
}

/**
 * Filters for variable queries.
 */
export interface VariableFilters {
	search?: string;
	category?: VariableCategory;
	isActive?: boolean;
}

// ============================================================================
// Extended Company Settings Types
// ============================================================================

/**
 * Contact information structure.
 */
export interface ContactInfo {
	name: string | null;
	title?: string | null;
	email: string | null;
	phone: string | null;
}

/**
 * Address information structure.
 */
export interface AddressInfo {
	line1: string | null;
	line2: string | null;
	suite: string | null;
	city: string | null;
	stateProvince: string | null;
	postalCode: string | null;
	country: string | null;
}

/**
 * Extended company settings with all new fields.
 */
export interface ExtendedCompanySettings {
	id: string;
	// Identity
	companyName: string;
	shortName: string | null;
	colloquialName: string | null;
	legalName: string | null;
	logoImageUrl: string | null;
	logoIconUrl: string | null;
	website: string | null;
	areaOfBusiness: AreaOfBusiness | null;
	// Address
	address: AddressInfo;
	// Contacts
	generalEmail: string | null;
	generalPhone: string | null;
	primaryContact: ContactInfo;
	contractsContact: ContactInfo;
	// Legal/Tax
	registrationNumber: string | null;
	registrationCountry: string | null;
	taxId: string | null;
	vatNumber: string | null;
	dunsNumber: string | null;
	cageCode: string | null;
	samUei: string | null;
	naicsCodes: string[];
	// Metadata
	yearFounded: number | null;
	employeeCount: number | null;
	annualRevenue: string | null;
	industryDescription: string | null;
	certifications: string[];
	// Branding
	primaryColor: string | null;
	secondaryColor: string | null;
	// Content
	coreCapabilities: string[];
	differentiators: string[];
	pastPerformanceSummary: string | null;
	companyBoilerplate: string | null;
	// Timestamps
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for updating extended company settings.
 */
export interface UpdateCompanySettingsInput {
	// Identity
	companyName?: string;
	shortName?: string | null;
	colloquialName?: string | null;
	legalName?: string | null;
	logoImageUrl?: string | null;
	logoIconUrl?: string | null;
	website?: string | null;
	areaOfBusiness?: AreaOfBusiness | null;
	// Address
	addressLine1?: string | null;
	addressLine2?: string | null;
	addressSuite?: string | null;
	city?: string | null;
	stateProvince?: string | null;
	postalCode?: string | null;
	country?: string | null;
	// Contacts
	generalEmail?: string | null;
	generalPhone?: string | null;
	primaryContactName?: string | null;
	primaryContactTitle?: string | null;
	primaryContactEmail?: string | null;
	primaryContactPhone?: string | null;
	contractsContactName?: string | null;
	contractsContactTitle?: string | null;
	contractsContactEmail?: string | null;
	contractsContactPhone?: string | null;
	// Legal/Tax
	registrationNumber?: string | null;
	registrationCountry?: string | null;
	taxId?: string | null;
	vatNumber?: string | null;
	dunsNumber?: string | null;
	cageCode?: string | null;
	samUei?: string | null;
	naicsCodes?: string[];
	// Metadata
	yearFounded?: number | null;
	employeeCount?: number | null;
	annualRevenue?: string | null;
	industryDescription?: string | null;
	certifications?: string[];
	// Branding
	primaryColor?: string | null;
	secondaryColor?: string | null;
	// Content
	coreCapabilities?: string[];
	differentiators?: string[];
	pastPerformanceSummary?: string | null;
	companyBoilerplate?: string | null;
}

// ============================================================================
// Role Types
// ============================================================================

/**
 * A job role within the organization.
 */
export interface Role {
	id: string;
	organizationId: string;
	name: string;
	description: string | null;
	department: string | null;
	level: string | null;
	responsibilities: string[];
	skillsRequired: string[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a role.
 */
export interface CreateRoleInput {
	name: string;
	description?: string;
	department?: string;
	level?: string;
	responsibilities?: string[];
	skillsRequired?: string[];
}

/**
 * Input for updating a role.
 */
export interface UpdateRoleInput {
	name?: string;
	description?: string;
	department?: string;
	level?: string;
	responsibilities?: string[];
	skillsRequired?: string[];
}

/**
 * Filters for role queries.
 */
export interface RoleFilters {
	search?: string;
	department?: string;
	level?: string;
}

// ============================================================================
// CV Types
// ============================================================================

/**
 * Work experience entry.
 */
export interface CVExperience {
	id?: string;
	company: string;
	title: string;
	location?: string;
	startDate?: string;
	endDate?: string;
	isCurrent?: boolean;
	description?: string;
	achievements?: string[];
}

/**
 * Education entry.
 */
export interface CVEducation {
	id?: string;
	institution: string;
	degree: string;
	field?: string;
	location?: string;
	startDate?: string;
	endDate?: string;
	grade?: string;
}

/**
 * Skill entry.
 */
export interface CVSkill {
	name: string;
	level?: "beginner" | "intermediate" | "advanced" | "expert";
}

/**
 * Certification entry.
 */
export interface CVCertification {
	name: string;
	issuer?: string;
	date?: string;
	expiry?: string;
	credentialId?: string;
}

/**
 * Project entry.
 */
export interface CVProject {
	id?: string;
	name: string;
	client?: string;
	description?: string;
	role?: string;
	startDate?: string;
	endDate?: string;
	tags?: string[];
}

/**
 * Language entry.
 */
export interface CVLanguage {
	language: string;
	proficiency?: "basic" | "conversational" | "fluent" | "native";
}

/**
 * Publication entry.
 */
export interface CVPublication {
	title: string;
	authors?: string;
	publication?: string;
	date?: string;
	url?: string;
}

/**
 * A CV/Resume.
 */
export interface CV {
	id: string;
	userId: string | null;
	organizationId: string;
	fullName: string;
	title: string | null;
	summary: string | null;
	experience: CVExperience[];
	education: CVEducation[];
	skills: CVSkill[];
	certifications: CVCertification[];
	projects: CVProject[];
	languages: CVLanguage[];
	publications: CVPublication[];
	email: string | null;
	phone: string | null;
	linkedinUrl: string | null;
	portfolioUrl: string | null;
	version: number;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a CV.
 */
export interface CreateCVInput {
	userId?: string;
	fullName: string;
	title?: string;
	summary?: string;
	experience?: CVExperience[];
	education?: CVEducation[];
	skills?: CVSkill[];
	certifications?: CVCertification[];
	projects?: CVProject[];
	languages?: CVLanguage[];
	publications?: CVPublication[];
	email?: string;
	phone?: string;
	linkedinUrl?: string;
	portfolioUrl?: string;
}

/**
 * Input for updating a CV.
 */
export interface UpdateCVInput {
	fullName?: string;
	title?: string;
	summary?: string;
	experience?: CVExperience[];
	education?: CVEducation[];
	skills?: CVSkill[];
	certifications?: CVCertification[];
	projects?: CVProject[];
	languages?: CVLanguage[];
	publications?: CVPublication[];
	email?: string;
	phone?: string;
	linkedinUrl?: string;
	portfolioUrl?: string;
}

/**
 * Filters for CV queries.
 */
export interface CVFilters {
	search?: string;
	isActive?: boolean;
}

// ============================================================================
// Company Profile Types
// ============================================================================

/**
 * Specialty/Service offered.
 */
export interface CompanySpecialty {
	name: string;
	description?: string;
}

/**
 * Certification info.
 */
export interface CompanyCertification {
	name: string;
	issuer?: string;
	date?: string;
}

/**
 * Award info.
 */
export interface CompanyAward {
	name: string;
	issuer?: string;
	year?: number;
}

/**
 * Key client reference.
 */
export interface KeyClient {
	name: string;
	industry?: string;
	duration?: string;
}

/**
 * Complete company profile.
 */
export interface CompanyProfile {
	id: string;
	organizationId: string;
	name: string;
	description: string | null;
	mission: string | null;
	vision: string | null;
	founded: number | null;
	employees: string | null;
	revenue: string | null;
	website: string | null;
	industry: string | null;
	specialties: CompanySpecialty[];
	certifications: CompanyCertification[];
	awards: CompanyAward[];
	keyClients: KeyClient[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating/updating company profile.
 */
export interface CompanyProfileInput {
	name: string;
	description?: string;
	mission?: string;
	vision?: string;
	founded?: number;
	employees?: string;
	revenue?: string;
	website?: string;
	industry?: string;
	specialties?: CompanySpecialty[];
	certifications?: CompanyCertification[];
	awards?: CompanyAward[];
	keyClients?: KeyClient[];
}

// ============================================================================
// Client Types
// ============================================================================

/**
 * Client project reference.
 */
export interface ClientProject {
	id?: string;
	name: string;
	value?: number;
	status?: string;
	description?: string;
}

/**
 * Client relationship status.
 */
export type ClientStatus = "active" | "former" | "prospect";

/**
 * A client/relationship.
 */
export interface Client {
	id: string;
	organizationId: string;
	name: string;
	industry: string | null;
	size: string | null;
	location: string | null;
	contactName: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	relationshipType: string | null;
	contractValue: number | null;
	startDate: Date | null;
	endDate: Date | null;
	status: ClientStatus;
	notes: string | null;
	projects: ClientProject[];
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a client.
 */
export interface CreateClientInput {
	name: string;
	industry?: string;
	size?: string;
	location?: string;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	relationshipType?: string;
	contractValue?: number;
	startDate?: Date | string;
	endDate?: Date | string;
	status?: ClientStatus;
	notes?: string;
	projects?: ClientProject[];
}

/**
 * Input for updating a client.
 */
export interface UpdateClientInput {
	name?: string;
	industry?: string;
	size?: string;
	location?: string;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	relationshipType?: string;
	contractValue?: number;
	startDate?: Date | string | null;
	endDate?: Date | string | null;
	status?: ClientStatus;
	notes?: string;
	projects?: ClientProject[];
}

/**
 * Filters for client queries.
 */
export interface ClientFilters {
	search?: string;
	status?: ClientStatus;
	industry?: string;
	size?: string;
}

// ============================================================================
// Product Types
// ============================================================================

/**
 * Product feature.
 */
export interface ProductFeature {
	name: string;
	description?: string;
}

/**
 * Product status.
 */
export type ProductStatus = "active" | "discontinued" | "development";

/**
 * A product offered.
 */
export interface Product {
	id: string;
	organizationId: string;
	name: string;
	category: string | null;
	/** Legacy description field */
	description: string | null;
	/** Short description (max 500 chars, for summaries) */
	shortDescription: string | null;
	/** Long description (detailed product information) */
	longDescription: string | null;
	/** Product website URL */
	websiteUrl: string | null;
	/** Product logo URL */
	logoUrl: string | null;
	features: ProductFeature[];
	pricing: string | null;
	availability: string | null;
	documentation: string | null;
	images: string[];
	status: ProductStatus;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a product.
 */
export interface CreateProductInput {
	name: string;
	category?: string;
	description?: string;
	shortDescription?: string;
	longDescription?: string;
	websiteUrl?: string;
	logoUrl?: string;
	features?: ProductFeature[];
	pricing?: string;
	availability?: string;
	documentation?: string;
	images?: string[];
	status?: ProductStatus;
}

/**
 * Input for updating a product.
 */
export interface UpdateProductInput {
	name?: string;
	category?: string;
	description?: string;
	shortDescription?: string;
	longDescription?: string;
	websiteUrl?: string;
	logoUrl?: string;
	features?: ProductFeature[];
	pricing?: string;
	availability?: string;
	documentation?: string;
	images?: string[];
	status?: ProductStatus;
}

/**
 * Filters for product queries.
 */
export interface ProductFilters {
	search?: string;
	category?: string;
	status?: ProductStatus;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Service capability.
 */
export interface ServiceCapability {
	name: string;
	description?: string;
}

/**
 * Service status.
 */
export type ServiceStatus = "active" | "discontinued" | "limited";

/**
 * A service offered.
 */
export interface Service {
	id: string;
	organizationId: string;
	name: string;
	category: string | null;
	description: string | null;
	capabilities: ServiceCapability[];
	pricing: string | null;
	turnaround: string | null;
	certifications: string[];
	status: ServiceStatus;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input for creating a service.
 */
export interface CreateServiceInput {
	name: string;
	category?: string;
	description?: string;
	capabilities?: ServiceCapability[];
	pricing?: string;
	turnaround?: string;
	certifications?: string[];
	status?: ServiceStatus;
}

/**
 * Input for updating a service.
 */
export interface UpdateServiceInput {
	name?: string;
	category?: string;
	description?: string;
	capabilities?: ServiceCapability[];
	pricing?: string;
	turnaround?: string;
	certifications?: string[];
	status?: ServiceStatus;
}

/**
 * Filters for service queries.
 */
export interface ServiceFilters {
	search?: string;
	category?: string;
	status?: ServiceStatus;
}

// ============================================================================
// Company Stats
// ============================================================================

/**
 * Company setup statistics summary.
 */
export interface CompanyStats {
	roleCount: number;
	cvCount: number;
	description: string | null;
	clientCount: number;
	activeClientCount: number;
	formerClientCount: number;
	specCount: number;
	serviceCount: number;
	productCount: number;
}
