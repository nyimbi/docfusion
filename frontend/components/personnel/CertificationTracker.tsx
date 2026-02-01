"use client";

/**
 * CertificationTracker Component
 *
 * Tracks certification status, expiration dates, and renewal alerts.
 * Provides dashboard view of team certification compliance and
 * automated reminder management.
 */

import { useState, useMemo } from "react";
import {
	Award,
	AlertTriangle,
	CheckCircle,
	Clock,
	Calendar,
	Bell,
	Search,
	Filter,
	Download,
	Plus,
	Edit,
	Trash2,
	ExternalLink,
	RefreshCw,
	Mail,
	Users,
	TrendingUp,
	XCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Personnel } from "@/lib/db/schema-personnel";

// ============================================================================
// Types
// ============================================================================

interface CertificationTrackerProps {
	personnel: Personnel[];
	onSendReminder?: (personnelId: string, certName: string) => Promise<void>;
	onUpdateCertification?: (personnelId: string, certIndex: number, updates: CertificationUpdate) => Promise<void>;
	className?: string;
}

interface CertificationUpdate {
	status?: "active" | "expired" | "pending";
	expirationDate?: string;
	certificationNumber?: string;
}

interface CertificationWithOwner {
	personnel: Personnel;
	certification: NonNullable<Personnel["certifications"]>[number];
	certIndex: number;
	daysUntilExpiry: number | null;
	status: "active" | "expiring" | "expired" | "no_expiry";
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDaysUntilExpiry(expirationDate: string | undefined): number | null {
	if (!expirationDate) return null;
	const expDate = new Date(expirationDate);
	const now = new Date();
	return Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getCertificationStatus(cert: NonNullable<Personnel["certifications"]>[number]): "active" | "expiring" | "expired" | "no_expiry" {
	if (cert.status === "expired") return "expired";

	const days = getDaysUntilExpiry(cert.expirationDate);
	if (days === null) return "no_expiry";
	if (days <= 0) return "expired";
	if (days <= 90) return "expiring";
	return "active";
}

function getStatusBadge(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle } {
	switch (status) {
		case "active":
			return { label: "Active", variant: "default", icon: CheckCircle };
		case "expiring":
			return { label: "Expiring Soon", variant: "secondary", icon: AlertTriangle };
		case "expired":
			return { label: "Expired", variant: "destructive", icon: XCircle };
		case "no_expiry":
			return { label: "No Expiry", variant: "outline", icon: CheckCircle };
		default:
			return { label: "Unknown", variant: "outline", icon: Clock };
	}
}

function formatDate(date: string | undefined): string {
	if (!date) return "N/A";
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

// ============================================================================
// Sub-Components
// ============================================================================

function CertificationStatsCard({
	title,
	value,
	icon: Icon,
	iconColor,
	description,
}: {
	title: string;
	value: number;
	icon: typeof Award;
	iconColor: string;
	description: string;
}) {
	return (
		<Card>
			<CardContent className="py-4">
				<div className="flex items-center gap-3">
					<div className={cn("p-2 rounded-full", iconColor)}>
						<Icon className="h-5 w-5" />
					</div>
					<div>
						<p className="text-2xl font-bold">{value}</p>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function CertificationRow({
	item,
	onSendReminder,
	onEdit,
}: {
	item: CertificationWithOwner;
	onSendReminder?: () => void;
	onEdit?: () => void;
}) {
	const statusBadge = getStatusBadge(item.status);
	const StatusIcon = statusBadge.icon;

	return (
		<TableRow>
			<TableCell>
				<div className="flex items-center gap-2">
					<Avatar className="h-8 w-8">
						<AvatarFallback className="text-xs">
							{item.personnel.firstName.charAt(0)}{item.personnel.lastName.charAt(0)}
						</AvatarFallback>
					</Avatar>
					<div>
						<p className="font-medium">
							{item.personnel.firstName} {item.personnel.lastName}
						</p>
						<p className="text-xs text-muted-foreground">
							{item.personnel.currentTitle}
						</p>
					</div>
				</div>
			</TableCell>
			<TableCell>
				<div>
					<p className="font-medium">{item.certification.name}</p>
					<p className="text-xs text-muted-foreground">{item.certification.issuer}</p>
				</div>
			</TableCell>
			<TableCell>
				<Badge variant={statusBadge.variant} className="gap-1">
					<StatusIcon className="h-3 w-3" />
					{statusBadge.label}
				</Badge>
			</TableCell>
			<TableCell>
				{formatDate(item.certification.dateObtained)}
			</TableCell>
			<TableCell>
				<div className={cn(
					item.status === "expiring" && "text-yellow-600 font-medium",
					item.status === "expired" && "text-red-600 font-medium"
				)}>
					{item.certification.expirationDate
						? formatDate(item.certification.expirationDate)
						: "Never"
					}
					{item.daysUntilExpiry !== null && item.daysUntilExpiry > 0 && item.daysUntilExpiry <= 90 && (
						<p className="text-xs">({item.daysUntilExpiry} days)</p>
					)}
				</div>
			</TableCell>
			<TableCell>
				<code className="text-xs bg-muted px-2 py-1 rounded">
					{item.certification.certificationNumber || "N/A"}
				</code>
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-1">
					{onSendReminder && item.status === "expiring" && (
						<Button variant="ghost" size="sm" onClick={onSendReminder}>
							<Mail className="h-4 w-4" />
						</Button>
					)}
					{onEdit && (
						<Button variant="ghost" size="sm" onClick={onEdit}>
							<Edit className="h-4 w-4" />
						</Button>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function CertificationTracker({
	personnel,
	onSendReminder,
	onUpdateCertification,
	className,
}: CertificationTrackerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [certTypeFilter, setCertTypeFilter] = useState<string>("all");

	// Flatten all certifications with owner info
	const allCertifications = useMemo(() => {
		const certs: CertificationWithOwner[] = [];

		personnel.forEach(person => {
			(person.certifications || []).forEach((cert, index) => {
				const days = getDaysUntilExpiry(cert.expirationDate);
				certs.push({
					personnel: person,
					certification: cert,
					certIndex: index,
					daysUntilExpiry: days,
					status: getCertificationStatus(cert),
				});
			});
		});

		return certs;
	}, [personnel]);

	// Get unique certification types
	const certTypes = useMemo(() => {
		const types = new Set<string>();
		allCertifications.forEach(c => types.add(c.certification.name));
		return Array.from(types).sort();
	}, [allCertifications]);

	// Filter certifications
	const filteredCertifications = useMemo(() => {
		return allCertifications.filter(item => {
			// Status filter
			if (statusFilter !== "all" && item.status !== statusFilter) return false;

			// Type filter
			if (certTypeFilter !== "all" && item.certification.name !== certTypeFilter) return false;

			// Search
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const nameMatch = `${item.personnel.firstName} ${item.personnel.lastName}`.toLowerCase().includes(query);
				const certMatch = item.certification.name.toLowerCase().includes(query);
				const issuerMatch = item.certification.issuer.toLowerCase().includes(query);
				if (!nameMatch && !certMatch && !issuerMatch) return false;
			}

			return true;
		});
	}, [allCertifications, statusFilter, certTypeFilter, searchQuery]);

	// Sort by urgency
	const sortedCertifications = useMemo(() => {
		return [...filteredCertifications].sort((a, b) => {
			// Expired first, then expiring, then active
			const statusOrder = { expired: 0, expiring: 1, active: 2, no_expiry: 3 };
			if (statusOrder[a.status] !== statusOrder[b.status]) {
				return statusOrder[a.status] - statusOrder[b.status];
			}
			// Within same status, sort by days until expiry
			if (a.daysUntilExpiry !== null && b.daysUntilExpiry !== null) {
				return a.daysUntilExpiry - b.daysUntilExpiry;
			}
			return 0;
		});
	}, [filteredCertifications]);

	// Stats
	const stats = useMemo(() => {
		const total = allCertifications.length;
		const active = allCertifications.filter(c => c.status === "active" || c.status === "no_expiry").length;
		const expiring = allCertifications.filter(c => c.status === "expiring").length;
		const expired = allCertifications.filter(c => c.status === "expired").length;
		const personnelWithCerts = new Set(allCertifications.map(c => c.personnel.id)).size;

		return { total, active, expiring, expired, personnelWithCerts };
	}, [allCertifications]);

	// Upcoming expirations (next 30 days)
	const upcomingExpirations = useMemo(() => {
		return allCertifications
			.filter(c => c.daysUntilExpiry !== null && c.daysUntilExpiry > 0 && c.daysUntilExpiry <= 30)
			.sort((a, b) => (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0));
	}, [allCertifications]);

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<Award className="h-6 w-6" />
						Certification Tracker
					</h2>
					<p className="text-muted-foreground">
						Monitor certification status and expiration dates
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline">
						<Download className="h-4 w-4 mr-2" />
						Export Report
					</Button>
					<Button variant="outline">
						<Bell className="h-4 w-4 mr-2" />
						Configure Alerts
					</Button>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-5 gap-4">
				<CertificationStatsCard
					title="Total Certifications"
					value={stats.total}
					icon={Award}
					iconColor="bg-blue-100 text-blue-600"
					description="Total certifications"
				/>
				<CertificationStatsCard
					title="Active"
					value={stats.active}
					icon={CheckCircle}
					iconColor="bg-green-100 text-green-600"
					description="Valid certifications"
				/>
				<CertificationStatsCard
					title="Expiring Soon"
					value={stats.expiring}
					icon={AlertTriangle}
					iconColor="bg-yellow-100 text-yellow-600"
					description="Within 90 days"
				/>
				<CertificationStatsCard
					title="Expired"
					value={stats.expired}
					icon={XCircle}
					iconColor="bg-red-100 text-red-600"
					description="Need renewal"
				/>
				<CertificationStatsCard
					title="Personnel"
					value={stats.personnelWithCerts}
					icon={Users}
					iconColor="bg-purple-100 text-purple-600"
					description="With certifications"
				/>
			</div>

			{/* Urgent Alerts */}
			{upcomingExpirations.length > 0 && (
				<Card className="border-yellow-200 bg-yellow-50">
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2 text-yellow-800">
							<AlertTriangle className="h-5 w-5" />
							Expiring in the Next 30 Days ({upcomingExpirations.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-3">
							{upcomingExpirations.slice(0, 5).map((item, i) => (
								<div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-yellow-200">
									<Avatar className="h-6 w-6">
										<AvatarFallback className="text-xs">
											{item.personnel.firstName.charAt(0)}{item.personnel.lastName.charAt(0)}
										</AvatarFallback>
									</Avatar>
									<div className="text-sm">
										<span className="font-medium">{item.certification.name}</span>
										<span className="text-muted-foreground"> - </span>
										<span>{item.personnel.firstName} {item.personnel.lastName}</span>
										<Badge variant="outline" className="ml-2 text-xs text-yellow-700">
											{item.daysUntilExpiry} days
										</Badge>
									</div>
								</div>
							))}
							{upcomingExpirations.length > 5 && (
								<Badge variant="outline" className="text-yellow-700">
									+{upcomingExpirations.length - 5} more
								</Badge>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Filters */}
			<div className="flex items-center gap-4">
				<div className="flex-1">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name, certification, or issuer..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>

				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="expiring">Expiring</SelectItem>
						<SelectItem value="expired">Expired</SelectItem>
						<SelectItem value="no_expiry">No Expiry</SelectItem>
					</SelectContent>
				</Select>

				<Select value={certTypeFilter} onValueChange={setCertTypeFilter}>
					<SelectTrigger className="w-48">
						<SelectValue placeholder="Certification" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Certifications</SelectItem>
						{certTypes.map(type => (
							<SelectItem key={type} value={type}>{type}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Certification Table */}
			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Personnel</TableHead>
								<TableHead>Certification</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Obtained</TableHead>
								<TableHead>Expires</TableHead>
								<TableHead>Number</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sortedCertifications.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
										No certifications found
									</TableCell>
								</TableRow>
							) : (
								sortedCertifications.map((item, i) => (
									<CertificationRow
										key={`${item.personnel.id}-${item.certIndex}`}
										item={item}
										onSendReminder={onSendReminder ? () => onSendReminder(item.personnel.id, item.certification.name) : undefined}
										onEdit={onUpdateCertification ? () => {} : undefined}
									/>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Results count */}
			<p className="text-sm text-muted-foreground text-center">
				Showing {sortedCertifications.length} of {allCertifications.length} certifications
			</p>
		</div>
	);
}

export default CertificationTracker;
