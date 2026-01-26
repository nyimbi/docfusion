/**
 * Checkbox component for DocFusion.
 *
 * A controlled checkbox input with support for
 * indeterminate state and custom styling.
 */

"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checkbox component props.
 */
export interface CheckboxProps
	extends Omit<
		React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
		"checked"
	> {
	/** Checked state - true, false, or "indeterminate" */
	checked?: boolean | "indeterminate";
	/** Label for the checkbox */
	label?: string;
	/** Description text below the label */
	description?: string;
}

/**
 * Checkbox component.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * // With label
 * <Checkbox label="Accept terms" />
 *
 * // With label and description
 * <Checkbox
 *   label="Email notifications"
 *   description="Receive email updates about your documents"
 * />
 *
 * // Indeterminate state (for parent checkbox in a group)
 * <Checkbox checked="indeterminate" />
 * ```
 */
const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	CheckboxProps
>(({ className, checked, label, description, id, ...props }, ref) => {
	const checkboxId = id ?? React.useId();

	// Convert boolean/indeterminate to Radix's expected type
	const checkedState = checked === "indeterminate" ? "indeterminate" : checked;

	const checkbox = (
		<CheckboxPrimitive.Root
			ref={ref}
			id={checkboxId}
			checked={checkedState}
			className={cn(
				"peer h-4 w-4 shrink-0 rounded border border-gray-300 dark:border-gray-600",
				"ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white",
				"data-[state=indeterminate]:bg-blue-600 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:text-white",
				"dark:ring-offset-gray-950 dark:focus-visible:ring-blue-400",
				"dark:data-[state=checked]:bg-blue-500 dark:data-[state=checked]:border-blue-500",
				"dark:data-[state=indeterminate]:bg-blue-500 dark:data-[state=indeterminate]:border-blue-500",
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className={cn("flex items-center justify-center text-current")}
			>
				{checkedState === "indeterminate" ? (
					<Minus className="h-3 w-3" />
				) : (
					<Check className="h-3 w-3" />
				)}
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);

	// If no label, return just the checkbox
	if (!label) {
		return checkbox;
	}

	// Return checkbox with label
	return (
		<div className="flex items-start gap-3">
			{checkbox}
			<div className="grid gap-1.5 leading-none">
				<label
					htmlFor={checkboxId}
					className="text-sm font-medium leading-none text-gray-900 dark:text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
				>
					{label}
				</label>
				{description && (
					<p className="text-sm text-gray-500 dark:text-gray-400">
						{description}
					</p>
				)}
			</div>
		</div>
	);
});

Checkbox.displayName = "Checkbox";

/**
 * Checkbox group component for managing multiple related checkboxes.
 */
export interface CheckboxGroupProps {
	/** Label for the group */
	label?: string;
	/** Description text */
	description?: string;
	/** Error message */
	error?: string;
	/** Children checkboxes */
	children: React.ReactNode;
	/** Orientation of the group */
	orientation?: "horizontal" | "vertical";
	/** Optional className */
	className?: string;
}

/**
 * Checkbox group component.
 *
 * @example
 * ```tsx
 * <CheckboxGroup label="Notifications" orientation="vertical">
 *   <Checkbox label="Email" />
 *   <Checkbox label="SMS" />
 *   <Checkbox label="Push" />
 * </CheckboxGroup>
 * ```
 */
function CheckboxGroup({
	label,
	description,
	error,
	children,
	orientation = "vertical",
	className,
}: CheckboxGroupProps) {
	return (
		<div className={cn("space-y-3", className)} role="group" aria-label={label}>
			{label && (
				<div className="space-y-1">
					<span className="text-sm font-medium text-gray-900 dark:text-white">
						{label}
					</span>
					{description && (
						<p className="text-sm text-gray-500 dark:text-gray-400">
							{description}
						</p>
					)}
				</div>
			)}
			<div
				className={cn(
					orientation === "horizontal"
						? "flex flex-wrap items-center gap-4"
						: "space-y-2"
				)}
			>
				{children}
			</div>
			{error && (
				<p className="text-sm text-red-500 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

export { Checkbox, CheckboxGroup };
