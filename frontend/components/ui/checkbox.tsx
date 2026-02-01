/**
 * Checkbox Component - DocFusion Design System
 * "Ink & Paper" Editorial Elegance
 *
 * A controlled checkbox input with support for indeterminate state
 * and consistent styling following the design system.
 */

"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * // Basic usage
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * @example
 * // With label
 * <Checkbox label="Accept terms" />
 *
 * @example
 * // Indeterminate state (for parent checkbox in a group)
 * <Checkbox checked="indeterminate" />
 */
const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	CheckboxProps
>(function Checkbox({ className, checked, label, description, id, ...props }, ref) {
	const checkboxId = id ?? React.useId();

	// Convert boolean/indeterminate to Radix's expected type
	const checkedState = checked === "indeterminate" ? "indeterminate" : checked;

	// Memoize checkbox classes for performance
	const checkboxClasses = React.useMemo(
		() =>
			cn(
				// Base styles
				"peer h-4 w-4 shrink-0 rounded border border-input",
				"bg-background ring-offset-background",
			
				// Focus states
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				// Disabled state
				"disabled:cursor-not-allowed disabled:opacity-50",

				// Checked states - using design system colors
				"data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
				"data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground",

				// Transition
				"transition-all duration-150 ease-out",

				className
			),
		[className]
	);

	// Icon based on checked state
	const Icon = checkedState === "indeterminate" ? Minus : Check;

	const checkbox = (
		<CheckboxPrimitive.Root
			ref={ref}
			id={checkboxId}
			checked={checkedState}
			className={checkboxClasses}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className={cn("flex items-center justify-center text-current")}
			>
				<Icon className="h-3 w-3" />
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
					className="text-sm font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
				>
					{label}
				</label>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
		</div>
	);
});

Checkbox.displayName = "Checkbox";

/**
 * CheckboxGroup Props
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
 * Checkbox group component for managing multiple related checkboxes.
 *
 * @example
 * <CheckboxGroup label="Notifications" orientation="vertical">
 *   <Checkbox label="Email" />
 *   <Checkbox label="SMS" />
 *   <Checkbox label="Push" />
 * </CheckboxGroup>
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
		<div
			className={cn("space-y-3", className)}
			role="group"
			aria-label={label}
		>
			{label && (
				<div className="space-y-1">
					<span className="text-sm font-medium text-foreground">
						{label}
					</span>
					{description && (
						<p className="text-sm text-muted-foreground">{description}</p>
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
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
}

/**
 * Props for IndeterminateCheckbox
 */
interface IndeterminateCheckboxProps extends CheckboxProps {
	/** Total items in the group */
	total: number;
	/** Number of checked items */
	checkedCount: number;
}

/**
 * Checkbox with indeterminate state management.
 * Useful for parent checkboxes that control a group.
 *
 * @example
 * <IndeterminateCheckbox
 *   total={items.length}
 *   checkedCount={selectedItems.length}
 *   onCheckedChange={handleSelectAll}
 * />
 */
const IndeterminateCheckbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	IndeterminateCheckboxProps
>(
	function IndeterminateCheckbox(
		{ total, checkedCount, checked, onCheckedChange, ...props },
		ref
	) {
	// Determine checked state based on checkedCount
	const computedChecked = React.useMemo(() => {
		if (checked !== undefined) return checked;
		if (checkedCount === 0) return false;
		if (checkedCount === total) return true;
		return "indeterminate";
	}, [checked, checkedCount, total]);

	return (
		<Checkbox
			ref={ref}
			checked={computedChecked}
			onCheckedChange={onCheckedChange}
			{...props}
		/>
	);
}
);

IndeterminateCheckbox.displayName = "IndeterminateCheckbox";

export {
	Checkbox,
	CheckboxGroup,
	IndeterminateCheckbox,
};
