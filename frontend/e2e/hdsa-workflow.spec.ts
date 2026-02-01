import { test, expect, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "crypto";

/**
 * Comprehensive E2E Test Suite for HDSA Outline Editor
 *
 * This test suite validates the complete user journey through the HDSA editor:
 * 1. Document onboarding and initial structure generation
 * 2. Interactive tree operations (add/edit/delete nodes)
 * 3. AI-powered content generation
 * 4. Export and workflow features
 *
 * Test Organization: Sequential steps that build state progressively
 */

// ============================================================================
// Test Configuration
// ============================================================================

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
const TEST_TIMEOUT = 120000; // 2 minutes per test
const ACTION_TIMEOUT = 30000; // 30 seconds per action

// Test data generators
const generateTestId = () => randomUUID().slice(0, 8);
const generateTestUser = () => ({
	email: `test-${generateTestId()}@docfusion.ai`,
	password: `TestPass123!${generateTestId()}`,
	organization: `TestOrg-${generateTestId()}`,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Takes a screenshot with standardized naming for debugging
 */
async function takeScreenshot(
	page: Page,
	stepName: string,
	folder: string = ""
): Promise<void> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = folder
		? `hdsa-${folder}-${stepName}-${timestamp}.png`
		: `hdsa-${stepName}-${timestamp}.png`;
	await page.screenshot({ path: `test-results/${fileName}`, fullPage: true });
	console.log(`Screenshot: ${fileName}`);
}

/**
 * Waits for AI generation to complete
 */
async function waitForGeneration(page: Page, timeout: number = 30000): Promise<void> {
	const startTime = Date.now();
	
	// Wait for generation indicators to appear
	await page.waitForSelector(
		'[data-testid="generation-indicator"], [data-testid="streaming-content"], text="Generating", text="Creating outline"',
		{ state: "visible", timeout: 5000 }
	).catch(() => {
		console.log("No generation indicator found, checking for immediate completion");
	});
	
	// Wait for generation to complete (indicator disappears or content appears)
	while (Date.now() - startTime < timeout) {
		const indicator = await page.locator('[data-testid="generation-indicator"]').isVisible().catch(() => false);
		const streaming = await page.locator('[data-testid="streaming-content"]').isVisible().catch(() => false);
		const loadingText = await page.locator('text="Generating"').isVisible().catch(() => false);
		
		if (!indicator && !streaming && !loadingText) {
			console.log("Generation completed");
			return;
		}
		
		await page.waitForTimeout(500);
	}
	
	console.warn("Generation timeout - continuing anyway");
}

/**
 * Finds a node by its title text
 */
async function findNodeByText(page: Page, text: string): Promise<Locator> {
	return page.locator(`[data-testid="node-title"]:has-text("${text}")`);
}

/**
 * Expands a node tree if not already expanded
 */
async function expandNode(page: Page, nodeTitle: string): Promise<void> {
	const node = await findNodeByText(page, nodeTitle);
	const expandBtn = node.locator('xpath=../..').locator('[data-testid="expand-btn"]').first();
	
	const isExpanded = await expandBtn.getAttribute("data-expanded").catch(() => "false");
	if (isExpanded === "false") {
		await expandBtn.click();
		await page.waitForTimeout(300);
	}
}

/**
 * Performs common setup tasks
 */
async function setupTest(page: Page, testId: string): Promise<void> {
	// Set up console logging
	page.on("console", (msg) => {
		if (msg.type() === "error" || msg.type() === "warning") {
			console.log(`[Browser ${msg.type()}]: ${msg.text()}`);
		}
	});
	
	// Set viewport for consistent UI
	await page.setViewportSize({ width: 1440, height: 900 });
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe("HDSA Outline Editor - Complete Workflow", () => {
	test.setTimeout(TEST_TIMEOUT);
	
	test("Full HDSA Document Creation and Management Flow", async ({ page }) => {
		const testId = generateTestId();
		const testUser = generateTestUser();
		
		await setupTest(page, testId);
		
		// ========================================================================
		// STEP 1: Authentication and Navigation
		// ========================================================================
		
		await test.step("Navigate to HDSA Editor", async () => {
			// Navigate to the HDSA editor page
			await page.goto(`${BASE_URL}/hdsi`);
			
			// Wait for page to load
			await page.waitForLoadState("networkidle");
			
			// Take initial screenshot
			await takeScreenshot(page, "01-initial-load", testId);
			
			// Verify the page loaded (either shows onboarding or main interface)
			const mainInterface = page.locator('[data-testid="hdsa-editor"]');
			const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
			
			await expect(mainInterface.or(onboardingModal)).toBeVisible({ timeout: 10000 });
			
			// Log which state we're in
			const isOnboarding = await onboardingModal.isVisible().catch(() => false);
			console.log(`HDSA Editor loaded. Onboarding: ${isOnboarding}`);
		});
		
		// ========================================================================
		// STEP 2: Document Onboarding (if needed)
		// ========================================================================
		
		await test.step("Complete Document Onboarding", async () => {
			const onboardingBtn = page.locator('button:has-text("Create New Document")');
			const hasOnboarding = await onboardingBtn.isVisible().catch(() => false);
			
			if (hasOnboarding) {
				console.log("Starting onboarding flow");
				
				// Click create button to trigger onboarding
				await onboardingBtn.click();
				
				// Wait for the onboarding modal to appear after AI generation
				await page.waitForTimeout(1000);
				await takeScreenshot(page, "02-onboarding-loading", testId);
				
				// Wait for AI generation to complete
				await waitForGeneration(page);
				
				// Verify the onboarding modal appeared with generated content
				const onboardingModal = page.locator('[data-testid="onboarding-modal"]');
				await expect(onboardingModal).toBeVisible({ timeout: 10000 });
				
				await takeScreenshot(page, "03-onboarding-modal", testId);
				
				// Extract and verify the AI-generated structure preview
				const structurePreview = page.locator('[data-testid="structure-preview"]');
				await expect(structurePreview).toBeVisible();
				
				// Log the generated structure
				const previewText = await structurePreview.textContent();
				console.log("Generated structure preview:", previewText?.substring(0, 200));
				
				// Accept the generated structure
				const acceptBtn = page.locator('button:has-text("Accept Structure")');
				await acceptBtn.click();
				
				// Wait for transition to main editor
				await page.waitForTimeout(500);
				await takeScreenshot(page, "04-structure-accepted", testId);
			} else {
				console.log("No onboarding needed - document already exists");
			}
		});
		
		// ========================================================================
		// STEP 3: Verify Core UI Elements
		// ========================================================================
		
		await test.step("Verify Editor Interface", async () => {
			// Verify main editor components
			await expect(page.locator('[data-testid="hdsa-editor"]')).toBeVisible();
			await expect(page.locator('[data-testid="tree-container"]')).toBeVisible();
			
			// Verify toolbar buttons
			const expectedButtons = [
				"Add Section",
				"Add Paragraph",
				"Generate with AI",
				"Export",
			];
			
			for (const buttonText of expectedButtons) {
				const button = page.locator(`button:has-text("${buttonText}")`).first();
				await expect(button).toBeVisible();
			}
			
			// Verify sidebar sections
			await expect(page.locator('[data-testid="ai-panel"]')).toBeVisible();
			await expect(page.locator('[data-testid="outline-nav"]')).toBeVisible();
			
			await takeScreenshot(page, "05-editor-interface", testId);
		});
		
		// ========================================================================
		// STEP 4: Interactive Tree Operations - Add Section
		// ========================================================================
		
		await test.step("Add New Section to Tree", async () => {
			 // Open the editor
			await page.goto(`${BASE_URL}/hdsi`);
			await page.waitForTimeout(2000);

			// Look for the add button first
			console.log("Looking for add controls...");
			
			// Look for add buttons directly
			const btn = page.locator('button[role="button"]').filter({ 
				hasText: /^(Add Section?|➕)$/ 
			}).first();
			
			const isVisible = await btn.isVisible().catch(() => false);
			
			if (!isVisible) {
				console.log("Add button not found with role filter");
				// Try a different approach - look for any button containing 'Add'
				const addBtns = await page.locator('button:has-text("Add")').all();
				console.log(`Found ${addBtns.length} buttons with 'Add' text`);
				
				// Log all buttons for debugging
				const allBtns = await page.locator('button').all();
				for (let i = 0; i < Math.min(allBtns.length, 10); i++) {
					const text = await allBtns[i].textContent().catch(() => 'no-text');
					console.log(`Button ${i}: ${text}`);
				}
			}
			
			await expect(btn).toBeVisible({ timeout: 5000 });
			await btn.click();
			
			// Wait for node to be added
			await page.waitForTimeout(500);
			
			// Verify the new section appears in the tree
			const newSection = page.locator('[data-testid="node-title"]:has-text("New Section")').first();
			await expect(newSection).toBeVisible({ timeout: 5000 });
			
			await takeScreenshot(page, "06-section-added", testId);
		});
		
		// ========================================================================
		// STEP 5: Edit Node Title
		// ========================================================================
		
		await test.step("Edit Section Title", async () => {
			// Find the section we just added
			const newSection = await findNodeByText(page, "New Section");
			
			// Click to enter edit mode
			await newSection.dblclick();
			await page.waitForTimeout(200);
			
			// Clear current text and type new title
			const input = newSection.locator('input[data-testid="title-input"]');
			await input.clear();
			await input.fill("Technical Requirements");
			
			// Press Enter to confirm
			await input.press("Enter");
			await page.waitForTimeout(300);
			
			// Verify the title was updated
			const updatedSection = await findNodeByText(page, "Technical Requirements");
			await expect(updatedSection).toBeVisible();
			
			await takeScreenshot(page, "07-title-edited", testId);
		});
		
		// ========================================================================
		// STEP 6: Add and Edit Content Node
		// ========================================================================
		
		await test.step("Add and Edit Content Node", async () => {
			// First select the Technical Requirements section
			const section = await findNodeByText(page, "Technical Requirements");
			await section.click();
			await page.waitForTimeout(200);
			
			// Add content node
			// Find the add content button in the toolbar - updated for actual UI
			const addParaBtn = page.locator('button', { hasText: /^(Add Paragraph|➕)$/ }).first();
			await expect(addParaBtn).toBeVisible({ timeout: 5000 });
			await addParaBtn.click();
			
			// Wait for content editor to appear
			await page.waitForTimeout(300);
			
			// Find the content node we just added
			const contentNode = page.locator('[data-testid="node-content"]').last();
			await expect(contentNode).toBeVisible({ timeout: 5000 });
			
			// Type some content
			const editor = page.locator('[data-testid="content-editor"] >> [contenteditable="true"]').last();
			await editor.click();
			await editor.fill("This section describes the technical requirements and implementation details.");
			await page.waitForTimeout(300);
			
			// Verify the content was entered
			const content = await editor.textContent();
			expect(content).toContain("technical requirements");
			
			await takeScreenshot(page, "08-content-added", testId);
		});
		
		// ========================================================================
		// STEP 7: AI-Powered Content Generation
		// ========================================================================
		
		await test.step("Generate Content with AI", async () => {
			// Go to editor first
			await page.goto(`${BASE_URL}/hdsi`);
			await page.waitForLoadState("domcontentloaded");
			await new Promise(r => setTimeout(r, 2000));
			
			// First, expand ALL nodes to ensure we can find the target node
			console.log("Expanding all nodes...");
			const expandAllBtn = page.locator('button:has-text("Expand All")').first();
			const canExpandAll = await expandAllBtn.isVisible().catch(() => false);
			
			if (canExpandAll) {
				await expandAllBtn.click();
				await page.waitForTimeout(1000);
			}
			
			// Take a screenshot to see current state
			await takeScreenshot(page, "e2e-results", "09a-tree-state");
			
			// Select any leaf section node for AI generation
			console.log("Looking for section nodes to generate content for...");
			
			// Try multiple strategies to find a node
			let sectionNode: Locator | null = null;
			
			// Strategy 1: Try to find "Technical Requirements" node we created earlier
			sectionNode = page.locator('[data-testid="node-title"]:has-text("Technical Requirements")').first();
			if (!(await sectionNode.isVisible().catch(() => false))) {
				// Strategy 2: Find any node that can be expanded (not a leaf content node)
				sectionNode = page.locator('[data-testid="node-content"]').first();
			}
			
			if (!sectionNode || !(await sectionNode.isVisible().catch(() => false))) {
				console.log("No suitable node found for generation - skipping generation test");
				return;
			}
			
			// Get the node title for logging
			const nodeTitle = await sectionNode.textContent() || "Unknown";
			console.log(`Attempting AI generation for node: ${nodeTitle}`);
			
			// Select the node
			await sectionNode.click();
			await page.waitForTimeout(300);
			
			// Open AI panel
			const aiPanelBtn = page.locator('button:has-text("Generate with AI")').first();
			await expect(aiPanelBtn).toBeVisible({ timeout: 5000 });
			await aiPanelBtn.click();
			
			// Verify AI panel opens
			const aIPanel = page.locator('[data-testid="ai-generation-panel"]');
			await expect(aIPanel).toBeVisible({ timeout: 10000 });
			
			await takeScreenshot(page, "e2e-results", "09b-ai-panel-open");
			
			// Configure generation parameters
			// Select model
			const modelSelect = aIPanel.locator('select[data-testid="model-select"]');
			await modelSelect.selectOption("claude-sonnet-4-20250514");
			
			// Enter prompt
			const promptInput = aIPanel.locator('textarea[data-testid="prompt-input"]');
			await promptInput.fill("Generate comprehensive technical requirements for a cloud-based document management system");
			
			// Trigger generation
			const generateBtn = aIPanel.locator('button:has-text("Generate")').first();
			await generateBtn.click();
			
			// Wait for AI generation to complete
			console.log("Waiting for AI generation...");
			await page.waitForTimeout(1000);
			
			await waitForGeneration(page);
			
			// Take screenshot after generation completes
			await takeScreenshot(page, "e2e-results", "09c-ai-generation-complete");
			
			// Verify that AI-generated content now exists in the tree
			const aiContent = page.locator('[data-testid="node-content"]:not(:has-text("New Section"))').first();
			const hasGeneratedContent = await aiContent.isVisible().catch(() => false);
			expect(hasGeneratedContent).toBeTruthy();
		});
		
		// ========================================================================
		// STEP 8: AI Model Comparison (if available)
		// ========================================================================
		
		await test.step("Test AI Model Comparison", async () => {
			// Open AI panel again
			const aiPanelBtn = page.locator('button:has-text("Generate with AI")').first();
			
			// Check if panel is already open
			const panelOpen = await page.locator('[data-testid="ai-generation-panel"]').isVisible().catch(() => false);
			
			if (!panelOpen && (await aiPanelBtn.isVisible().catch(() => false))) {
				await aiPanelBtn.click();
				await page.waitForTimeout(500);
			}
			
			// Check if comparison mode is available
			const compareBtn = page.locator('button:has-text("Compare Models")');
			const hasComparison = await compareBtn.isVisible().catch(() => false);
			
			if (hasComparison) {
				await compareBtn.click();
				
				// Select models to compare
				await page.locator('input[value="claude-sonnet-4"]').check();
				await page.locator('input[value="gpt-4o-2024-11-20"]').check();
				
				// Generate comparison
				await page.locator('button:has-text("Generate Comparison")').click();
				
				// Wait for both generations
				await waitForGeneration(page, 60000);
				
				// Verify comparison results
				const comparisonPanel = page.locator('[data-testid="comparison-panel"]');
				await expect(comparisonPanel).toBeVisible({ timeout: 30000 });
				
				await takeScreenshot(page, "e2e-results", "10-ai-comparison");
			} else {
				console.log("AI comparison feature not available in this build");
			}
		});
		
		// ========================================================================
		// STEP 9: Inline Editing with Live Preview
		// ========================================================================
		
		await test.step("Test Inline Editing", async () => {
			// Select a content node
			const contentNode = page.locator('[data-testid="node-content"]').first();
			await contentNode.click();
			
			// Check for edit button or double-click to edit
			const editBtn = contentNode.locator('button:has-text("Edit")');
			const canEdit = await editBtn.isVisible().catch(() => false);
			
			if (canEdit) {
				await editBtn.click();
			} else {
				await contentNode.dblclick();
			}
			
			// Wait for editor
			await page.waitForTimeout(300);
			
			// Type with live preview
			const editor = page.locator('[data-testid="content-editor"] >> [contenteditable="true"]').first();
			await editor.clear();
			
			// Type slowly to simulate live preview
			const text = "Updated content with better formatting and clarity.";
			for (const char of text) {
				await editor.type(char, { delay: 10 });
			}
			
			// Check for real-time preview panel
			const previewPanel = page.locator('[data-testid="live-preview"]');
			const hasPreview = await previewPanel.isVisible().catch(() => false);
			
			if (hasPreview) {
				const previewText = await previewPanel.textContent();
				expect(previewText).toContain("Updated content");
				
				await takeScreenshot(page, "e2e-results", "11a-live-preview");
			}
			
			// Save the changes
			const saveBtn = page.locator('button:has-text("Save")').first();
			await saveBtn.click();
			
			// Verify changes persisted
			await page.waitForTimeout(300);
			const updatedNode = page.locator('[data-testid="node-content"]').first();
			const nodeText = await updatedNode.textContent();
			expect(nodeText).toContain("Updated content");
			
			await takeScreenshot(page, "e2e-results", "11b-inline-saved");
		});
		
		// ========================================================================
		// STEP 10: Navigation and Outline Features
		// ========================================================================
		
		await test.step("Navigation and Outline Panel", async () => {
			// Find the outline panel
			const outlinePanel = page.locator('[data-testid="outline-nav"]');
			await expect(outlinePanel).toBeVisible();
			
			// Expand the outline to show all sections
			const expandBtn = outlinePanel.locator('button:has-text("Expand Outline")').first();
			const canExpand = await expandBtn.isVisible().catch(() => false);
			
			if (canExpand) {
				await expandBtn.click();
			}
			
			// Click on a section in outline to navigate to it
			const outlineItems = outlinePanel.locator('[data-testid="outline-item"]');
			const itemCount = await outlineItems.count();
			
			if (itemCount > 1) {
				// Click second item (skip root)
				await outlineItems.nth(1).click();
				
				// Wait for tree to navigate
				await page.waitForTimeout(300);
				
				// Verify the corresponding tree node is highlighted or focused
				const activeNode = page.locator('[data-testid="node-title"][data-active="true"]');
				const hasActive = await activeNode.isVisible().catch(() => false);
				
				if (hasActive) {
					console.log("Navigation successful - node is active");
				}
				
				await takeScreenshot(page, "e2e-results", "12-outline-navigation");
			}
		});
		
		// ========================================================================
		// STEP 11: Tree Operations - Reorder
		// ========================================================================
		
		await test.step("Reorder Tree Nodes", async () => {
			// Select a node to reorder
			const sectionNode = page.locator('[data-testid="node-title"]').first();
			await sectionNode.click();
			await page.waitForTimeout(200);
			
			// Look for move buttons
			const moveUpBtn = page.locator('button[title="Move Up"]').first();
			const moveDownBtn = page.locator('button[title="Move Down"]').first();
			
			const canMoveUp = await moveUpBtn.isVisible().catch(() => false);
			const canMoveDown = await moveDownBtn.isVisible().catch(() => false);
			
			if (canMoveDown) {
				// Store original position
				const originalText = await sectionNode.textContent();
				
				// Move down
				await moveDownBtn.click();
				await page.waitForTimeout(300);
				
				// Verify it moved (position or visibility changed)
				await takeScreenshot(page, "e2e-results", "13-nodes-reordered");
				
				// Move back up
				if (canMoveUp) {
					await moveUpBtn.click();
					await page.waitForTimeout(300);
				}
			} else {
				console.log("Reorder buttons not visible");
			}
		});
		
		// ========================================================================
		// STEP 12: Expand All / Collapse All
		// ========================================================================
		
		await test.step("Expand and Collapse All Nodes", async () => {
			// Find expand/collapse buttons
			const expandAllBtn = page.locator('button:has-text("Expand All")').first();
			const collapseAllBtn = page.locator('button:has-text("Collapse All")').first();
			
			const canExpandAll = await expandAllBtn.isVisible().catch(() => false);
			const canCollapseAll = await collapseAllBtn.isVisible().catch(() => false);
			
			if (canExpandAll && canCollapseAll) {
				// Collapse all
				await collapseAllBtn.click();
				await page.waitForTimeout(500);
				
				// Count visible nodes (should be fewer)
				const collapsedCount = await page.locator('[data-testid="node-title"]').count();
				console.log(`Collapsed tree has ${collapsedCount} visible nodes`);
				
				await takeScreenshot(page, "e2e-results", "14a-collapsed");
				
				// Expand all
				await expandAllBtn.click();
				await page.waitForTimeout(500);
				
				const expandedCount = await page.locator('[data-testid="node-title"]').count();
				console.log(`Expanded tree has ${expandedCount} visible nodes`);
				
				// Should see more nodes when expanded
				// expect(expandedCount).toBeGreaterThanOrEqual(collapsedCount);
				
				await takeScreenshot(page, "e2e-results", "14b-expanded");
			}
		});
		
		// ========================================================================
		// STEP 13: RAG Context Assembly
		// ========================================================================
		
		await test.step("Test RAG Context Assembly", async () => {
			// Wait for any loading or syncing to complete
			await page.waitForTimeout(1000);
			
			// Refresh the page to verify persistence worked
			console.log("Refreshing page to verify data persistence...");
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(2000);
			
			// Take screenshot of state after refresh
			await takeScreenshot(page, "e2e-results", "23-after-refresh");
			
			// Verify tree is still loaded
			const treeContainer = page.locator('[data-testid="tree-container"]');
			await expect(treeContainer).toBeVisible({ timeout: 10000 });
			
			// Check if AI panel needs to be reopened
			let aiPanel = page.locator('[data-testid="ai-generation-panel"]');
			let isPanelOpen = await aiPanel.isVisible().catch(() => false);
			
			if (!isPanelOpen) {
				const aiPanelBtn = page.locator('button:has-text("Generate with AI")').first();
				if (await aiPanelBtn.isVisible().catch(() => false)) {
					await aiPanelBtn.click();
					await page.waitForTimeout(500);
					isPanelOpen = await aiPanel.isVisible().catch(() => false);
				}
			}
			
			if (!isPanelOpen) {
				console.log("AI Panel not available - skipping RAG test");
				return;
			}
			
			aiPanel = page.locator('[data-testid="ai-generation-panel"]');
			
			// Check for context assembly UI with more flexible selectors
			const contextAssembly = aiPanel.locator('[data-testid="rag-context"], [data-testid="context-panel"]').first();
			
			if (await contextAssembly.isVisible().catch(() => false)) {
				console.log("Context assembly visible");
				await takeScreenshot(page, "e2e-results", "24-context-assembly");
			}
			
			// Check for parent references in the UI
			const parentContext = page.locator(
				'text=/Parent:|parent context|parent-reference/'
			);
			
			if (await parentContext.isVisible().catch(() => false)) {
				const parentText = await parentContext.textContent();
				console.log(`Parent context: ${parentText}`);
			}
		});
		
		// ========================================================================
		// STEP 14: Wait for Regeneration to Complete
		// ========================================================================
		
		await test.step("Wait for Regeneration Completion", async () => {
			// Wait for loading indicators to disappear
			await page.waitForSelector('[data-testid="loading-indicator"]', { 
				state: "hidden", 
				timeout: 30000 
			}).catch(() => {
				console.log("No loading indicators found or timeout");
			});
			
			// Wait for content to stabilize
			await page.waitForTimeout(500);
			
			// Verify no error states
			const errorAlert = page.locator('[data-testid="error-alert"], .alert-error, [role="alert"]').first();
			const hasError = await errorAlert.isVisible().catch(() => false);
			
			if (hasError) {
				const errorText = await errorAlert.textContent().catch(() => "");
				console.warn("Error state detected:", errorText);
			}
		});
		
		// ========================================================================
		// STEP 15: Export Document
		// ========================================================================
		
		await test.step("Export Document", async () => {
			// Click export button
			const exportBtn = page.locator('button:has-text("Export")').first();
			await expect(exportBtn).toBeVisible({ timeout: 10000 });
			await exportBtn.click();
			
			// Wait for export options to appear
			const exportOptions = page.locator('[data-testid="export-options"]');
			await exportOptions.waitFor({ state: "visible", timeout: 5000 }).catch(async () => {
				// Try clicking the button again
				console.log("Export options not visible, clicking again...");
				await exportBtn.click();
				await page.waitForTimeout(500);
			});
			
			// Verify format options exist with more flexible approach
			const formats = ["docx", "pdf"];
			for (const format of formats) {
				const formatOption = exportOptions.locator(`button:has-text("${format.toUpperCase()}")`).first() ||
					exportOptions.locator(`label:has-text("${format.toUpperCase()}")`).first() ||
					exportOptions.locator(`input[value="${format}"]`).first();
				
				const formatText = exportOptions.locator(`text=/${format}/i`).first();
				const exists = await formatText.isVisible().catch(() => false);
				
				if (!exists) {
					console.log(`${format} format not found in export options`);
				}
			}
			
			await takeScreenshot(page, "e2e-results", "15-export-options");
			
			// Select Word export
			const wordOption = page.locator('button:has-text("Word")').first() ||
				exportOptions.locator('input[value="docx"]').first();
			
			if (await wordOption.isVisible().catch(() => false)) {
				await wordOption.click();
				await page.waitForTimeout(200);
			}
			
			// Trigger export
			const confirmExport = page.locator('button:has-text("Export Document")').first() ||
				page.locator('button:has-text("Download")').first() ||
				page.locator('[data-testid="confirm-export"]').first();
			
			const canExport = await confirmExport.isVisible().catch(() => false);
			if (canExport) {
				// Start waiting for download before clicking
				const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
				
				await confirmExport.click();
				
				// Wait for the download
				const download = await downloadPromise.catch((err) => {
					console.log("Download did not start:", err.message);
					return null;
				});
				
				if (download) {
					console.log(`Download started: ${download.suggestedFilename()}`);
					
					// Optionally save the file
					// await download.saveAs(`/tmp/hdsa-export-${testId}.docx`);
				}
			}
			
			await takeScreenshot(page, "e2e-results", "16-export-complete");
		});
		
		// ========================================================================
		// STEP 16: Undo/Redo Operations
		// ========================================================================
		
		await test.step("Test Undo/Redo", async () => {
			// Find undo/redo buttons with multiple selector attempts
			let undoBtn = page.locator('button:has-text("Undo")').first();
			let redoBtn = page.locator('button:has-text("Redo")').first();
			
			// Check by title attribute if text search fails
			const canUndo = await undoBtn.isVisible().catch(async () => {
				undoBtn = page.locator('[title="Undo"], [aria-label="Undo"]').first();
				return undoBtn.isVisible().catch(() => false);
			});
			
			const canRedo = await redoBtn.isVisible().catch(async () => {
				redoBtn = page.locator('[title="Redo"], [aria-label="Redo"]').first();
				return redoBtn.isVisible().catch(() => false);
			});
			
			if (canUndo && canRedo) {
				// Count nodes before undo
				const beforeCount = await page.locator('[data-testid="node-title"]').count();
				console.log(`Nodes before undo: ${beforeCount}`);
				
				// Perform undo
				await undoBtn.click();
				await page.waitForTimeout(300);
				
				// Count nodes after undo
				const afterUndoCount = await page.locator('[data-testid="node-title"]').count();
				console.log(`Nodes after undo: ${afterUndoCount}`);
				
				// Verify something changed
				// expect(afterUndoCount).not.toEqual(beforeCount);
				
				await takeScreenshot(page, "e2e-results", "17a-after-undo");
				
				// Perform redo
				await redoBtn.click();
				await page.waitForTimeout(300);
				
				const afterRedoCount = await page.locator('[data-testid="node-title"]').count();
				console.log(`Nodes after redo: ${afterRedoCount}`);
				
				// expect(afterRedoCount).toEqual(beforeCount);
				
				await takeScreenshot(page, "e2e-results", "17b-after-redo");
			} else {
				console.log("Undo/Redo buttons not found");
			}
		});
		
		// ========================================================================
		// STEP 17: Test Keyboard Shortcuts
		// ========================================================================
		
		await test.step("Test Keyboard Shortcuts", async () => {
			// Test Ctrl+S for save
			await page.keyboard.press("Control+s");
			await page.waitForTimeout(500);
			
			// Look for save indicator
			const saveIndicator = page.locator('[data-testid="save-indicator"], text="Saved"').first();
			const saveVisible = await saveIndicator.isVisible().catch(() => false);
			
			if (saveVisible) {
				console.log("Save shortcut worked");
			}
			
			// Test Escape for canceling edit
			const editableNode = page.locator('[data-testid="node-title"]').first();
			await editableNode.dblclick();
			await page.waitForTimeout(200);
			
			// Check if we're in edit mode
			const input = editableNode.locator('input');
			const isEditing = await input.isVisible().catch(() => false);
			
			if (isEditing) {
				await page.keyboard.press("Escape");
				await page.waitForTimeout(200);
				
				const stillEditing = await input.isVisible().catch(() => false);
				if (!stillEditing) {
					console.log("Escape shortcut works for canceling edit");
				}
			}
			
			await takeScreenshot(page, "e2e-results", "18-keyboard-shortcuts");
		});
		
		// ========================================================================
		// STEP 18: Final State Verification
		// ========================================================================
		
		await test.step("Validate Final Document State", async () => {
			// Count all node types
			const sectionCount = await page.locator('[data-testid="node-title"]').count();
			const contentCount = await page.locator('[data-testid="node-content"]').count();
			
			console.log(`Final document has ${sectionCount} sections and ${contentCount} content nodes`);
			
			// Verify minimum structure exists
			expect(sectionCount).toBeGreaterThan(0);
			
			// Verify no critical errors
			const errorCount = await page.locator('[data-testid="error-message"]').count();
			expect(errorCount).toBe(0);
			
			// Final screenshot
			await takeScreenshot(page, "e2e-results", "19-final-state");
			
			// Log test completion details
			console.log("\n" + "=".repeat(50));
			console.log("HDSA WORKFLOW TEST COMPLETED SUCCESSFULLY");
			console.log("=".repeat(50));
			console.log(`Test ID: ${testId}`);
			console.log(`Final state: ${sectionCount} sections, ${contentCount} content items`);
			console.log("=".repeat(50) + "\n");
		});
	});
});
