/**
 * Shared CRM Components
 *
 * Re-exports all shared components used across the CRM module.
 */

export { StageIndicator, StagePipeline } from "./StageIndicator";
export {
	LeadScoreBadge,
	HealthScoreBadge,
	FitScoreBadge,
	PartnerTierBadge,
} from "./ScoreBadge";
export { QuickActions, InlineActions } from "./QuickActions";
export {
	AccountTypeBadge,
	ActivityTypeBadge,
	getAccountTypeIcon,
	getActivityTypeIcon,
} from "./TypeBadge";
