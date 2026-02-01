/**
 * CRM Server Actions Index
 *
 * Re-exports all CRM-related server actions for convenient imports.
 */

// Account operations
export {
	createAccount,
	updateAccount,
	deleteAccount,
	getAccount,
	getAccountWithRelations,
	getAccounts,
	getPartners,
	getProspects,
	getLeads,
	getCustomers,
	getVendors,
	updateAccountStage,
	convertLeadToCustomer,
	convertProspectToLead,
	getAccountStats,
	getAccountsByRegion,
	getPipelineMetrics,
	searchAccounts,
	getAccountsNeedingFollowup,
	bulkUpdateAccountOwner,
	bulkAddAccountTags,
	getCRMDashboardStats,
	type CRMDashboardStats,
} from "./accounts";

// Contact operations
export {
	createContact,
	updateContact,
	deleteContact,
	getContact,
	getContactWithRelations,
	getContacts,
	getAccountContacts,
	getPrimaryContact,
	importContacts,
	bulkAddContactTags,
	bulkDeleteContacts,
	moveContactsToAccount,
	searchContacts,
	findContactByEmail,
	getContactsNeedingFollowup,
	recordContactInteraction,
	getContactRoleCounts,
} from "./contacts";

// Activity operations
export {
	createActivity,
	updateActivity,
	deleteActivity,
	getActivity,
	getActivityWithRelations,
	getAccountTimeline,
	getContactTimeline,
	getDealTimeline,
	getUpcomingTasks,
	getOverdueTasks,
	getActivitiesNeedingFollowup,
	completeActivity,
	rescheduleActivity,
	cancelActivity,
	getActivityStats,
	getActivityCountsByUser,
	logNote,
	logEmail,
	logCall,
	scheduleMeeting,
	createTask,
} from "./activities";

// Deal operations
export {
	createDeal,
	updateDeal,
	deleteDeal,
	getDeal,
	getDealWithRelations,
	getDeals,
	getAccountDeals,
	updateDealStage,
	markDealWon,
	markDealLost,
	putDealOnHold,
	reactivateDeal,
	getDealPipelineValue,
	getDealForecast,
	getWinLossAnalysis,
	getDealsClosingSoon,
	getOverdueDeals,
	searchDeals,
	bulkUpdateDealOwner,
	cloneDeal,
} from "./deals";

// Document operations
export {
	uploadDocument,
	updateDocument,
	deleteDocument,
	getDocument,
	getAccountDocuments,
	getContactDocuments,
	getDealDocuments,
	getActivityDocuments,
	getExpiringDocuments,
	getExpiredDocuments,
	uploadNewVersion,
	getDocumentVersionHistory,
	searchDocuments,
	getDocumentTypeCounts,
	getAccountStorageUsage,
	bulkDeleteDocuments,
	moveDocument,
	copyDocument,
} from "./documents";

// Account research operations
export {
	researchAccount,
	saveResearchFindings,
	getResearchQueries,
	type ResearchCategory,
	type ResearchRequest,
	type ResearchResult,
	type ResearchItem,
	type AccountResearchResponse,
	type AccountUpdateSuggestion,
} from "./account-research";
