// ===================
// Textarea
// ===================
/**
 * DocFusion UI Components - Component Library
 * 
 * A comprehensive collection of accessible, themeable UI components
 * following the "Ink & Paper" Editorial Elegance design system.
 * 
 * @example
 * ```tsx
 * import { Button, Card, Input, Skeleton } from "@/components/ui";
 * 
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Welcome</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     <Input placeholder="Enter your email" />
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Submit</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */

// ===================
// Button
// ===================
export {
	Button,
	IconButton,
	ButtonGroup,
} from "./Button";
export type { ButtonProps } from "./Button";

// ===================
// Card
// ===================
export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
	CardDivider,
} from "./card";
export type { CardProps } from "./card";

// ===================
// Input
// ===================
export {
	Input,
	Label,
	Textarea,
	InputDescription,
	InputError,
} from "./input";
export type { InputProps } from "./input";

// ===================
// Select
// ===================
export {
	Select,
	SelectGroup,
	SelectValue,
	SelectTrigger,
	SelectContent,
	SelectLabel,
	SelectItem,
	SelectSeparator,
} from "./select";

// ===================
// Dialog
// ===================
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
} from "./dialog";

// ===================
// Dropdown Menu
// ===================
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
} from "./dropdown-menu";

// ===================
// Tooltip
// ===================
export {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
	useTooltipContext,
} from "./tooltip";
export type {
	TooltipProps,
	TooltipTriggerProps,
	TooltipContentProps,
} from "./tooltip";

// ===================
// Skeleton
// ===================
export {
	Skeleton,
	ShimmerSkeleton,
	DocumentCardSkeleton,
	TemplateCardSkeleton,
	EditorToolbarSkeleton,
	EditorContentSkeleton,
	AvatarSkeleton,
	TableRowSkeleton,
	StatSkeleton,
	EditorSkeleton,
	DocumentListSkeleton,
	PageSkeleton,
	TemplateSkeleton,
} from "./skeleton";

// ===================
// Checkbox
// ===================
export {
	Checkbox,
	CheckboxGroup,
	IndeterminateCheckbox,
} from "./checkbox";
export type {
	CheckboxProps,
	CheckboxGroupProps,
} from "./checkbox";

// ===================
// Virtualized List
// ===================
export {
	VirtualizedList,
	VirtualizedGrid,
	useResponsiveColumns,
} from "./virtualized-list";
export type {
	VirtualizedListProps,
	VirtualizedGridProps,
} from "./virtualized-list";

// ===================
// Status Badge
// ===================
export {
	StatusBadge,
	getStatusLabel,
	documentStatuses,
	proposalStatuses,
} from "./StatusBadge";
export type {
	StatusBadgeProps,
	DocumentStatus,
	ProposalStatus,
} from "./StatusBadge";
