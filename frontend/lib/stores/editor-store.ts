/**
 * Editor UI state management with Zustand.
 *
 * Manages editor preferences, view state, and UI interactions
 * that don't need to be synced with the backend.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { DocumentId } from "@/lib/types/document";

/** Active panel in split view */
export type ActivePanel = "editor" | "markdown" | "both";

/** Editor view mode */
export type ViewMode = "edit" | "preview" | "split";

/** Toolbar visibility state */
export interface ToolbarState {
	isVisible: boolean;
	isFloating: boolean;
	position: { x: number; y: number } | null;
}

/** Document tab state */
export interface DocumentTab {
	documentId: DocumentId;
	title: string;
	isDirty: boolean;
	lastPosition?: number;
}

/** Editor preferences */
export interface EditorPreferences {
	/** Font size in pixels */
	fontSize: number;
	/** Font family */
	fontFamily: string;
	/** Line height multiplier */
	lineHeight: number;
	/** Show line numbers */
	showLineNumbers: boolean;
	/** Enable spell check */
	spellCheck: boolean;
	/** Auto-save interval in ms (0 = disabled) */
	autoSaveInterval: number;
	/** Show word count in status bar */
	showWordCount: boolean;
	/** Show character count in status bar */
	showCharacterCount: boolean;
	/** Default view mode */
	defaultViewMode: ViewMode;
	/** Enable focus mode (hide distractions) */
	focusMode: boolean;
	/** Markdown preview theme */
	markdownTheme: "light" | "dark" | "system";
}

/** Status bar visibility state */
export interface StatusBarState {
	isVisible: boolean;
}

/** Editor UI state */
export interface EditorState {
	// View state
	activePanel: ActivePanel;
	viewMode: ViewMode;
	splitRatio: number; // 0-1, position of the divider
	zoom: number; // 50-200%

	// Document tabs
	openTabs: DocumentTab[];
	activeTabId: DocumentId | null;

	// Toolbar state
	toolbar: ToolbarState;

	// Status bar state
	statusBar: StatusBarState;

	// Selection state
	hasSelection: boolean;
	selectionText: string;
	selectionRange: { from: number; to: number } | null;

	// UI state
	isSidebarOpen: boolean;
	sidebarWidth: number;
	isCommandPaletteOpen: boolean;
	isSearchOpen: boolean;
	searchQuery: string;

	// Save state
	isSaving: boolean;
	lastSavedAt: string | null;
	saveError: string | null;

	// Preferences
	preferences: EditorPreferences;
}

/** Editor actions */
export interface EditorActions {
	// View actions
	setActivePanel: (panel: ActivePanel) => void;
	setViewMode: (mode: ViewMode) => void;
	setSplitRatio: (ratio: number) => void;
	setZoom: (zoom: number) => void;

	// Tab actions
	openTab: (tab: DocumentTab) => void;
	closeTab: (documentId: DocumentId) => void;
	setActiveTab: (documentId: DocumentId) => void;
	updateTabDirty: (documentId: DocumentId, isDirty: boolean) => void;
	updateTabTitle: (documentId: DocumentId, title: string) => void;
	reorderTabs: (fromIndex: number, toIndex: number) => void;

	// Toolbar actions
	setToolbarVisible: (visible: boolean) => void;
	setToolbarFloating: (floating: boolean, position?: { x: number; y: number }) => void;

	// Selection actions
	setSelection: (
		hasSelection: boolean,
		text?: string,
		range?: { from: number; to: number } | null
	) => void;
	clearSelection: () => void;

	// UI actions
	toggleSidebar: () => void;
	setSidebarWidth: (width: number) => void;
	toggleCommandPalette: () => void;
	toggleSearch: () => void;
	setSearchQuery: (query: string) => void;

	// Save actions
	setSaving: (isSaving: boolean) => void;
	setSaveSuccess: () => void;
	setSaveError: (error: string) => void;

	// Preference actions
	updatePreferences: (updates: Partial<EditorPreferences>) => void;
	resetPreferences: () => void;
	toggleFocusMode: () => void;
}

const DEFAULT_PREFERENCES: EditorPreferences = {
	fontSize: 16,
	fontFamily: "ui-sans-serif, system-ui, sans-serif",
	lineHeight: 1.6,
	showLineNumbers: false,
	spellCheck: true,
	autoSaveInterval: 2000,
	showWordCount: true,
	showCharacterCount: false,
	defaultViewMode: "split",
	focusMode: false,
	markdownTheme: "system",
};

const initialState: EditorState = {
	activePanel: "both",
	viewMode: "split",
	splitRatio: 0.5,
	zoom: 100,
	openTabs: [],
	activeTabId: null,
	toolbar: {
		isVisible: true,
		isFloating: false,
		position: null,
	},
	statusBar: {
		isVisible: true,
	},
	hasSelection: false,
	selectionText: "",
	selectionRange: null,
	isSidebarOpen: true,
	sidebarWidth: 280,
	isCommandPaletteOpen: false,
	isSearchOpen: false,
	searchQuery: "",
	isSaving: false,
	lastSavedAt: null,
	saveError: null,
	preferences: DEFAULT_PREFERENCES,
};

/**
 * Editor store with persistence for preferences.
 */
export const useEditorStore = create<EditorState & EditorActions>()(
	persist(
		immer((set, get) => ({
			...initialState,

			// View actions
			setActivePanel: (panel) =>
				set((state) => {
					state.activePanel = panel;
				}),

			setViewMode: (mode) =>
				set((state) => {
					state.viewMode = mode;
					if (mode === "edit") state.activePanel = "editor";
					else if (mode === "preview") state.activePanel = "markdown";
					else state.activePanel = "both";
				}),

			setSplitRatio: (ratio) =>
				set((state) => {
					state.splitRatio = Math.max(0.2, Math.min(0.8, ratio));
				}),

			setZoom: (zoom) =>
				set((state) => {
					state.zoom = Math.max(50, Math.min(200, zoom));
				}),

			// Tab actions
			openTab: (tab) =>
				set((state) => {
					const existingIndex = state.openTabs.findIndex(
						(t) => t.documentId === tab.documentId
					);
					if (existingIndex === -1) {
						state.openTabs.push(tab);
					}
					state.activeTabId = tab.documentId;
				}),

			closeTab: (documentId) =>
				set((state) => {
					const index = state.openTabs.findIndex(
						(t) => t.documentId === documentId
					);
					if (index !== -1) {
						state.openTabs.splice(index, 1);
						// Update active tab if needed
						if (state.activeTabId === documentId) {
							if (state.openTabs.length > 0) {
								const newIndex = Math.min(index, state.openTabs.length - 1);
								state.activeTabId = state.openTabs[newIndex].documentId;
							} else {
								state.activeTabId = null;
							}
						}
					}
				}),

			setActiveTab: (documentId) =>
				set((state) => {
					if (state.openTabs.some((t) => t.documentId === documentId)) {
						state.activeTabId = documentId;
					}
				}),

			updateTabDirty: (documentId, isDirty) =>
				set((state) => {
					const tab = state.openTabs.find((t) => t.documentId === documentId);
					if (tab) {
						tab.isDirty = isDirty;
					}
				}),

			updateTabTitle: (documentId, title) =>
				set((state) => {
					const tab = state.openTabs.find((t) => t.documentId === documentId);
					if (tab) {
						tab.title = title;
					}
				}),

			reorderTabs: (fromIndex, toIndex) =>
				set((state) => {
					const [tab] = state.openTabs.splice(fromIndex, 1);
					state.openTabs.splice(toIndex, 0, tab);
				}),

			// Toolbar actions
			setToolbarVisible: (visible) =>
				set((state) => {
					state.toolbar.isVisible = visible;
				}),

			setToolbarFloating: (floating, position) =>
				set((state) => {
					state.toolbar.isFloating = floating;
					state.toolbar.position = position ?? null;
				}),

			// Selection actions
			setSelection: (hasSelection, text = "", range = null) =>
				set((state) => {
					state.hasSelection = hasSelection;
					state.selectionText = text;
					state.selectionRange = range;
				}),

			clearSelection: () =>
				set((state) => {
					state.hasSelection = false;
					state.selectionText = "";
					state.selectionRange = null;
				}),

			// UI actions
			toggleSidebar: () =>
				set((state) => {
					state.isSidebarOpen = !state.isSidebarOpen;
				}),

			setSidebarWidth: (width) =>
				set((state) => {
					state.sidebarWidth = Math.max(200, Math.min(500, width));
				}),

			toggleCommandPalette: () =>
				set((state) => {
					state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
				}),

			toggleSearch: () =>
				set((state) => {
					state.isSearchOpen = !state.isSearchOpen;
					if (!state.isSearchOpen) {
						state.searchQuery = "";
					}
				}),

			setSearchQuery: (query) =>
				set((state) => {
					state.searchQuery = query;
				}),

			// Save actions
			setSaving: (isSaving) =>
				set((state) => {
					state.isSaving = isSaving;
					if (isSaving) {
						state.saveError = null;
					}
				}),

			setSaveSuccess: () =>
				set((state) => {
					state.isSaving = false;
					state.lastSavedAt = new Date().toISOString();
					state.saveError = null;
					// Mark active tab as not dirty
					if (state.activeTabId) {
						const tab = state.openTabs.find(
							(t) => t.documentId === state.activeTabId
						);
						if (tab) {
							tab.isDirty = false;
						}
					}
				}),

			setSaveError: (error) =>
				set((state) => {
					state.isSaving = false;
					state.saveError = error;
				}),

			// Preference actions
			updatePreferences: (updates) =>
				set((state) => {
					Object.assign(state.preferences, updates);
				}),

			resetPreferences: () =>
				set((state) => {
					state.preferences = DEFAULT_PREFERENCES;
				}),

			toggleFocusMode: () =>
				set((state) => {
					state.preferences.focusMode = !state.preferences.focusMode;
				}),
		})),
		{
			name: "docfusion-editor",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				preferences: state.preferences,
				sidebarWidth: state.sidebarWidth,
				isSidebarOpen: state.isSidebarOpen,
				splitRatio: state.splitRatio,
				viewMode: state.viewMode,
			}),
		}
	)
);

/**
 * Selector hooks for common state slices.
 */
export const useActivePanel = () => useEditorStore((s) => s.activePanel);
export const useViewMode = () => useEditorStore((s) => s.viewMode);
export const useEditorPreferences = () => useEditorStore((s) => s.preferences);
export const useOpenTabs = () => useEditorStore((s) => s.openTabs);
export const useActiveTabId = () => useEditorStore((s) => s.activeTabId);
export const useSaveState = () =>
	useEditorStore((s) => ({
		isSaving: s.isSaving,
		lastSavedAt: s.lastSavedAt,
		saveError: s.saveError,
	}));
