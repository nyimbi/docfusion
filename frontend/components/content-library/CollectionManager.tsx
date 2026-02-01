/**
 * CollectionManager Component
 *
 * CRUD interface for managing content collections with
 * drag-and-drop organization and bulk operations.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
	FolderPlus,
	Folder,
	FolderOpen,
	Edit,
	Trash2,
	Plus,
	X,
	Check,
	ChevronRight,
	ChevronDown,
	FileText,
	MoreHorizontal,
	Copy,
	Share2,
	Lock,
	Globe,
	Users,
	Star,
	StarOff,
	Search,
	GripVertical,
	Move,
	Settings,
	AlertTriangle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ContentBlock {
	id: string;
	title: string;
	category: string;
}

interface Collection {
	id: string;
	name: string;
	description?: string;
	color?: string;
	icon?: string;
	visibility: "private" | "team" | "public";
	isFavorite: boolean;
	blockCount: number;
	blocks: ContentBlock[];
	createdAt: string;
	createdBy: string;
	updatedAt: string;
}

interface CollectionManagerProps {
	collections: Collection[];
	onCreateCollection: (data: CreateCollectionData) => Promise<Collection>;
	onUpdateCollection: (id: string, data: Partial<Collection>) => Promise<void>;
	onDeleteCollection: (id: string) => Promise<void>;
	onDuplicateCollection: (id: string) => Promise<Collection>;
	onAddBlockToCollection: (collectionId: string, blockId: string) => Promise<void>;
	onRemoveBlockFromCollection: (collectionId: string, blockId: string) => Promise<void>;
	onReorderBlocks: (collectionId: string, blockIds: string[]) => Promise<void>;
	onToggleFavorite: (id: string) => Promise<void>;
	selectedBlockId?: string;
	onSelectCollection?: (collection: Collection) => void;
	className?: string;
}

interface CreateCollectionData {
	name: string;
	description?: string;
	color?: string;
	visibility: "private" | "team" | "public";
}

// ============================================================================
// Constants
// ============================================================================

const COLOR_OPTIONS = [
	{ value: "blue", bg: "bg-blue-500", light: "bg-blue-100" },
	{ value: "green", bg: "bg-green-500", light: "bg-green-100" },
	{ value: "purple", bg: "bg-purple-500", light: "bg-purple-100" },
	{ value: "orange", bg: "bg-orange-500", light: "bg-orange-100" },
	{ value: "pink", bg: "bg-pink-500", light: "bg-pink-100" },
	{ value: "teal", bg: "bg-teal-500", light: "bg-teal-100" },
	{ value: "red", bg: "bg-red-500", light: "bg-red-100" },
	{ value: "gray", bg: "bg-gray-500", light: "bg-gray-100" },
];

const VISIBILITY_OPTIONS = [
	{ value: "private" as const, label: "Private", icon: Lock, description: "Only you can see" },
	{ value: "team" as const, label: "Team", icon: Users, description: "Visible to your team" },
	{ value: "public" as const, label: "Public", icon: Globe, description: "Visible to everyone" },
];

// ============================================================================
// Component
// ============================================================================

export function CollectionManager({
	collections,
	onCreateCollection,
	onUpdateCollection,
	onDeleteCollection,
	onDuplicateCollection,
	onAddBlockToCollection,
	onRemoveBlockFromCollection,
	onReorderBlocks,
	onToggleFavorite,
	selectedBlockId,
	onSelectCollection,
	className,
}: CollectionManagerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [newCollection, setNewCollection] = useState<CreateCollectionData>({
		name: "",
		description: "",
		color: "blue",
		visibility: "private",
	});

	const filteredCollections = searchQuery
		? collections.filter((c) =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: collections;

	const favoriteCollections = filteredCollections.filter((c) => c.isFavorite);
	const regularCollections = filteredCollections.filter((c) => !c.isFavorite);

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleCreateCollection = async () => {
		if (!newCollection.name.trim()) return;

		try {
			const created = await onCreateCollection(newCollection);
			setIsCreating(false);
			setNewCollection({
				name: "",
				description: "",
				color: "blue",
				visibility: "private",
			});
			setExpandedIds((prev) => new Set(prev).add(created.id));
		} catch (error) {
			console.error("Failed to create collection:", error);
		}
	};

	const handleDeleteCollection = async (id: string) => {
		try {
			await onDeleteCollection(id);
			setDeleteConfirmId(null);
		} catch (error) {
			console.error("Failed to delete collection:", error);
		}
	};

	const handleDuplicateCollection = async (id: string) => {
		try {
			const duplicated = await onDuplicateCollection(id);
			setExpandedIds((prev) => new Set(prev).add(duplicated.id));
			setMenuOpenId(null);
		} catch (error) {
			console.error("Failed to duplicate collection:", error);
		}
	};

	const getColorClasses = (color?: string) => {
		const colorOption = COLOR_OPTIONS.find((c) => c.value === color) ?? COLOR_OPTIONS[0];
		return colorOption;
	};

	return (
		<div className={cn("bg-white rounded-lg border", className)}>
			{/* Header */}
			<div className="p-4 border-b">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<Folder className="w-5 h-5 text-blue-600" />
						<h2 className="font-semibold">Collections</h2>
						<span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
							{collections.length}
						</span>
					</div>
					<Button
						variant="primary"
						size="sm"
						onClick={() => setIsCreating(true)}
					>
						<FolderPlus className="w-4 h-4 mr-1" />
						New
					</Button>
				</div>

				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search collections..."
						className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
			</div>

			{/* Create Collection Form */}
			{isCreating && (
				<div className="p-4 border-b bg-blue-50">
					<div className="space-y-3">
						<input
							type="text"
							value={newCollection.name}
							onChange={(e) =>
								setNewCollection((prev) => ({ ...prev, name: e.target.value }))
							}
							placeholder="Collection name"
							className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							autoFocus
						/>
						<textarea
							value={newCollection.description}
							onChange={(e) =>
								setNewCollection((prev) => ({ ...prev, description: e.target.value }))
							}
							placeholder="Description (optional)"
							className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
							rows={2}
						/>

						{/* Color Selection */}
						<div>
							<label className="text-xs text-gray-500 mb-1 block">Color</label>
							<div className="flex gap-2">
								{COLOR_OPTIONS.map((color) => (
									<button
										key={color.value}
										onClick={() =>
											setNewCollection((prev) => ({ ...prev, color: color.value }))
										}
										className={cn(
											"w-6 h-6 rounded-full transition-transform",
											color.bg,
											newCollection.color === color.value && "ring-2 ring-offset-2 ring-blue-500 scale-110"
										)}
									/>
								))}
							</div>
						</div>

						{/* Visibility */}
						<div>
							<label className="text-xs text-gray-500 mb-1 block">Visibility</label>
							<div className="flex gap-2">
								{VISIBILITY_OPTIONS.map((option) => (
									<button
										key={option.value}
										onClick={() =>
											setNewCollection((prev) => ({ ...prev, visibility: option.value }))
										}
										className={cn(
											"flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors",
											newCollection.visibility === option.value
												? "bg-blue-100 border-blue-300 text-blue-700"
												: "hover:bg-gray-50"
										)}
									>
										<option.icon className="w-3 h-3" />
										{option.label}
									</button>
								))}
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsCreating(false)}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={handleCreateCollection}
								disabled={!newCollection.name.trim()}
							>
								Create Collection
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Collections List */}
			<div className="max-h-96 overflow-y-auto">
				{/* Favorites Section */}
				{favoriteCollections.length > 0 && (
					<div className="border-b">
						<div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 flex items-center gap-1">
							<Star className="w-3 h-3" />
							Favorites
						</div>
						{favoriteCollections.map((collection) => (
							<CollectionRow
								key={collection.id}
								collection={collection}
								isExpanded={expandedIds.has(collection.id)}
								onToggleExpand={() => toggleExpand(collection.id)}
								onSelect={() => onSelectCollection?.(collection)}
								onToggleFavorite={() => onToggleFavorite(collection.id)}
								onEdit={() => setEditingId(collection.id)}
								onDelete={() => setDeleteConfirmId(collection.id)}
								onDuplicate={() => handleDuplicateCollection(collection.id)}
								onRemoveBlock={(blockId) =>
									onRemoveBlockFromCollection(collection.id, blockId)
								}
								colorClasses={getColorClasses(collection.color)}
								menuOpen={menuOpenId === collection.id}
								onToggleMenu={() =>
									setMenuOpenId(menuOpenId === collection.id ? null : collection.id)
								}
								selectedBlockId={selectedBlockId}
								onAddSelectedBlock={
									selectedBlockId
										? () => onAddBlockToCollection(collection.id, selectedBlockId)
										: undefined
								}
							/>
						))}
					</div>
				)}

				{/* Regular Collections */}
				{regularCollections.length > 0 && (
					<div>
						{favoriteCollections.length > 0 && (
							<div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
								All Collections
							</div>
						)}
						{regularCollections.map((collection) => (
							<CollectionRow
								key={collection.id}
								collection={collection}
								isExpanded={expandedIds.has(collection.id)}
								onToggleExpand={() => toggleExpand(collection.id)}
								onSelect={() => onSelectCollection?.(collection)}
								onToggleFavorite={() => onToggleFavorite(collection.id)}
								onEdit={() => setEditingId(collection.id)}
								onDelete={() => setDeleteConfirmId(collection.id)}
								onDuplicate={() => handleDuplicateCollection(collection.id)}
								onRemoveBlock={(blockId) =>
									onRemoveBlockFromCollection(collection.id, blockId)
								}
								colorClasses={getColorClasses(collection.color)}
								menuOpen={menuOpenId === collection.id}
								onToggleMenu={() =>
									setMenuOpenId(menuOpenId === collection.id ? null : collection.id)
								}
								selectedBlockId={selectedBlockId}
								onAddSelectedBlock={
									selectedBlockId
										? () => onAddBlockToCollection(collection.id, selectedBlockId)
										: undefined
								}
							/>
						))}
					</div>
				)}

				{/* Empty State */}
				{filteredCollections.length === 0 && (
					<div className="p-8 text-center text-gray-500">
						<Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
						{searchQuery ? (
							<p>No collections matching "{searchQuery}"</p>
						) : (
							<>
								<p className="mb-2">No collections yet</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsCreating(true)}
								>
									<FolderPlus className="w-4 h-4 mr-1" />
									Create your first collection
								</Button>
							</>
						)}
					</div>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			{deleteConfirmId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirmId(null)} />
					<div className="relative bg-white rounded-lg p-6 max-w-md shadow-xl">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 bg-red-100 rounded-full">
								<AlertTriangle className="w-6 h-6 text-red-600" />
							</div>
							<div>
								<h3 className="font-semibold">Delete Collection?</h3>
								<p className="text-sm text-gray-500">
									This action cannot be undone. Content blocks will not be deleted.
								</p>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
								Cancel
							</Button>
							<Button
								variant="danger"
								onClick={() => handleDeleteCollection(deleteConfirmId)}
							>
								Delete Collection
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// Sub-components
// ============================================================================

interface CollectionRowProps {
	collection: Collection;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onSelect?: () => void;
	onToggleFavorite: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onDuplicate: () => void;
	onRemoveBlock: (blockId: string) => void;
	colorClasses: { bg: string; light: string };
	menuOpen: boolean;
	onToggleMenu: () => void;
	selectedBlockId?: string;
	onAddSelectedBlock?: () => void;
}

function CollectionRow({
	collection,
	isExpanded,
	onToggleExpand,
	onSelect,
	onToggleFavorite,
	onEdit,
	onDelete,
	onDuplicate,
	onRemoveBlock,
	colorClasses,
	menuOpen,
	onToggleMenu,
	selectedBlockId,
	onAddSelectedBlock,
}: CollectionRowProps) {
	const VisibilityIcon = VISIBILITY_OPTIONS.find((v) => v.value === collection.visibility)?.icon ?? Lock;

	return (
		<div className="border-b last:border-b-0">
			<div
				className="p-3 flex items-center gap-2 hover:bg-gray-50 cursor-pointer"
				onClick={onToggleExpand}
			>
				<button className="p-1" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
					{isExpanded ? (
						<ChevronDown className="w-4 h-4 text-gray-400" />
					) : (
						<ChevronRight className="w-4 h-4 text-gray-400" />
					)}
				</button>
				<div className={cn("w-3 h-3 rounded-full", colorClasses.bg)} />
				{isExpanded ? (
					<FolderOpen className="w-5 h-5 text-gray-500" />
				) : (
					<Folder className="w-5 h-5 text-gray-500" />
				)}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm truncate">{collection.name}</span>
						<VisibilityIcon className="w-3 h-3 text-gray-400" />
					</div>
					{collection.description && !isExpanded && (
						<p className="text-xs text-gray-500 truncate">{collection.description}</p>
					)}
				</div>
				<span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
					{collection.blockCount}
				</span>
				<div className="flex items-center gap-1">
					<button
						onClick={(e) => {
							e.stopPropagation();
							onToggleFavorite();
						}}
						className="p-1 hover:bg-gray-200 rounded"
					>
						{collection.isFavorite ? (
							<Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
						) : (
							<StarOff className="w-4 h-4 text-gray-400" />
						)}
					</button>
					<div className="relative">
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleMenu();
							}}
							className="p-1 hover:bg-gray-200 rounded"
						>
							<MoreHorizontal className="w-4 h-4 text-gray-500" />
						</button>
						{menuOpen && (
							<div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 w-40">
								<button
									onClick={(e) => {
										e.stopPropagation();
										onSelect?.();
									}}
									className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
								>
									<FolderOpen className="w-4 h-4" />
									Open
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										onEdit();
									}}
									className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
								>
									<Edit className="w-4 h-4" />
									Edit
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										onDuplicate();
									}}
									className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
								>
									<Copy className="w-4 h-4" />
									Duplicate
								</button>
								<div className="border-t my-1" />
								<button
									onClick={(e) => {
										e.stopPropagation();
										onDelete();
									}}
									className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
								>
									<Trash2 className="w-4 h-4" />
									Delete
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Expanded Content */}
			{isExpanded && (
				<div className="px-8 pb-3">
					{collection.description && (
						<p className="text-xs text-gray-500 mb-2">{collection.description}</p>
					)}

					{/* Add Selected Block */}
					{selectedBlockId && onAddSelectedBlock && (
						<button
							onClick={onAddSelectedBlock}
							className="w-full mb-2 p-2 border-2 border-dashed border-blue-300 rounded-lg text-sm text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
						>
							<Plus className="w-4 h-4" />
							Add selected block to this collection
						</button>
					)}

					{/* Blocks List */}
					{collection.blocks.length > 0 ? (
						<div className="space-y-1">
							{collection.blocks.map((block) => (
								<div
									key={block.id}
									className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 group"
								>
									<GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
									<FileText className="w-4 h-4 text-gray-500" />
									<span className="flex-1 text-sm truncate">{block.title}</span>
									<span className="text-xs text-gray-400">{block.category}</span>
									<button
										onClick={() => onRemoveBlock(block.id)}
										className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded"
									>
										<X className="w-4 h-4 text-gray-500" />
									</button>
								</div>
							))}
						</div>
					) : (
						<div className="p-4 text-center text-xs text-gray-500">
							No content blocks in this collection
						</div>
					)}
				</div>
			)}
		</div>
	);
}
