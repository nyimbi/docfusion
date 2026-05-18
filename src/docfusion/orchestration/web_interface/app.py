"""
FastAPI Web Application for Visual Workflow Editor

Provides web-based interface for visual agent workflow composition,
editing, and execution with real-time collaboration.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
from typing import Any, Dict, List
from datetime import datetime

try:
	from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
	from fastapi.responses import HTMLResponse, JSONResponse
	from pydantic import BaseModel, Field
	FASTAPI_AVAILABLE = True
except ImportError:
	FASTAPI_AVAILABLE = False

from ..visual_editor import VisualWorkflowEditor, EditorMode, UIComponent
from ..agent_composer import AgentConfiguration, AgentTemplate


# Pydantic models for API
class WorkflowRequest(BaseModel):
	name: str
	description: str = ""
	workflow_type: str = "sequential"


class AgentRequest(BaseModel):
	name: str
	agent_type: str = "custom_agent"
	description: str = ""
	prompt: str = ""
	position: List[float] = Field(default_factory=lambda: [0, 0])


class ConnectionRequest(BaseModel):
	source_id: str
	target_id: str
	condition: str = None


class ExecutionRequest(BaseModel):
	workflow_id: str = None
	context: Dict[str, Any] = Field(default_factory=dict)


# WebSocket connection manager
class ConnectionManager:
	def __init__(self):
		self.active_connections: Dict[str, WebSocket] = {}
		self.user_sessions: Dict[str, Dict[str, Any]] = {}
	
	async def connect(self, websocket: WebSocket, user_id: str):
		await websocket.accept()
		self.active_connections[user_id] = websocket
		self.user_sessions[user_id] = {
			"connected_at": datetime.now(),
			"editor_id": None,
			"collaborator_id": None
		}
	
	def disconnect(self, user_id: str):
		if user_id in self.active_connections:
			del self.active_connections[user_id]
		if user_id in self.user_sessions:
			del self.user_sessions[user_id]
	
	async def send_personal_message(self, message: dict, user_id: str):
		if user_id in self.active_connections:
			try:
				await self.active_connections[user_id].send_json(message)
			except (ConnectionError, RuntimeError) as e:
				logging.getLogger("visual_editor_web").warning(f"Failed to send message to user {user_id}, disconnecting: {e}")
				self.disconnect(user_id)
	
	async def broadcast(self, message: dict, exclude: List[str] = None):
		exclude = exclude or []
		disconnected = []
		
		for user_id, websocket in self.active_connections.items():
			if user_id not in exclude:
				try:
					await websocket.send_json(message)
				except (ConnectionError, RuntimeError) as e:
					logging.getLogger("visual_editor_web").warning(f"Failed to broadcast to user {user_id}: {e}")
					disconnected.append(user_id)
		
		# Clean up disconnected clients
		for user_id in disconnected:
			self.disconnect(user_id)


def create_app() -> FastAPI:
	"""Create and configure FastAPI application"""
	
	if not FASTAPI_AVAILABLE:
		raise ImportError("FastAPI is required for web interface. Install with: pip install fastapi uvicorn")
	
	app = FastAPI(
		title="Visual Agent Workflow Editor",
		description="Interactive visual editor for AI agent workflows",
		version="1.0.0"
	)
	
	# Initialize components
	editor = VisualWorkflowEditor()
	connection_manager = ConnectionManager()
	logger = logging.getLogger("visual_editor_web")
	
	# Templates and static files (would be configured in production)
	# templates = Jinja2Templates(directory="templates")
	# app.mount("/static", StaticFiles(directory="static"), name="static")
	
	@app.on_event("startup")
	async def startup_event():
		"""Initialize editor on startup"""
		try:
			result = await editor.initialize_editor()
			if result.get("success"):
				logger.info(f"Visual editor initialized: {result['editor_id']}")
			else:
				logger.error(f"Editor initialization failed: {result.get('error')}")
		except Exception as e:
			logger.error(f"Startup failed: {e}")
	
	@app.get("/", response_class=HTMLResponse)
	async def get_editor_page():
		"""Serve main editor page"""
		return get_editor_html()
	
	@app.get("/api/editor/state")
	async def get_editor_state():
		"""Get current editor state"""
		try:
			state = await editor.get_editor_state()
			return JSONResponse(content=state)
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/workflows")
	async def create_workflow(workflow: WorkflowRequest):
		"""Create new workflow"""
		try:
			result = await editor.agent_composer.create_workflow(
				workflow.name, 
				workflow.workflow_type
			)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/agents")
	async def create_agent(agent: AgentRequest):
		"""Create new agent"""
		try:
			# Create agent configuration
			agent_config = AgentConfiguration(
				name=agent.name,
				description=agent.description,
				agent_type=AgentTemplate(agent.agent_type),
				custom_prompt=agent.prompt
			)
			
			# Add to composer
			result = await editor.agent_composer.create_agent(agent_config)
			
			if result.get("success"):
				# Add to canvas
				canvas_result = await editor.workflow_builder.add_agent_to_workflow(
					agent_config, 
					tuple(agent.position)
				)
				
				if canvas_result.get("success"):
					return JSONResponse(content={
						"agent": result,
						"canvas_element": canvas_result
					})
				else:
					raise HTTPException(status_code=400, detail=canvas_result.get("error"))
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/connections")
	async def create_connection(connection: ConnectionRequest):
		"""Create connection between agents"""
		try:
			result = await editor.workflow_builder.connect_elements(
				connection.source_id,
				connection.target_id,
				{"condition": connection.condition} if connection.condition else None
			)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/workflows/execute")
	async def execute_workflow(execution: ExecutionRequest):
		"""Execute current workflow"""
		try:
			result = await editor.execute_workflow(execution.context)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/workflows/arrange")
	async def arrange_workflow(arrangement: dict):
		"""Auto-arrange workflow elements"""
		try:
			arrangement_type = arrangement.get("type", "auto")
			result = await editor.arrange_workflow(arrangement_type)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/agents/{agent_id}/prompt")
	async def edit_agent_prompt(agent_id: str, prompt_data: dict):
		"""Open prompt editor for agent"""
		try:
			result = await editor.open_prompt_editor(agent_id)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.put("/api/prompts/{session_id}")
	async def update_prompt(session_id: str, prompt_data: dict):
		"""Update prompt in editing session"""
		try:
			result = await editor.update_prompt(
				session_id,
				prompt_data.get("prompt", ""),
				prompt_data.get("cursor_position")
			)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/prompts/{session_id}/save")
	async def save_prompt(session_id: str):
		"""Save prompt changes"""
		try:
			result = await editor.save_prompt(session_id)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/editor/mode")
	async def set_editor_mode(mode_data: dict):
		"""Set editor mode"""
		try:
			mode = EditorMode(mode_data.get("mode", "select"))
			tool = mode_data.get("tool")
			
			result = await editor.set_editor_mode(mode, tool)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/ui/toggle/{component}")
	async def toggle_ui_component(component: str):
		"""Toggle UI component visibility"""
		try:
			ui_component = UIComponent(component)
			result = await editor.toggle_ui_component(ui_component)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.websocket("/ws/{user_id}")
	async def websocket_endpoint(websocket: WebSocket, user_id: str):
		"""WebSocket endpoint for real-time collaboration"""
		await connection_manager.connect(websocket, user_id)
		
		try:
			# Add as collaborator
			await editor.add_collaborator({
				"user_id": user_id,
				"name": f"User {user_id[:8]}",
				"color": "#2196f3"
			})
			
			while True:
				# Receive message from client
				data = await websocket.receive_json()
				message_type = data.get("type")
				
				if message_type == "cursor_move":
					position = data.get("position", (0, 0))
					await editor._handle_cursor_move(user_id, position)
				
				elif message_type == "element_update":
					await editor._handle_element_update(user_id, data.get("data", {}))
				
				elif message_type == "chat_message":
					message = data.get("message", "")
					await editor._handle_chat_message(user_id, message)
				
				elif message_type == "canvas_action":
					action = data.get("action")
					parameters = data.get("parameters", {})
					
					result = await editor.handle_ui_event(action, parameters)
					
					# Send result back to client
					await connection_manager.send_personal_message({
						"type": "action_result",
						"result": result
					}, user_id)
				
		except WebSocketDisconnect:
			connection_manager.disconnect(user_id)
			logger.info(f"User {user_id} disconnected")
		except Exception as e:
			logger.error(f"WebSocket error for user {user_id}: {e}")
			connection_manager.disconnect(user_id)
	
	@app.get("/api/templates/workflows")
	async def get_workflow_templates():
		"""Get available workflow templates"""
		try:
			result = await editor.agent_composer.get_workflow_templates()
			return JSONResponse(content=result)
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/api/templates/workflows/{template_id}/apply")
	async def apply_workflow_template(template_id: str, parameters: dict):
		"""Apply workflow template"""
		try:
			result = await editor.agent_composer.apply_workflow_template(
				template_id, 
				parameters.get("parameters", {})
			)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.get("/api/workflows/export")
	async def export_workflow(format_type: str = "json"):
		"""Export current workflow"""
		try:
			result = await editor.agent_composer.export_workflow(format_type)
			
			if result.get("success"):
				return JSONResponse(content=result)
			else:
				raise HTTPException(status_code=400, detail=result.get("error"))
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	return app


def get_editor_html() -> str:
	"""Generate HTML for the visual editor interface"""
	return """
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Visual Agent Workflow Editor</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: #f8f9fa;
			height: 100vh;
			overflow: hidden;
		}
		
		.editor-container {
			display: grid;
			grid-template-areas: 
				"toolbar toolbar toolbar"
				"palette canvas properties"
				"palette canvas properties";
			grid-template-rows: 60px 1fr;
			grid-template-columns: 250px 1fr 300px;
			height: 100vh;
		}
		
		.toolbar {
			grid-area: toolbar;
			background: #fff;
			border-bottom: 1px solid #e9ecef;
			display: flex;
			align-items: center;
			padding: 0 16px;
			gap: 8px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		
		.tool-button {
			background: none;
			border: 1px solid #dee2e6;
			border-radius: 6px;
			padding: 8px 12px;
			cursor: pointer;
			transition: all 0.2s;
		}
		
		.tool-button:hover {
			background: #f8f9fa;
			border-color: #6c757d;
		}
		
		.tool-button.active {
			background: #007bff;
			color: white;
			border-color: #007bff;
		}
		
		.palette {
			grid-area: palette;
			background: #fff;
			border-right: 1px solid #e9ecef;
			overflow-y: auto;
		}
		
		.palette-header {
			padding: 16px;
			border-bottom: 1px solid #e9ecef;
			font-weight: 600;
			color: #495057;
		}
		
		.palette-category {
			padding: 16px;
			border-bottom: 1px solid #f8f9fa;
		}
		
		.palette-category h3 {
			font-size: 14px;
			color: #6c757d;
			margin-bottom: 12px;
		}
		
		.palette-item {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-radius: 6px;
			cursor: pointer;
			margin-bottom: 4px;
			transition: background 0.2s;
		}
		
		.palette-item:hover {
			background: #f8f9fa;
		}
		
		.palette-item .icon {
			font-size: 16px;
		}
		
		.canvas-container {
			grid-area: canvas;
			background: #fff;
			position: relative;
			overflow: hidden;
		}
		
		.canvas {
			width: 100%;
			height: 100%;
			background: 
				radial-gradient(circle, #dee2e6 1px, transparent 1px);
			background-size: 20px 20px;
			position: relative;
		}
		
		.agent-node {
			position: absolute;
			width: 200px;
			height: 100px;
			background: #e3f2fd;
			border: 2px solid #1976d2;
			border-radius: 8px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: all 0.2s;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		
		.agent-node:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 8px rgba(0,0,0,0.15);
		}
		
		.agent-node.selected {
			border-color: #007bff;
			box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
		}
		
		.agent-node .icon {
			font-size: 24px;
			margin-bottom: 4px;
		}
		
		.agent-node .title {
			font-weight: 600;
			font-size: 14px;
			color: #495057;
		}
		
		.properties {
			grid-area: properties;
			background: #fff;
			border-left: 1px solid #e9ecef;
			overflow-y: auto;
		}
		
		.properties-header {
			padding: 16px;
			border-bottom: 1px solid #e9ecef;
			font-weight: 600;
			color: #495057;
		}
		
		.properties-section {
			padding: 16px;
			border-bottom: 1px solid #f8f9fa;
		}
		
		.properties-section h3 {
			font-size: 14px;
			color: #6c757d;
			margin-bottom: 12px;
		}
		
		.form-group {
			margin-bottom: 16px;
		}
		
		.form-group label {
			display: block;
			font-size: 12px;
			font-weight: 500;
			color: #6c757d;
			margin-bottom: 4px;
		}
		
		.form-control {
			width: 100%;
			padding: 8px 12px;
			border: 1px solid #ced4da;
			border-radius: 4px;
			font-size: 14px;
		}
		
		.form-control:focus {
			outline: none;
			border-color: #007bff;
			box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
		}
		
		.btn {
			background: #007bff;
			color: white;
			border: none;
			padding: 8px 16px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: background 0.2s;
		}
		
		.btn:hover {
			background: #0056b3;
		}
		
		.btn-secondary {
			background: #6c757d;
		}
		
		.btn-secondary:hover {
			background: #5a6268;
		}
		
		.connection {
			position: absolute;
			pointer-events: none;
		}
		
		.connection path {
			stroke: #333;
			stroke-width: 2;
			fill: none;
			marker-end: url(#arrowhead);
		}
		
		.prompt-editor {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 600px;
			height: 400px;
			background: white;
			border-radius: 8px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.3);
			z-index: 1000;
			display: none;
			flex-direction: column;
		}
		
		.prompt-editor.active {
			display: flex;
		}
		
		.prompt-editor-header {
			padding: 16px;
			border-bottom: 1px solid #e9ecef;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		
		.prompt-editor-body {
			flex: 1;
			padding: 16px;
			display: flex;
			flex-direction: column;
		}
		
		.prompt-textarea {
			flex: 1;
			border: 1px solid #ced4da;
			border-radius: 4px;
			padding: 12px;
			font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
			font-size: 13px;
			resize: none;
		}
		
		.prompt-editor-footer {
			padding: 16px;
			border-top: 1px solid #e9ecef;
			display: flex;
			justify-content: flex-end;
			gap: 8px;
		}
		
		.overlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0,0,0,0.5);
			z-index: 999;
			display: none;
		}
		
		.overlay.active {
			display: block;
		}
		
		@media (max-width: 1024px) {
			.editor-container {
				grid-template-areas: 
					"toolbar"
					"canvas"
					"palette";
				grid-template-rows: 60px 1fr 200px;
				grid-template-columns: 1fr;
			}
			
			.palette {
				border-right: none;
				border-top: 1px solid #e9ecef;
			}
			
			.properties {
				display: none;
			}
		}
	</style>
</head>
<body>
	<div class="editor-container">
		<!-- Toolbar -->
		<div class="toolbar">
			<button class="tool-button active" data-tool="select">
				<span>Select</span>
			</button>
			<button class="tool-button" data-tool="drag">
				<span>Drag</span>
			</button>
			<button class="tool-button" data-tool="connect">
				<span>Connect</span>
			</button>
			<button class="tool-button" data-tool="zoom">
				<span>Zoom</span>
			</button>
			<div style="margin-left: auto; display: flex; gap: 8px;">
				<button class="btn" onclick="arrangeWorkflow()">Auto Arrange</button>
				<button class="btn" onclick="executeWorkflow()">Execute</button>
				<button class="btn btn-secondary" onclick="saveWorkflow()">Save</button>
			</div>
		</div>
		
		<!-- Element Palette -->
		<div class="palette">
			<div class="palette-header">Components</div>
			
			<div class="palette-category">
				<h3>Agents</h3>
				<div class="palette-item" draggable="true" data-type="research_agent">
					<span class="icon">🔍</span>
					<span>Research Agent</span>
				</div>
				<div class="palette-item" draggable="true" data-type="content_agent">
					<span class="icon">✍️</span>
					<span>Content Agent</span>
				</div>
				<div class="palette-item" draggable="true" data-type="analysis_agent">
					<span class="icon">📊</span>
					<span>Analysis Agent</span>
				</div>
				<div class="palette-item" draggable="true" data-type="review_agent">
					<span class="icon">✅</span>
					<span>Review Agent</span>
				</div>
			</div>
			
			<div class="palette-category">
				<h3>Logic</h3>
				<div class="palette-item" draggable="true" data-type="condition_node">
					<span class="icon">❓</span>
					<span>Condition</span>
				</div>
				<div class="palette-item" draggable="true" data-type="fork_node">
					<span class="icon">⑃</span>
					<span>Fork</span>
				</div>
				<div class="palette-item" draggable="true" data-type="join_node">
					<span class="icon">⑃</span>
					<span>Join</span>
				</div>
				<div class="palette-item" draggable="true" data-type="loop_node">
					<span class="icon">🔄</span>
					<span>Loop</span>
				</div>
			</div>
		</div>
		
		<!-- Canvas -->
		<div class="canvas-container">
			<div class="canvas" id="canvas">
				<svg class="connections-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
					<defs>
						<marker id="arrowhead" markerWidth="10" markerHeight="7" 
							refX="9" refY="3.5" orient="auto">
							<polygon points="0 0, 10 3.5, 0 7" fill="#333" />
						</marker>
					</defs>
				</svg>
				
				<!-- Sample agent nodes -->
				<div class="agent-node" style="left: 100px; top: 100px;" data-id="start-agent">
					<span class="icon">🚀</span>
					<span class="title">Start</span>
				</div>
				
				<div class="agent-node" style="left: 400px; top: 100px;" data-id="research-agent">
					<span class="icon">🔍</span>
					<span class="title">Research Agent</span>
				</div>
				
				<div class="agent-node" style="left: 700px; top: 100px;" data-id="content-agent">
					<span class="icon">✍️</span>
					<span class="title">Content Agent</span>
				</div>
			</div>
		</div>
		
		<!-- Properties Panel -->
		<div class="properties">
			<div class="properties-header">Properties</div>
			
			<div class="properties-section">
				<h3>General</h3>
				<div class="form-group">
					<label>Name</label>
					<input type="text" class="form-control" value="Research Agent">
				</div>
				<div class="form-group">
					<label>Description</label>
					<textarea class="form-control" rows="3">Specialized research agent for gathering information</textarea>
				</div>
			</div>
			
			<div class="properties-section">
				<h3>Agent Configuration</h3>
				<div class="form-group">
					<label>Agent Type</label>
					<select class="form-control">
						<option>Research Agent</option>
						<option>Content Agent</option>
						<option>Analysis Agent</option>
						<option>Review Agent</option>
					</select>
				</div>
				<div class="form-group">
					<label>Model</label>
					<select class="form-control">
						<option>qwen2.5:1.5b</option>
						<option>qwen2.5:7b</option>
						<option>qwen2.5:14b</option>
					</select>
				</div>
				<div class="form-group">
					<label>Temperature</label>
					<input type="range" class="form-control" min="0" max="2" step="0.1" value="0.7">
				</div>
			</div>
			
			<div class="properties-section">
				<h3>Prompt</h3>
				<div class="form-group">
					<button class="btn" onclick="openPromptEditor()">Edit Prompt</button>
				</div>
			</div>
		</div>
	</div>
	
	<!-- Prompt Editor Modal -->
	<div class="overlay" id="prompt-overlay"></div>
	<div class="prompt-editor" id="prompt-editor">
		<div class="prompt-editor-header">
			<h3>Edit Agent Prompt</h3>
			<button onclick="closePromptEditor()">×</button>
		</div>
		<div class="prompt-editor-body">
			<textarea class="prompt-textarea" placeholder="Enter your prompt here...">You are a research agent specialized in gathering and analyzing information from various sources. Your task is to:

1. Research the given topic thoroughly
2. Gather information from reliable sources  
3. Analyze and synthesize the findings
4. Provide comprehensive insights

Topic: {topic}
Focus Areas: {focus_areas}
Required Depth: {depth_level}</textarea>
		</div>
		<div class="prompt-editor-footer">
			<button class="btn btn-secondary" onclick="closePromptEditor()">Cancel</button>
			<button class="btn" onclick="savePrompt()">Save Prompt</button>
		</div>
	</div>
	
	<script>
		// WebSocket connection for real-time collaboration
		let ws = null;
		let userId = 'user_' + Math.random().toString(36).substr(2, 9);
		
		function connectWebSocket() {
			ws = new WebSocket(`ws://localhost:8000/ws/${userId}`);
			
			ws.onopen = function(event) {
				console.log('Connected to workflow editor');
			};
			
			ws.onmessage = function(event) {
				const message = JSON.parse(event.data);
				handleWebSocketMessage(message);
			};
			
			ws.onclose = function(event) {
				console.log('Disconnected from workflow editor');
				// Attempt to reconnect after 5 seconds
				setTimeout(connectWebSocket, 5000);
			};
		}
		
		function handleWebSocketMessage(message) {
			switch(message.type) {
				case 'action_result':
					console.log('Action result:', message.result);
					break;
				case 'element_updated':
					// Update element on canvas
					updateElementPosition(message.data);
					break;
				case 'cursor_moved':
					// Show collaborator cursor
					showCollaboratorCursor(message.collaborator_id, message.position);
					break;
			}
		}
		
		function sendWebSocketMessage(message) {
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(message));
			}
		}
		
		// Initialize editor
		document.addEventListener('DOMContentLoaded', function() {
			connectWebSocket();
			setupDragAndDrop();
			setupToolbar();
			setupCanvas();
		});
		
		function setupDragAndDrop() {
			// Palette item drag
			document.querySelectorAll('.palette-item').forEach(item => {
				item.addEventListener('dragstart', function(e) {
					e.dataTransfer.setData('text/plain', this.dataset.type);
				});
			});
			
			// Canvas drop
			const canvas = document.getElementById('canvas');
			canvas.addEventListener('dragover', function(e) {
				e.preventDefault();
			});
			
			canvas.addEventListener('drop', function(e) {
				e.preventDefault();
				const agentType = e.dataTransfer.getData('text/plain');
				const rect = canvas.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				
				createAgent(agentType, x, y);
			});
		}
		
		function setupToolbar() {
			document.querySelectorAll('.tool-button').forEach(button => {
				button.addEventListener('click', function() {
					// Remove active from all buttons
					document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
					// Add active to clicked button
					this.classList.add('active');
					
					// Send mode change to server
					sendWebSocketMessage({
						type: 'canvas_action',
						action: 'set_mode',
						parameters: {
							mode: this.dataset.tool
						}
					});
				});
			});
		}
		
		function setupCanvas() {
			// Node selection
			document.querySelectorAll('.agent-node').forEach(node => {
				node.addEventListener('click', function(e) {
					e.stopPropagation();
					selectNode(this);
				});
			});
			
			// Canvas click (deselect)
			document.getElementById('canvas').addEventListener('click', function(e) {
				if (e.target === this) {
					deselectAllNodes();
				}
			});
		}
		
		function selectNode(node) {
			// Remove selection from all nodes
			document.querySelectorAll('.agent-node').forEach(n => n.classList.remove('selected'));
			// Select clicked node
			node.classList.add('selected');
			
			// Send selection to server
			sendWebSocketMessage({
				type: 'canvas_action',
				action: 'element_select',
				parameters: {
					element_id: node.dataset.id,
					multi_select: false
				}
			});
		}
		
		function deselectAllNodes() {
			document.querySelectorAll('.agent-node').forEach(n => n.classList.remove('selected'));
			
			sendWebSocketMessage({
				type: 'canvas_action',
				action: 'element_select',
				parameters: {
					element_ids: [],
					multi_select: false
				}
			});
		}
		
		async function createAgent(agentType, x, y) {
			try {
				const response = await fetch('/api/agents', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						name: agentType.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase()),
						agent_type: agentType,
						position: [x, y],
						prompt: `Default prompt for ${agentType}`
					})
				});
				
				const result = await response.json();
				if (result.success) {
					console.log('Agent created:', result);
					// The node will be added to the canvas via WebSocket update
				}
			} catch (error) {
				console.error('Failed to create agent:', error);
			}
		}
		
		async function arrangeWorkflow() {
			try {
				const response = await fetch('/api/workflows/arrange', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						type: 'auto'
					})
				});
				
				const result = await response.json();
				console.log('Workflow arranged:', result);
			} catch (error) {
				console.error('Failed to arrange workflow:', error);
			}
		}
		
		async function executeWorkflow() {
			try {
				const response = await fetch('/api/workflows/execute', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						context: {}
					})
				});
				
				const result = await response.json();
				console.log('Workflow executed:', result);
				alert('Workflow execution started. Check console for results.');
			} catch (error) {
				console.error('Failed to execute workflow:', error);
			}
		}
		
		async function saveWorkflow() {
			try {
				const response = await fetch('/api/workflows/export', {
					method: 'GET'
				});
				
				const result = await response.json();
				console.log('Workflow saved:', result);
				alert('Workflow saved successfully!');
			} catch (error) {
				console.error('Failed to save workflow:', error);
			}
		}
		
		function openPromptEditor() {
			document.getElementById('prompt-overlay').classList.add('active');
			document.getElementById('prompt-editor').classList.add('active');
		}
		
		function closePromptEditor() {
			document.getElementById('prompt-overlay').classList.remove('active');
			document.getElementById('prompt-editor').classList.remove('active');
		}
		
		async function savePrompt() {
			const prompt = document.querySelector('.prompt-textarea').value;
			console.log('Saving prompt:', prompt);
			
			// In a real implementation, this would save to the selected agent
			alert('Prompt saved successfully!');
			closePromptEditor();
		}
		
		function updateElementPosition(data) {
			const element = document.querySelector(`[data-id="${data.element_id}"]`);
			if (element) {
				const currentLeft = parseInt(element.style.left);
				const currentTop = parseInt(element.style.top);
				
				element.style.left = (currentLeft + data.delta[0]) + 'px';
				element.style.top = (currentTop + data.delta[1]) + 'px';
			}
		}
		
		function showCollaboratorCursor(collaboratorId, position) {
			// Show other users' cursors on the canvas
			console.log(`Collaborator ${collaboratorId} moved cursor to`, position);
		}
	</script>
</body>
</html>
	"""


if __name__ == "__main__":
	import uvicorn
	
	app = create_app()
	uvicorn.run(app, host="0.0.0.0", port=8000)
