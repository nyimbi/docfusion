"use client";

/**
 * AI Settings Component - DocFusion
 *
 * User interface for configuring AI providers.
 */

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Cloud,
	Laptop,
	Zap,
	AlertCircle,
	CheckCircle2,
	RefreshCw,
	Loader2,
	Settings2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AISettingsFormData } from "@/lib/ai/types";
import type { AIProviderType } from "@/lib/ai/providers/types";
import {
	loadAISettings,
	saveAISettings,
	testAIConnections,
	testOllamaSettings,
	validateAISettings,
} from "@/lib/ai/actions";
import { RECOMMENDED_OLLAMA_MODELS } from "@/lib/ai/types";

const PROVIDER_OPTIONS = [
	{
		value: "auto",
		label: "Auto (Recommended)",
		description: "Automatically select the best available provider",
		icon: Zap,
	},
	{
		value: "azure-openai",
		label: "Azure OpenAI",
		description: "Enterprise AI through Microsoft Azure",
		icon: Cloud,
	},
	{
		value: "ollama",
		label: "Ollama (Local)",
		description: "Run AI locally on your machine",
		icon: Laptop,
	},
] as const;

/**
 * AI Settings Panel Component
 */
export function AISettingsPanel() {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("general");
	const [testResults, setTestResults] = useState<
		Record<AIProviderType, { success: boolean; message: string }> | undefined
	>();

	// Load current settings
	const { data: settingsData, isLoading } = useQuery({
		queryKey: ["ai-settings"],
		queryFn: async () => {
			const result = await loadAISettings();
			if (result.success && result.data) {
				return result.data;
			}
			throw new Error(result.error || "Failed to load settings");
		},
	});

	// Form state
	const [formState, setFormState] = useState<AISettingsFormData>({
		provider: "auto",
		ollamaUrl: "http://localhost:11434",
		ollamaModel: "gpt-oss",
		temperature: 0.7,
		maxTokens: 2048,
		streamEnabled: true,
		showConfidence: true,
	});

	// Update form when settings load
	useMutation({
		mutationKey: ["update-form-state"],
		mutationFn: (data: AISettingsFormData) => {
			setFormState(data);
			return Promise.resolve();
		},
	});

	// Initialize form state when data loads
	if (settingsData && !testResults) {
		// Only set once to avoid overwriting user changes
		const timeout = setTimeout(() => {
			setFormState(settingsData);
		}, 0);
		clearTimeout(timeout);
	}

	// Save mutation
	const saveMutation = useMutation({
		mutationFn: saveAISettings,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
			setTestResults(undefined);
		},
	});

	// Test connections
	const testMutation = useMutation({
		mutationFn: testAIConnections,
		onSuccess: (data) => {
			if (data.success && data.results) {
				setTestResults(data.results);
			}
		},
	});

	// Test Ollama specific
	const testOllamaMutation = useMutation({
		mutationFn: () => testOllamaSettings(formState.ollamaUrl, formState.ollamaModel),
		onSuccess: (data) => {
			if (data.success && data.result) {
				setTestResults({
					ollama: data.result,
					"azure-openai": { success: false, message: "Not tested" },
					openai: { success: false, message: "Not tested" },
				});
			}
		},
	});

	// Validate mutation
	const validateMutation = useMutation({
		mutationFn: validateAISettings,
	});

	const handleProviderChange = useCallback((value: string) => {
		setFormState((prev) => ({
			...prev,
			provider: value as AISettingsFormData["provider"],
		}));
		setTestResults(undefined);
	}, []);

	const handleSave = useCallback(async () => {
		// Validate first
		const validateResult = await validateMutation.mutateAsync(formState);
		if (!validateResult.success) {
			return;
		}

		saveMutation.mutate(formState);
	}, [formState, saveMutation, validateMutation]);

	const isOllamaActive = formState.provider === "ollama" || formState.provider === "auto";

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Loader2 className="h-5 w-5 animate-spin" />
						Loading AI Settings...
					</CardTitle>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card className="w-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Settings2 className="h-5 w-5" />
							AI Configuration
						</CardTitle>
						<CardDescription>
							Configure AI providers for document generation and analysis
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="general">General Settings</TabsTrigger>
						<TabsTrigger value="providers">Provider Settings</TabsTrigger>
					</TabsList>

					{/* General Settings Tab */}
					<TabsContent value="general" className="space-y-6">
						{/* Provider Selection */}
						<div className="space-y-3">
							<Label>AI Provider</Label>
							<div className="grid gap-3">
								{PROVIDER_OPTIONS.map((option) => {
									const Icon = option.icon;
									const isSelected = formState.provider === option.value;
									const isAvailable =
										option.value === "azure-openai"
											? testResults?.["azure-openai"]?.success ?? true
											: true;

									return (
										<label
											key={option.value}
											className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${
												isSelected
													? "border-primary bg-primary/5"
													: "border-border hover:bg-accent"
											} ${!isAvailable ? "opacity-60" : ""}`}
										>
											<input
												type="radio"
												name="provider"
												value={option.value}
												checked={isSelected}
												onChange={() => handleProviderChange(option.value)}
												className="sr-only"
											/>
											<Icon
												className={`h-5 w-5 ${
													isSelected ? "text-primary" : "text-muted-foreground"
												}`}
											/>
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<span className="font-medium">{option.label}</span>
													{isSelected && (
														<CheckCircle2 className="h-4 w-4 text-primary" />
													)}
												</div>
												<p className="text-sm text-muted-foreground">
													{option.description}
												</p>
												{testResults?.[option.value as AIProviderType] && (
													<span
														className={`text-xs ${
															testResults[option.value as AIProviderType]?.success
																? "text-green-600"
																: "text-red-600"
														}`}
													>
														{testResults[option.value as AIProviderType]?.message}
													</span>
												)}
											</div>
										</label>
									);
								})}
							</div>
						</div>

						{/* Temperature Setting */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="temperature">Temperature</Label>
								<span className="text-sm text-muted-foreground">
									{formState.temperature.toFixed(2)}
								</span>
							</div>
							<Slider
								id="temperature"
								min={0}
								max={1}
								step={0.1}
								value={[formState.temperature]}
								onValueChange={([value]) =>
									setFormState((prev) => ({ ...prev, temperature: value }))
								}
							/>
							<p className="text-xs text-muted-foreground">
								Lower values make the AI more focused and deterministic.
							</p>
						</div>

						{/* Max Tokens Setting */}
						<div className="space-y-3">
							<Label htmlFor="maxTokens">Max Tokens</Label>
							<Input
								id="maxTokens"
								type="number"
								min={1}
								max={16384}
								value={formState.maxTokens}
								onChange={(e) =>
									setFormState((prev) => ({
										...prev,
										maxTokens: parseInt(e.target.value) || 2048,
									}))
								}
							/>
						</div>

						{/* Toggle Options */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<Label htmlFor="streamEnabled">Enable Streaming</Label>
								<Switch
									id="streamEnabled"
									checked={formState.streamEnabled}
									onCheckedChange={(checked) =>
										setFormState((prev) => ({
											...prev,
											streamEnabled: checked,
										}))
									}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="showConfidence">Show Confidence Scores</Label>
								<Switch
									id="showConfidence"
									checked={formState.showConfidence}
									onCheckedChange={(checked) =>
										setFormState((prev) => ({
											...prev,
											showConfidence: checked,
										}))
									}
								/>
							</div>
						</div>
					</TabsContent>

					{/* Provider Settings Tab */}
					<TabsContent value="providers" className="space-y-6">
						<div className="space-y-4">
							<h3 className="text-sm font-medium flex items-center gap-2">
								<Laptop className="h-4 w-4" />
								Ollama Configuration
							</h3>

							<div className="space-y-2">
								<Label htmlFor="ollamaUrl">Ollama URL</Label>
								<Input
									id="ollamaUrl"
									placeholder="http://localhost:11434"
									value={formState.ollamaUrl}
									onChange={(e) =>
										setFormState((prev) => ({
											...prev,
											ollamaUrl: e.target.value,
										}))
									}
									disabled={!isOllamaActive}
								/>
								<p className="text-xs text-muted-foreground">
									For local access, use <code>http://localhost:11434</code>. For
									network access, use the machine's IP address.
									<a
										href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-web-origins-to-access-ollama"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline ml-1"
									>
										CORS setup required
									</a>
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="ollamaModel">Default Model</Label>
								<Select
									disabled={!isOllamaActive}
									value={formState.ollamaModel}
									onValueChange={(value) =>
										setFormState((prev) => ({
											...prev,
											ollamaModel: value,
										}))
									}
								>
									<SelectTrigger id="ollamaModel">
										<SelectValue placeholder="Select a model" />
									</SelectTrigger>
									<SelectContent>
										{RECOMMENDED_OLLAMA_MODELS.map((model) => (
											<SelectItem key={model.id} value={model.id}>
												<div>
													<div className="font-medium">{model.name}</div>
													<div className="text-xs text-muted-foreground">
														{model.description}
													</div>
												</div>
											</SelectItem>
										))}
										<SelectItem value="custom">Custom Model...</SelectItem>
									</SelectContent>
								</Select>
								{formState.ollamaModel === "custom" && (
									<Input
										placeholder="Enter model name (e.g., llama3:70b)"
										onChange={(e) =>
											setFormState((prev) => ({
												...prev,
												ollamaModel: e.target.value,
											}))
										}
									/>
								)}
							</div>

							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => testOllamaMutation.mutate()}
									disabled={testOllamaMutation.isPending || !isOllamaActive}
								>
									{testOllamaMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
									) : (
										<RefreshCw className="h-4 w-4 mr-2" />
									)}
									Test Connection
								</Button>
								<a
									href="https://ollama.com"
									target="_blank"
									rel="noopener noreferrer"
								>
									<Button variant="ghost" size="sm">
										Install Ollama
									</Button>
								</a>
							</div>

							{testOllamaMutation.data?.result && !testOllamaMutation.data.result.success && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Connection Failed</AlertTitle>
									<AlertDescription>
										{testOllamaMutation.data.result.message}
										! isOllamaActive && (
											<p className="mt-2 text-sm">
												Enable Ollama in the &quot;AI Provider&quot; setting above to use
												it.
											</p>
										)
									</AlertDescription>
								</Alert>
							)}
						</div>

						{/* Azure OpenAI Info */}
						<div className="space-y-4">
							<h3 className="text-sm font-medium flex items-center gap-2">
								<Cloud className="h-4 w-4" />
								Azure OpenAI
							</h3>
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Environment Configuration</AlertTitle>
								<AlertDescription>
									Azure OpenAI is configured via environment variables
									(AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT,
									AZURE_OPENAI_DEPLOYMENT_NAME). Contact your administrator to
									modify Azure settings.
								</AlertDescription>
							</Alert>
						</div>
					</TabsContent>
				</Tabs>

				{/* Bottom Actions */}
				<div className="flex items-center justify-between pt-4 border-t">
					<Button
						variant="outline"
						onClick={() => testMutation.mutate()}
						disabled={testMutation.isPending}
					>
						{testMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<RefreshCw className="h-4 w-4 mr-2" />
						)}
						Test All Connections
					</Button>

					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => settingsData && setFormState(settingsData)}
							disabled={!settingsData}
						>
							Reset
						</Button>
						<Button onClick={handleSave} disabled={saveMutation.isPending}>
							{saveMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : null}
							Save Settings
						</Button>
					</div>
				</div>

				{/* Success/Error Messages */}
				{saveMutation.isSuccess && (
					<Alert className="bg-green-50 text-green-900 border-green-200">
						<CheckCircle2 className="h-4 w-4 text-green-600" />
						<AlertTitle>Settings Saved</AlertTitle>
						<AlertDescription>
							Your AI configuration has been saved successfully.
						</AlertDescription>
					</Alert>
				)}

				{saveMutation.isError && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Save Failed</AlertTitle>
						<AlertDescription>
							{saveMutation.error instanceof Error
								? saveMutation.error.message
								: "Failed to save settings"}
						</AlertDescription>
					</Alert>
				)}
			</CardContent>
		</Card>
	);
}
