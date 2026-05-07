"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

/**
 * Dialog context for managing open state.
 */
interface DialogContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
	const context = React.useContext(DialogContext);
	if (!context) {
		throw new Error("Dialog components must be used within a Dialog");
	}
	return context;
}

/**
 * Dialog ARIA context for title/description IDs.
 */
interface DialogAriaContextValue {
	titleId: string;
	descriptionId: string;
}

const DialogAriaContext = React.createContext<DialogAriaContextValue | null>(null);

function useDialogAriaContext() {
	return React.useContext(DialogAriaContext);
}

/**
 * Dialog root component.
 *
 * @example
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Dialog Title</DialogTitle>
 *       <DialogDescription>Dialog description text.</DialogDescription>
 *     </DialogHeader>
 *     <div>Content goes here</div>
 *     <DialogFooter>
 *       <Button>Save</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */
interface DialogProps {
	children: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

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

	return (
		<DialogContext.Provider value={{ open, setOpen }}>
			{children}
		</DialogContext.Provider>
	);
}

/**
 * Button that opens the dialog when clicked.
 */
interface DialogTriggerProps {
	children: React.ReactNode;
	asChild?: boolean;
}

function DialogTrigger({ children, asChild }: DialogTriggerProps) {
	const { setOpen } = useDialogContext();

	if (asChild && React.isValidElement(children)) {
		return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
			onClick: (e: React.MouseEvent<HTMLElement>) => {
				(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.onClick?.(e);
				setOpen(true);
			},
		});
	}

	return (
		<button type="button" onClick={() => setOpen(true)}>
			{children}
		</button>
	);
}

/**
 * The overlay/backdrop behind the dialog.
 */
const DialogOverlay = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
	const { setOpen } = useDialogContext();

	return (
		<div
			ref={ref}
			className={cn(
				"fixed inset-0 z-50 bg-black/80",
				"animate-in fade-in-0",
				className
			)}
			onClick={() => setOpen(false)}
			aria-hidden="true"
			{...props}
		/>
	);
});
DialogOverlay.displayName = "DialogOverlay";

/**
 * Close button that dismisses the dialog.
 */
function DialogClose({
	className,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const { setOpen } = useDialogContext();

	return (
		<button
			type="button"
			className={cn(
				"absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity",
				"hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2",
				"disabled:pointer-events-none",
				"dark:ring-offset-gray-950 dark:focus:ring-gray-300",
				className
			)}
			onClick={() => setOpen(false)}
			aria-label="Close"
			{...props}
		>
			<X className="h-4 w-4" />
		</button>
	);
}

/**
 * Portal that renders dialog content.
 */
function DialogPortal({ children }: { children: React.ReactNode }) {
	const { open } = useDialogContext();

	if (!open) return null;

	// Use document.body as portal target
	if (typeof document === "undefined") return null;

	return (
		<>
			{React.Children.map(children, (child) => child)}
		</>
	);
}

/**
 * The main dialog content container.
 */
interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Whether to show the close button */
	showClose?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
	({ className, children, showClose = true, ...props }, ref) => {
		const { setOpen } = useDialogContext();
		const containerRef = React.useRef<HTMLDivElement>(null);
		const titleId = React.useId();
		const descriptionId = React.useId();

		// Combine refs
		React.useImperativeHandle(ref, () => containerRef.current!);

		// Focus trap
		useFocusTrap(containerRef, { enabled: true, returnFocus: true });

		// Handle escape key
		React.useEffect(() => {
			const handleEscape = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					setOpen(false);
				}
			};

			document.addEventListener("keydown", handleEscape);
			return () => document.removeEventListener("keydown", handleEscape);
		}, [setOpen]);

		// Prevent body scroll when open
		React.useEffect(() => {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}, []);

		return (
			<DialogPortal>
				<DialogOverlay />
				<DialogAriaContext.Provider value={{ titleId, descriptionId }}>
					<div
						ref={containerRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						tabIndex={-1}
						className={cn(
						"fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
						"gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200",
						"animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]",
						"dark:border-gray-800 dark:bg-gray-950",
						"sm:rounded-lg",
						className
					)}
					{...props}
					>
						{children}
						{showClose && <DialogClose />}
					</div>
				</DialogAriaContext.Provider>
			</DialogPortal>
		);
	}
);
DialogContent.displayName = "DialogContent";

/**
 * Header section for dialog title and description.
 */
const DialogHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex flex-col space-y-1.5 text-center sm:text-left",
			className
		)}
		{...props}
	/>
);
DialogHeader.displayName = "DialogHeader";

/**
 * Footer section for dialog actions.
 */
const DialogFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
			className
		)}
		{...props}
	/>
);
DialogFooter.displayName = "DialogFooter";

/**
 * Dialog title element.
 */
const DialogTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
	const ariaContext = useDialogAriaContext();
	return (
		<h2
			ref={ref}
			id={ariaContext?.titleId}
			className={cn(
				"text-lg font-semibold leading-none tracking-tight",
				className
			)}
			{...props}
		>
			{children}
		</h2>
	);
});
DialogTitle.displayName = "DialogTitle";

/**
 * Dialog description element.
 */
const DialogDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
	const ariaContext = useDialogAriaContext();
	return (
		<p
			ref={ref}
			id={ariaContext?.descriptionId}
			className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
			{...props}
		/>
	);
});
DialogDescription.displayName = "DialogDescription";

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogClose,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
};
