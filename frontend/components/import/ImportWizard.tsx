"use client";

/**
 * Import Wizard Component
 *
 * Multi-step wizard container for universal data import.
 * Manages step navigation, state persistence, and orchestrates
 * the import flow from file upload through results display.
 *
 * Features:
 * - 6-step wizard flow: Upload → Target → Mapping → Preview → Options → Results
 * - Visual step indicator with progress tracking
 * - Keyboard navigation support (arrow keys)
 * - Responsive layout with scrollable content area
 * - Error boundary with graceful recovery
 */

import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	useImportStore,
	useCurrentStep,
	useCanProceed,
	useCanGoBack,
	useImportResult,
} from "@/lib/stores/import-store";
import { FileUploadStep } from "./steps/FileUploadStep";
import { TableSelectStep } from "./steps/TableSelectStep";
import { ColumnMappingStep } from "./steps/ColumnMappingStep";
import { DataPreviewStep } from "./steps/DataPreviewStep";
import { ImportOptionsStep } from "./steps/ImportOptionsStep";
import { ImportResultsStep } from "./steps/ImportResultsStep";
import type { WizardStep } from "@/lib/types/import";
import {
	Upload,
	Database,
	GitMerge,
	Eye,
	Settings,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	RotateCcw,
} from "lucide-react";

/**
 * Step configuration for the wizard.
 * Defines metadata, icons, and validation for each step.
 */
const WIZARD_STEPS: {
	id: WizardStep;
	label: string;
	shortLabel: string;
	icon: React.ComponentType<{ className?: string }>;
	description: string;
}[] = [
	{
		id: "upload",
		label: "Upload File",
		shortLabel: "Upload",
		icon: Upload,
		description: "Select an Excel or CSV file to import",
	},
	{
		id: "target",
		label: "Select Target",
		shortLabel: "Target",
		icon: Database,
		description: "Choose the destination table for your data",
	},
	{
		id: "mapping",
		label: "Map Columns",
		shortLabel: "Mapping",
		icon: GitMerge,
		description: "Configure how source columns map to target fields",
	},
	{
		id: "preview",
		label: "Preview Data",
		shortLabel: "Preview",
		icon: Eye,
		description: "Review transformed data and validation results",
	},
	{
		id: "options",
		label: "Import Options",
		shortLabel: "Options",
		icon: Settings,
		description: "Configure import behavior and save templates",
	},
	{
		id: "results",
		label: "Results",
		shortLabel: "Results",
		icon: CheckCircle2,
		description: "View import summary and statistics",
	},
];

/**
 * Get the numeric index of a step
 */
function getStepIndex(step: WizardStep): number {
	return WIZARD_STEPS.findIndex((s) => s.id === step);
}

/**
 * Props for the ImportWizard component
 */
interface ImportWizardProps {
	/** Callback when import completes successfully */
	onComplete?: () => void;
	/** Callback when wizard is cancelled/closed */
	onCancel?: () => void;
	/** Additional CSS classes */
	className?: string;
	/** Whether wizard is embedded in a dialog */
	isDialog?: boolean;
}

/**
 * Main import wizard component.
 * Orchestrates the multi-step import flow with visual progress tracking.
 */
export function ImportWizard({
	onComplete,
	onCancel,
	className,
	isDialog = false,
}: ImportWizardProps) {
	const currentStep = useCurrentStep();
	const canProceed = useCanProceed();
	const canGoBack = useCanGoBack();
	const importResult = useImportResult();

	const {
		nextStep,
		previousStep,
		goToStep,
		reset,
	} = useImportStore();

	const currentStepIndex = getStepIndex(currentStep);
	const currentStepConfig = WIZARD_STEPS[currentStepIndex];

	/**
	 * Handle navigation to next step
	 */
	const handleNext = useCallback(() => {
		if (canProceed) {
			nextStep();
		}
	}, [canProceed, nextStep]);

	/**
	 * Handle navigation to previous step
	 */
	const handleBack = useCallback(() => {
		if (canGoBack) {
			previousStep();
		}
	}, [canGoBack, previousStep]);

	/**
	 * Handle wizard reset (start over)
	 */
	const handleReset = useCallback(() => {
		reset();
	}, [reset]);

	/**
	 * Handle wizard completion
	 */
	const handleComplete = useCallback(() => {
		if (onComplete) {
			onComplete();
		}
		reset();
	}, [onComplete, reset]);

	/**
	 * Handle wizard cancellation
	 */
	const handleCancel = useCallback(() => {
		if (onCancel) {
			onCancel();
		}
		reset();
	}, [onCancel, reset]);

	/**
	 * Keyboard navigation support
	 */
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't interfere with input fields
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				e.target instanceof HTMLSelectElement
			) {
				return;
			}

			switch (e.key) {
				case "ArrowRight":
					if (canProceed && currentStep !== "results") {
						handleNext();
					}
					break;
				case "ArrowLeft":
					if (canGoBack) {
						handleBack();
					}
					break;
				case "Escape":
					if (!isDialog) {
						handleCancel();
					}
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [canProceed, canGoBack, currentStep, handleNext, handleBack, handleCancel, isDialog]);

	/**
	 * Render step content based on current step
	 */
	const renderStepContent = () => {
		switch (currentStep) {
			case "upload":
				return <FileUploadStep />;
			case "target":
				return <TableSelectStep />;
			case "mapping":
				return <ColumnMappingStep />;
			case "preview":
				return <DataPreviewStep />;
			case "options":
				return <ImportOptionsStep />;
			case "results":
				return <ImportResultsStep />;
			default:
				return <FileUploadStep />;
		}
	};

	return (
		<div
			className={cn(
				"flex flex-col h-full bg-background",
				isDialog ? "min-h-[600px]" : "min-h-screen",
				className
			)}
		>
			{/* Header with Step Indicator */}
			<div className="flex-shrink-0 border-b bg-muted/30">
				{/* Step Progress Bar */}
				<div className="px-6 pt-6 pb-4">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold tracking-tight">
							{currentStepConfig.label}
						</h2>
						<span className="text-sm text-muted-foreground">
							Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
						</span>
					</div>

					{/* Visual Step Indicator */}
					<div className="relative">
						{/* Progress Line */}
						<div className="absolute top-5 left-0 right-0 h-0.5 bg-border">
							<div
								className="h-full bg-primary transition-all duration-300 ease-out"
								style={{
									width: `${(currentStepIndex / (WIZARD_STEPS.length - 1)) * 100}%`,
								}}
							/>
						</div>

						{/* Step Dots */}
						<div className="relative flex justify-between">
							{WIZARD_STEPS.map((step, index) => {
								const isActive = index === currentStepIndex;
								const isComplete = index < currentStepIndex;
								const isAccessible = index <= currentStepIndex;
								const StepIcon = step.icon;

								return (
									<button
										key={step.id}
										type="button"
										onClick={() => isAccessible && goToStep(step.id)}
										disabled={!isAccessible}
										className={cn(
											"relative flex flex-col items-center gap-2 transition-all",
											isAccessible ? "cursor-pointer" : "cursor-not-allowed opacity-50"
										)}
										aria-label={`Go to ${step.label}`}
										aria-current={isActive ? "step" : undefined}
									>
										{/* Step Circle */}
										<div
											className={cn(
												"w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
												isComplete && "bg-primary border-primary text-primary-foreground",
												isActive && "bg-background border-primary ring-2 ring-primary/20",
												!isComplete && !isActive && "bg-muted border-border"
											)}
										>
											{isComplete ? (
												<CheckCircle2 className="h-5 w-5" />
											) : (
												<StepIcon className="h-5 w-5" />
											)}
										</div>

										{/* Step Label (hidden on mobile) */}
										<span
											className={cn(
												"hidden sm:block text-xs font-medium whitespace-nowrap",
												isActive && "text-primary",
												!isActive && "text-muted-foreground"
											)}
										>
											{step.shortLabel}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				{/* Step Description */}
				<div className="px-6 pb-4">
					<p className="text-sm text-muted-foreground">
						{currentStepConfig.description}
					</p>
				</div>
			</div>

			{/* Step Content */}
			<div className="flex-1 overflow-auto">
				<div className="p-6">
					{renderStepContent()}
				</div>
			</div>

			{/* Footer with Navigation */}
			<div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
				<div className="flex items-center justify-between">
					{/* Left Side Actions */}
					<div className="flex items-center gap-2">
						{currentStep === "results" ? (
							<Button
								variant="outline"
								onClick={handleReset}
								className="gap-2"
							>
								<RotateCcw className="h-4 w-4" />
								Import Another File
							</Button>
						) : (
							<Button
								variant="ghost"
								onClick={handleCancel}
							>
								Cancel
							</Button>
						)}
					</div>

					{/* Right Side Navigation */}
					<div className="flex items-center gap-2">
						{canGoBack && currentStep !== "results" && (
							<Button
								variant="outline"
								onClick={handleBack}
								className="gap-2"
							>
								<ChevronLeft className="h-4 w-4" />
								Back
							</Button>
						)}

						{currentStep === "results" ? (
							<Button
								onClick={handleComplete}
								className="gap-2"
							>
								<CheckCircle2 className="h-4 w-4" />
								Done
							</Button>
						) : currentStep === "options" ? (
							<Button
								onClick={handleNext}
								disabled={!canProceed}
								className="gap-2"
							>
								Start Import
								<ChevronRight className="h-4 w-4" />
							</Button>
						) : (
							<Button
								onClick={handleNext}
								disabled={!canProceed}
								className="gap-2"
							>
								Continue
								<ChevronRight className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default ImportWizard;
