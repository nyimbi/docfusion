"use client";

import * as React from "react";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dropdown context for managing open state and positioning.
 */
interface DropdownContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
	const context = React.useContext(DropdownContext);
	if (!context) {
		throw new Error("Dropdown components must be used within a DropdownMenu");
	}
	return context;
}

/**
 * Dropdown menu root component.
 *
 * @example
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild>
 *     <Button variant="secondary">Open Menu</Button>
 *   </DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuLabel>My Account</DropdownMenuLabel>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem>Profile</DropdownMenuItem>
 *     <DropdownMenuItem>Settings</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem>Log out</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 */
interface DropdownMenuProps {
	children: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

function DropdownMenu({
	children,
	open: controlledOpen,
	onOpenChange,
}: DropdownMenuProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
	const triggerRef = React.useRef<HTMLButtonElement | null>(null);

	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : uncontrolledOpen;

	const setOpen = React.useCallback(
		(newOpen: boolean) => {
			if (isControlled) {
				onOpenChange?.(newOpen);
			} else {
				setUncontrolledOpen(newOpen);
			}
		},
		[isControlled, onOpenChange]
	);

	// Close on click outside
	React.useEffect(() => {
		if (!open) return;

		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			if (triggerRef.current && !triggerRef.current.contains(target)) {
				setOpen(false);
			}
		};

		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, [open, setOpen]);

	// Close on escape
	React.useEffect(() => {
		if (!open) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, setOpen]);

	return (
		<DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
			<div className="relative inline-block">{children}</div>
		</DropdownContext.Provider>
	);
}

/**
 * Button that toggles the dropdown menu.
 */
interface DropdownMenuTriggerProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

const DropdownMenuTrigger = React.forwardRef<
	HTMLButtonElement,
	DropdownMenuTriggerProps
>(({ asChild, children, ...props }, forwardedRef) => {
	const { open, setOpen, triggerRef } = useDropdownContext();

	const setRef = React.useCallback(
		(node: HTMLButtonElement | null) => {
			// Update internal ref
			(triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
			// Update forwarded ref
			if (typeof forwardedRef === "function") {
				forwardedRef(node);
			} else if (forwardedRef) {
				(forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
			}
		},
		[forwardedRef, triggerRef]
	);

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		setOpen(!open);
		props.onClick?.(e);
	};

	if (asChild && React.isValidElement(children)) {
		const childProps = {
			ref: setRef,
			onClick: handleClick,
			"aria-expanded": open,
			"aria-haspopup": "menu" as const,
		};
		return React.cloneElement(children, childProps as React.Attributes);
	}

	return (
		<button
			ref={setRef}
			type="button"
			onClick={handleClick}
			aria-expanded={open}
			aria-haspopup="menu"
			{...props}
		>
			{children}
		</button>
	);
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/**
 * The dropdown menu content container.
 */
interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

const DropdownMenuContent = React.forwardRef<
	HTMLDivElement,
	DropdownMenuContentProps
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
	const { open } = useDropdownContext();

	if (!open) return null;

	const alignClasses = {
		start: "left-0",
		center: "left-1/2 -translate-x-1/2",
		end: "right-0",
	};

	return (
		<div
			ref={ref}
			role="menu"
			className={cn(
				"absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md",
				"animate-in fade-in-0 zoom-in-95",
				"dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
				alignClasses[align],
				className
			)}
			style={{ top: `calc(100% + ${sideOffset}px)` }}
			{...props}
		/>
	);
});
DropdownMenuContent.displayName = "DropdownMenuContent";

/**
 * A clickable menu item.
 */
interface DropdownMenuItemProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	inset?: boolean;
	asChild?: boolean;
}

const DropdownMenuItem = React.forwardRef<
	HTMLButtonElement,
	DropdownMenuItemProps
>(({ className, inset, asChild, children, ...props }, ref) => {
	const { setOpen } = useDropdownContext();

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		props.onClick?.(e);
		setOpen(false);
	};

	const itemClassName = cn(
		"relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
		"hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900",
		"dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus:bg-gray-800 dark:focus:text-gray-50",
		"disabled:pointer-events-none disabled:opacity-50",
		inset && "pl-8",
		className
	);

	// If asChild is true and children is a valid element, clone it with props
	if (asChild && React.isValidElement(children)) {
		return React.cloneElement(children, {
			className: cn(itemClassName, (children.props as { className?: string }).className),
			role: "menuitem",
			onClick: (e: React.MouseEvent) => {
				(children.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
				setOpen(false);
			},
		} as React.Attributes);
	}

	return (
		<button
			ref={ref}
			type="button"
			role="menuitem"
			className={itemClassName}
			onClick={handleClick}
			{...props}
		>
			{children}
		</button>
	);
});
DropdownMenuItem.displayName = "DropdownMenuItem";

/**
 * A checkable menu item.
 */
interface DropdownMenuCheckboxItemProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}

const DropdownMenuCheckboxItem = React.forwardRef<
	HTMLButtonElement,
	DropdownMenuCheckboxItemProps
>(({ className, children, checked, onCheckedChange, ...props }, ref) => {
	return (
		<button
			ref={ref}
			type="button"
			role="menuitemcheckbox"
			aria-checked={checked}
			className={cn(
				"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
				"hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900",
				"dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus:bg-gray-800 dark:focus:text-gray-50",
				"disabled:pointer-events-none disabled:opacity-50",
				className
			)}
			onClick={() => onCheckedChange?.(!checked)}
			{...props}
		>
			<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
				{checked && <Check className="h-4 w-4" />}
			</span>
			{children}
		</button>
	);
});
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

/**
 * A radio group item.
 */
interface DropdownMenuRadioItemProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	checked?: boolean;
}

const DropdownMenuRadioItem = React.forwardRef<
	HTMLButtonElement,
	DropdownMenuRadioItemProps
>(({ className, children, checked, ...props }, ref) => (
	<button
		ref={ref}
		type="button"
		role="menuitemradio"
		aria-checked={checked}
		className={cn(
			"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
			"hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900",
			"dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus:bg-gray-800 dark:focus:text-gray-50",
			"disabled:pointer-events-none disabled:opacity-50",
			className
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			{checked && <Circle className="h-2 w-2 fill-current" />}
		</span>
		{children}
	</button>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

/**
 * A label for grouping menu items.
 */
const DropdownMenuLabel = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"px-2 py-1.5 text-sm font-semibold",
			inset && "pl-8",
			className
		)}
		{...props}
	/>
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

/**
 * A visual separator between menu items.
 */
const DropdownMenuSeparator = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-800", className)}
		{...props}
	/>
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

/**
 * Keyboard shortcut displayed alongside menu item.
 */
const DropdownMenuShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
			{...props}
		/>
	);
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

/**
 * Group for radio items.
 */
interface DropdownMenuRadioGroupProps {
	children: React.ReactNode;
	value?: string;
	onValueChange?: (value: string) => void;
}

function DropdownMenuRadioGroup({
	children,
	value,
	onValueChange,
}: DropdownMenuRadioGroupProps) {
	return (
		<div role="group">
			{React.Children.map(children, (child) => {
				if (React.isValidElement<DropdownMenuRadioItemProps & { value?: string }>(child)) {
					const childValue = child.props.value;
					return React.cloneElement(child, {
						checked: childValue === value,
						onClick: () => childValue && onValueChange?.(childValue),
					});
				}
				return child;
			})}
		</div>
	);
}

/**
 * Submenu trigger with arrow indicator.
 */
const DropdownMenuSubTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
	<button
		ref={ref}
		type="button"
		className={cn(
			"flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
			"hover:bg-gray-100 focus:bg-gray-100",
			"dark:hover:bg-gray-800 dark:focus:bg-gray-800",
			inset && "pl-8",
			className
		)}
		{...props}
	>
		{children}
		<ChevronRight className="ml-auto h-4 w-4" />
	</button>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

/**
 * Container for submenu content.
 */
const DropdownMenuSubContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-lg",
			"dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
			className
		)}
		{...props}
	/>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

/**
 * General group container.
 */
const DropdownMenuGroup = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => <div ref={ref} role="group" {...props} />);
DropdownMenuGroup.displayName = "DropdownMenuGroup";

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuRadioGroup,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
};
