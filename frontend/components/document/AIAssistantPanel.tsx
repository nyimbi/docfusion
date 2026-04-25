"use client";

/**
 * AI Assistant Panel - Floating AI chat and command interface.
 *
 * Features:
 * - AI chat interface for document questions
 * - Slash command execution
 * - Context-aware suggestions
 * - Real-time streaming responses
 * - History of AI interactions
 */

import * as React from "react";
import { type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
	Sparkles,
	Send,
	X,
	Bot,
	User,
	Copy,
	Check,
	RotateCcw,
	Lightbulb,
	Wand2,
	Maximize2,
	Minimize2,
	MessageSquare,
} from "lucide-react";
import { useAIStore } from "@/lib/stores/ai-store";
import type { AICommand, AIContext, AIStreamChunk } from "@/lib/types/ai";
import type { DocumentMetadata } from "@/lib/types/document";
import { AI_COMMANDS, getAICommand, parseSlashCommand } from "@/lib/types/ai";
import { generateId } from "@/lib/utils";

interface AIAssistantPanelProps {
	documentId: string;
	editor: Editor | null;
	/** Document title for context */
	documentTitle?: string;
	/** Document metadata (RFP info, client, due date, etc.) */
	documentMetadata?: DocumentMetadata;
	onClose?: () => void;
	className?: string;
}

interface AIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	command?: string;
	isStreaming?: boolean;
}

export function AIAssistantPanel({
	documentId,
	editor,
	documentTitle,
	documentMetadata,
	onClose,
	className,
}: AIAssistantPanelProps) {
	const [messages, setMessages] = React.useState<AIMessage[]>([
		{
			id: "welcome",
			role: "system",
			content: `Welcome! I'm your AI assistant. You can:
• Ask questions about your document
• Use /commands for quick actions
• Get writing suggestions
• Generate content`,
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);
	const [selectedCommand, setSelectedCommand] = React.useState<AICommand | null>(null);
	const [showCommands, setShowCommands] = React.useState(false);
	const [isExpanded, setIsExpanded] = React.useState(false);
	const messagesEndRef = React.useRef<HTMLDivElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

	const isCommandPaletteOpen = useAIStore((s) => s.isCommandPaletteOpen);
	const openCommandPalette = useAIStore((s) => s.openCommandPalette);
	const closeCommandPalette = useAIStore((s) => s.closeCommandPalette);
	const pendingCommand = useAIStore((s) => s.pendingCommand);
	const generateCompletion = useAIStore((s) => s.generateCompletion);
	const streamingEnabled = useAIStore((s) => s.streamingEnabled);

	// Auto-scroll to bottom
	React.useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Focus input when opened
	React.useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// Handle pending command from store
	React.useEffect(() => {
		if (pendingCommand) {
			handleCommandExecution(pendingCommand);
			closeCommandPalette();
		}
	}, [pendingCommand, closeCommandPalette]);

	// Build AI context from editor state
	const buildAIContext = React.useCallback((): AIContext => {
		if (!editor) {
			return {
				documentId,
				documentTitle,
				textBefore: "",
				textAfter: "",
				metadata: documentMetadata as Record<string, unknown> | undefined,
			};
		}

		const { selection } = editor.state;
		const selectedText = editor.state.doc.textBetween(selection.from, selection.to);
		const textBefore = editor.state.doc.textBetween(0, selection.from).slice(-500);
		const textAfter = editor.state.doc.textBetween(selection.to, editor.state.doc.content.size).slice(0, 500);

		return {
			documentId,
			documentTitle,
			textBefore,
			textAfter,
			selectedText: selectedText || undefined,
			blockType: selection.$from.parent.type.name,
			metadata: documentMetadata as Record<string, unknown> | undefined,
		};
	}, [editor, documentId, documentTitle, documentMetadata]);

	const handleSend = async () => {
		if (!input.trim() || isLoading) return;

		const userMessage: AIMessage = {
			id: generateId(),
			role: "user",
			content: input,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		// Check if it's a slash command
		const parsed = parseSlashCommand(input);
		if (parsed) {
			const command = getAICommand(parsed.command);
			if (command) {
				handleCommandExecution(command, parsed.args);
				return;
			}
		}

		// Regular chat message - call AI API
		await streamAIResponse("chat", {
			command: "chat",
			prompt: input,
		});
	};

	const handleCommandExecution = async (command: AICommand, args: string[] = []) => {
		const userMessage: AIMessage = {
			id: generateId(),
			role: "user",
			content: `/${command.name} ${args.join(" ")}`,
			timestamp: new Date(),
			command: command.name,
		};

		setMessages((prev) => [...prev, userMessage]);
		setIsLoading(true);

		// Execute command based on type
		switch (command.name) {
			case "improve":
				await handleImproveCommand();
				break;
			case "expand":
				await handleExpandCommand();
				break;
			case "condense":
				await handleCondenseCommand();
				break;
			case "summarize":
				await handleSummarizeCommand();
				break;
			case "continue":
				await handleContinueCommand();
				break;
			case "tone":
				await handleToneCommand(args[0] || "professional");
				break;
			default:
				await streamAIResponse("help", {
					command: command.name,
					prompt: `Help with command: ${command.name}`,
				});
				break;
		}
	};

	const handleImproveCommand = async () => {
		if (!editor) {
			addAssistantMessage("Please select text to improve.");
			setIsLoading(false);
			return;
		}

		const selection = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(selection.from, selection.to);

		if (!selectedText) {
			addAssistantMessage("Please select some text to improve first.");
			setIsLoading(false);
			return;
		}

		await streamAIResponse("improving", {
			command: "improve",
			prompt: `Improve the following text to make it clearer, more professional, and better structured:\n\n${selectedText}`,
		});
	};

	const handleExpandCommand = async () => {
		if (!editor) {
			addAssistantMessage("Please select text to expand.");
			setIsLoading(false);
			return;
		}

		const selection = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(selection.from, selection.to);

		if (!selectedText) {
			addAssistantMessage("Please select text to expand.");
			setIsLoading(false);
			return;
		}

		await streamAIResponse("expanding", {
			command: "expand",
			prompt: `Expand the following text with more detail and context:\n\n${selectedText}`,
		});
	};

	const handleCondenseCommand = async () => {
		if (!editor) {
			addAssistantMessage("Please select text to condense.");
			setIsLoading(false);
			return;
		}

		const selection = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(selection.from, selection.to);

		if (!selectedText) {
			addAssistantMessage("Please select text to condense.");
			setIsLoading(false);
			return;
		}

		await streamAIResponse("condensing", {
			command: "condense",
			prompt: `Condense the following text to make it more concise while preserving key information:\n\n${selectedText}`,
		});
	};

	const handleSummarizeCommand = async () => {
		if (!editor) {
			addAssistantMessage("Please select text to summarize.");
			setIsLoading(false);
			return;
		}

		const selection = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(selection.from, selection.to);

		if (!selectedText) {
			addAssistantMessage("Please select text to summarize.");
			setIsLoading(false);
			return;
		}

		await streamAIResponse("summarizing", {
			command: "summarize",
			prompt: `Summarize the following text concisely:\n\n${selectedText}`,
		});
	};

	const handleContinueCommand = async () => {
		await streamAIResponse("continuing", {
			command: "continue",
			prompt: "Continue writing from this point, maintaining the same style and tone.",
		});
	};

	const handleToneCommand = async (tone: string) => {
		if (!editor) {
			addAssistantMessage("Please select text to adjust the tone.");
			setIsLoading(false);
			return;
		}

		const selection = editor.state.selection;
		const selectedText = editor.state.doc.textBetween(selection.from, selection.to);

		if (!selectedText) {
			addAssistantMessage("Please select text to adjust the tone.");
			setIsLoading(false);
			return;
		}

		await streamAIResponse("adjusting tone", {
			command: "tone",
			prompt: `Rewrite the following text with a ${tone} tone:\n\n${selectedText}`,
		});
	};

	const streamAIResponse = async (
		action: string,
		params: { command: string; prompt: string }
	) => {
		const assistantMessageId = generateId();
		const assistantMessage: AIMessage = {
			id: assistantMessageId,
			role: "assistant",
			content: "⏳ " + action + "...",
			timestamp: new Date(),
			isStreaming: true,
		};

		setMessages((prev) => [...prev, assistantMessage]);

		let accumulatedContent = "";

		try {
			await generateCompletion(
				{
					command: params.command,
					context: buildAIContext(),
					stream: streamingEnabled,
					// Send the prompt as an additional argument
					arguments: { prompt: params.prompt },
				},
				{
					onChunk: (chunk: AIStreamChunk) => {
						accumulatedContent += chunk.delta || "";
						// Update content with accumulated text
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? { ...msg, content: accumulatedContent, isStreaming: true }
									: msg
							)
						);
					},
					onComplete: () => {
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? { ...msg, content: accumulatedContent, isStreaming: false }
									: msg
							)
						);
						setIsLoading(false);
					},
					onError: (error: string) => {
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? {
											...msg,
											content: `❌ Error: ${error}`,
											isStreaming: false,
										}
									: msg
							)
						);
						toast.error("AI request failed: " + error);
						setIsLoading(false);
					},
				}
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId
						? {
								...msg,
								content: `❌ Error: ${errorMessage}`,
								isStreaming: false,
							}
						: msg
				)
			);
			toast.error("AI request failed: " + errorMessage);
			setIsLoading(false);
		}
	};

	const addAssistantMessage = (content: string) => {
		const message: AIMessage = {
			id: generateId(),
			role: "assistant",
			content,
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, message]);
		setIsLoading(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleInputChange = (value: string) => {
		setInput(value);

		// Show command suggestions if starts with /
		if (value.startsWith("/")) {
			setShowCommands(true);
		} else {
			setShowCommands(false);
		}
	};

	const filteredCommands = AI_COMMANDS.filter((cmd) =>
		cmd.name.toLowerCase().includes(input.slice(1).toLowerCase())
	);

	return (
		<div
			className={cn(
				"flex flex-col h-full bg-[var(--background)]",
				className
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b">
				<div className="flex items-center gap-2">
					<div className="p-1.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
						<Bot className="h-4 w-4" />
					</div>
					<div>
						<h3 className="font-semibold text-sm">AI Assistant</h3>
						<p className="text-xs text-muted-foreground">
							Type / for commands
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="sm" onClick={() => setMessages([])}>
								<RotateCcw className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Clear chat</TooltipContent>
					</Tooltip>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Messages */}
			<ScrollArea className="flex-1 px-4 py-3">
				<div className="space-y-4">
					{messages.map((message) => (
						<MessageBubble key={message.id} message={message} editor={editor} />
					))}
					{isLoading && (
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<div className="animate-pulse flex gap-1">
								<span className="w-2 h-2 rounded-full bg-current" />
								<span className="w-2 h-2 rounded-full bg-current" />
								<span className="w-2 h-2 rounded-full bg-current" />
							</div>
							<span>Thinking...</span>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>
			</ScrollArea>

			{/* Command suggestions */}
			{showCommands && input.startsWith("/") && (
				<div className="border-t px-4 py-2 bg-muted/50">
					<p className="text-xs text-muted-foreground mb-2">Available commands:</p>
					<div className="space-y-1">
						{filteredCommands.slice(0, 5).map((cmd) => (
							<button
								key={cmd.id}
								type="button"
								className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors flex items-center gap-2"
								onClick={() => {
									setInput(`/${cmd.name} `);
									setShowCommands(false);
									inputRef.current?.focus();
								}}
							>
								<Wand2 className="h-3 w-3 text-muted-foreground" />
								<span className="font-medium">/{cmd.name}</span>
								<span className="text-muted-foreground text-xs">
									{cmd.label}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Quick commands */}
			{!showCommands && (
				<div className="border-t px-4 py-2 flex gap-2 overflow-x-auto">
					{AI_COMMANDS.slice(0, 4).map((cmd) => (
						<Button
							key={cmd.id}
							variant="secondary"
							size="sm"
							className="text-xs whitespace-nowrap"
							onClick={() => {
								setInput(`/${cmd.name} `);
								inputRef.current?.focus();
							}}
							disabled={isLoading}
						>
							<Sparkles className="h-3 w-3 mr-1" />
							{cmd.label}
						</Button>
					))}
				</div>
			)}

			{/* Input */}
			<div className="p-4 border-t">
				<div className="flex gap-2">
					<Input
						ref={inputRef}
						value={input}
						onChange={(e) => handleInputChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask AI or type / for commands..."
						className="flex-1"
						disabled={isLoading}
					/>
					<Button
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
					>
						<Send className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
	message: AIMessage;
	editor: Editor | null;
}

function MessageBubble({ message, editor }: MessageBubbleProps) {
	const [isCopied, setIsCopied] = React.useState(false);
	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.content);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
			toast.success("Copied to clipboard");
		} catch {
			toast.error("Failed to copy");
		}
	};

	const handleApply = () => {
		if (!editor) return;

		const selection = editor.state.selection;
		editor
			.chain()
			.focus()
			.insertContentAt(selection.from, message.content)
			.run();

		toast.success("Content applied to document");
	};

	return (
		<div
			className={cn(
				"flex gap-3",
				isUser ? "flex-row-reverse" : "flex-row"
			)}
		>
			{/* Avatar */}
			<div
				className={cn(
					"w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
					isUser
						? "bg-primary text-primary-foreground"
						: isSystem
							? "bg-muted text-muted-foreground"
							: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
				)}
			>
				{isUser ? (
					<User className="h-4 w-4" />
				) : (
					<Bot className="h-4 w-4" />
				)}
			</div>

			{/* Content */}
			<div
				className={cn(
					"flex-1 max-w-[85%]",
					isUser && "text-right"
				)}
			>
				<div
					className={cn(
						"inline-block px-3 py-2 rounded-lg text-sm",
						isUser
							? "bg-primary text-primary-foreground"
							: isSystem
								? "bg-muted text-muted-foreground"
								: "bg-muted border"
					)}
				>
					{message.isStreaming ? (
						<span className="animate-pulse">{message.content}</span>
					) : (
						<div className="whitespace-pre-wrap">{message.content}</div>
					)}
				</div>

				{/* Actions */}
				{!isUser && !isSystem && !message.isStreaming && (
					<div className="flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 transition-opacity">
						{editor && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 text-xs"
								onClick={handleApply}
							>
								Apply to document
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0"
							onClick={handleCopy}
						>
							{isCopied ? (
								<Check className="h-3 w-3" />
							) : (
								<Copy className="h-3 w-3" />
							)}
						</Button>
					</div>
				)}

				{/* Timestamp */}
				<span className="text-[10px] text-muted-foreground mt-1 block">
					{message.timestamp.toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			</div>
		</div>
	);
}
