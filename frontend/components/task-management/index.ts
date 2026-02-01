/**
 * Task Management Components - DocFusion
 *
 * Comprehensive task management system for proposal development.
 * Includes visual boards, workload tracking, AI-powered assignment,
 * and progress monitoring.
 */

// Core task display components
export { TaskCard } from "./TaskCard";
export type { TaskCardProps } from "./TaskCard";

export { TaskList } from "./TaskList";
export type { TaskListProps, TaskListFilters } from "./TaskList";

export { TaskBoard } from "./TaskBoard";
export type { TaskBoardProps } from "./TaskBoard";

export { TaskEditor } from "./TaskEditor";
export type { TaskEditorProps } from "./TaskEditor";

// AI-powered features
export { AssignmentSuggester } from "./AssignmentSuggester";
export type {
	AssignmentSuggesterProps,
	AssignmentSuggestion,
} from "./AssignmentSuggester";

export { TaskGenerator } from "./TaskGenerator";
export type { TaskGeneratorProps } from "./TaskGenerator";

// Workload management
export { WorkloadDashboard } from "./WorkloadDashboard";
export type { WorkloadDashboardProps } from "./WorkloadDashboard";

export { WorkloadHeatMap } from "./WorkloadHeatMap";
export type { WorkloadHeatMapProps } from "./WorkloadHeatMap";

// Progress and monitoring
export { CriticalPathView } from "./CriticalPathView";
export type { CriticalPathViewProps } from "./CriticalPathView";

export { BottleneckAlerts } from "./BottleneckAlerts";
export type {
	BottleneckAlertsProps,
	Bottleneck,
	BottleneckType,
	BottleneckSeverity,
} from "./BottleneckAlerts";

export { ProgressTracker } from "./ProgressTracker";
export type { ProgressTrackerProps } from "./ProgressTracker";
