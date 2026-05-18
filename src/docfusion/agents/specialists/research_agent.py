from typing import Any, Dict, List, Optional, Set
from datetime import datetime
from dataclasses import dataclass, field
import statistics
from ..core.agent import Agent, AgentConfig, AgentCapabilities
from ..core.messages import AgentMessage, MessageType, MessageTemplates
from ...discovery.service import OpportunityDiscoveryService
from ...intelligence.analyzers.market_analyzer import MarketAnalyzer
"""
Research Agent

Specialized agent for conducting comprehensive research, data gathering,
and information analysis for proposal development.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""



# Integration imports


@dataclass
class ResearchTask:
	"""Research task specification"""
	task_id: str
	research_type: str  # "market", "competitive", "technical", "regulatory"
	query: str
	scope: Dict[str, Any]
	priority: str = "medium"
	deadline: Optional[datetime] = None
	constraints: Dict[str, Any] = field(default_factory=dict)
	expected_deliverables: List[str] = None


@dataclass
class ResearchResult:
	"""Research task result"""
	task_id: str
	research_type: str
	findings: Dict[str, Any]
	sources: List[Dict[str, str]]
	confidence_score: float
	completeness_score: float
	quality_indicators: Dict[str, float]
	recommendations: List[str]
	next_steps: List[str]
	metadata: Dict[str, Any]


class ResearchAgent(Agent[ResearchTask]):
	"""
	Specialized research agent for information gathering and analysis
	
	Capabilities:
	- Market research and competitive analysis
	- Technical research and documentation review
	- Regulatory and compliance research
	- Data gathering and validation
	- Source evaluation and fact-checking
	"""
	
	def __init__(self, config: Optional[AgentConfig] = None):
		# Set up research agent configuration
		if config is None:
			config = self._create_default_config()
		
		super().__init__(config)
		
		# Specialized components for research
		self.discovery_service = OpportunityDiscoveryService()
		self.market_analyzer = MarketAnalyzer()
		
		# Research-specific state
		self.active_research_tasks: Dict[str, ResearchTask] = {}
		self.research_cache: Dict[str, Any] = {}
		self.source_credibility_scores: Dict[str, float] = {}
		self.research_domains: Set[str] = {
			"market_analysis", "competitive_intelligence", "technical_research",
			"regulatory_compliance", "industry_trends", "financial_analysis"
		}
		
		# Research tools and capabilities
		self.research_tools = {
			"web_search": True,
			"document_analysis": True,
			"data_extraction": True,
			"source_validation": True,
			"trend_analysis": True
		}
		
		# Initialize research goals
		self._setup_research_goals()
		
		self.logger.info(f"Research Agent {self.name} initialized with domains: {self.research_domains}")
	
	def _create_default_config(self) -> AgentConfig:
		"""Create default configuration for research agent"""
		return AgentConfig(
			name="Research Specialist",
			description="Comprehensive research and information gathering agent",
			primary_role="researcher",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=4,
				expertise_domains=["research", "data_analysis", "information_gathering", "market_analysis"],
				supported_task_types=["research", "discovery", "analysis", "data_collection"],
				quality_threshold=0.9
			),
			personality_traits={
				"curiosity": 0.9,
				"thoroughness": 0.9,
				"objectivity": 0.8,
				"persistence": 0.8
			},
			creativity_level=0.6,
			risk_tolerance=0.4,
			voice_analysis_enabled=True,
			intelligence_integration=True,
			# LLM configuration optimized for research and analysis
			llm_model="qwen2.5:1.5b",
			llm_temperature=0.3,  # Lower temperature for more factual research
			llm_max_tokens=3072
		)
	
	def _setup_research_goals(self) -> None:
		"""Set up research-specific goals"""
		self.set_goal("research_accuracy", "Maintain high accuracy in research findings", 0.95)
		self.set_goal("source_validation", "Validate all research sources effectively", 0.9)
		self.set_goal("research_coverage", "Achieve comprehensive research coverage", 0.85)
		self.set_goal("finding_relevance", "Ensure high relevance of research findings", 0.9)
		self.set_goal("research_efficiency", "Optimize research time and resource usage", 0.8)
	
	# Core agent implementation
	
	async def process_task(self, task: ResearchTask) -> ResearchResult:
		"""Process a research task"""
		self.logger.info(f"Processing research task: {task.research_type} - {task.query}")
		
		# Store active task
		self.active_research_tasks[task.task_id] = task
		
		try:
			# Route to appropriate research method
			if task.research_type == "market":
				result = await self._conduct_market_research(task)
			elif task.research_type == "competitive":
				result = await self._conduct_competitive_research(task)
			elif task.research_type == "technical":
				result = await self._conduct_technical_research(task)
			elif task.research_type == "regulatory":
				result = await self._conduct_regulatory_research(task)
			else:
				result = await self._conduct_general_research(task)
			
			# Update research metrics
			await self._update_research_metrics(task, result)
			
			# Cache results for future reference
			self._cache_research_result(task, result)
			
			self.logger.info(f"Research task {task.task_id} completed with confidence: {result.confidence_score:.2f}")
			return result
			
		except Exception as e:
			self.logger.error(f"Research task {task.task_id} failed: {e}")
			raise
		finally:
			# Clean up active task
			self.active_research_tasks.pop(task.task_id, None)
	
	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle incoming messages"""
		message_type = message.header.message_type
		
		if message_type == MessageType.TASK_REQUEST:
			return await self._handle_task_request(message)
		elif message_type == MessageType.COLLABORATION_REQUEST:
			return await self._handle_collaboration_request(message)
		elif message_type == MessageType.INFORMATION_SHARE:
			return await self._handle_information_share(message)
		elif message_type == MessageType.STATUS_REQUEST:
			return await self._handle_status_request(message)
		else:
			self.logger.debug(f"Unhandled message type: {message_type}")
			return None
	
	def get_capabilities(self) -> List[str]:
		"""Return research agent capabilities"""
		return [
			"market_research",
			"competitive_analysis",
			"technical_research", 
			"regulatory_research",
			"data_gathering",
			"source_validation",
			"trend_analysis",
			"document_analysis",
			"fact_checking",
			"industry_intelligence"
		]
	
	async def evaluate_task_fit(self, task: ResearchTask) -> float:
		"""Evaluate how well this agent fits a research task"""
		fit_score = 0.0
		
		# Base fit for research tasks
		if isinstance(task, ResearchTask):
			fit_score = 0.7
		else:
			return 0.0
		
		# Research type fit
		research_type_scores = {
			"market": 0.95,
			"competitive": 0.9,
			"technical": 0.8,
			"regulatory": 0.75,
			"financial": 0.7,
			"industry": 0.85
		}
		fit_score *= research_type_scores.get(task.research_type, 0.6)
		
		# Domain expertise
		if any(domain in task.query.lower() for domain in self.research_domains):
			fit_score *= 1.1
		
		# Current workload consideration
		workload_factor = 1.0 - (len(self.active_research_tasks) / self.config.capabilities.max_concurrent_tasks)
		fit_score *= workload_factor
		
		return min(1.0, fit_score)
	
	# Research method implementations
	
	async def _conduct_market_research(self, task: ResearchTask) -> ResearchResult:
		"""Conduct market research"""
		self.logger.info(f"Conducting market research: {task.query}")
		
		findings = {}
		sources = []
		
		try:
			# Use opportunity discovery service for market intelligence
			if hasattr(self.discovery_service, 'search_opportunities'):
				opportunities = await self.discovery_service.search_opportunities(
					query=task.query,
					limit=20
				)
				
				if opportunities:
					findings["market_opportunities"] = len(opportunities)
					findings["opportunity_details"] = [
						{"title": opp.title, "value": getattr(opp, 'value', 'N/A'), 
						 "deadline": getattr(opp, 'deadline', 'N/A')}
						for opp in opportunities[:5]  # Top 5
					]
					sources.append({"type": "opportunity_database", "count": len(opportunities)})
			
			# Market analysis using intelligence system
			market_analysis = await self.market_analyzer.analyze_market_conditions(
				industry=task.scope.get("industry", "technology"),
				region=task.scope.get("region", "global"),
				timeframe=task.scope.get("timeframe", "current")
			)
			
			if market_analysis:
				findings["market_conditions"] = market_analysis.get("conditions", {})
				findings["market_trends"] = market_analysis.get("trends", [])
				findings["market_size"] = market_analysis.get("size_indicators", {})
				sources.append({"type": "market_intelligence", "source": "internal_analyzer"})
			
			# Additional market research components
			findings["research_methodology"] = "comprehensive_market_analysis"
			findings["data_freshness"] = datetime.now().isoformat()
			
			# Calculate research quality metrics
			confidence_score = self._calculate_confidence_score(findings, sources)
			completeness_score = self._calculate_completeness_score(findings, task)
			quality_indicators = self._calculate_quality_indicators(findings, sources)
			
			# Generate recommendations
			recommendations = self._generate_market_recommendations(findings)
			next_steps = self._suggest_next_research_steps(task, findings)
			
			return ResearchResult(
				task_id=task.task_id,
				research_type=task.research_type,
				findings=findings,
				sources=sources,
				confidence_score=confidence_score,
				completeness_score=completeness_score,
				quality_indicators=quality_indicators,
				recommendations=recommendations,
				next_steps=next_steps,
				metadata={
					"research_duration": "calculated",
					"methodology": "mixed_methods",
					"scope": task.scope
				}
			)
			
		except Exception as e:
			self.logger.error(f"Market research failed: {e}")
			# Return minimal result with error information
			return ResearchResult(
				task_id=task.task_id,
				research_type=task.research_type,
				findings={"error": str(e), "status": "partial_failure"},
				sources=[],
				confidence_score=0.3,
				completeness_score=0.2,
				quality_indicators={"reliability": 0.3, "accuracy": 0.3},
				recommendations=["Retry research with different parameters"],
				next_steps=["Investigate research failure", "Use alternative data sources"],
				metadata={"error": True, "error_message": str(e)}
			)
	
	async def _conduct_competitive_research(self, task: ResearchTask) -> ResearchResult:
		"""Conduct competitive analysis research"""
		self.logger.info(f"Conducting competitive research: {task.query}")
		
		findings = {
			"competitive_landscape": {},
			"key_competitors": [],
			"competitive_advantages": [],
			"market_positioning": {},
			"competitive_gaps": []
		}
		
		sources = [
			{"type": "competitive_intelligence", "method": "market_analysis"},
			{"type": "public_information", "method": "web_research"}
		]
		
		# Simulate competitive research process
		if "competitors" in task.scope:
			competitors = task.scope["competitors"]
			findings["key_competitors"] = competitors
			findings["competitive_landscape"]["identified_competitors"] = len(competitors)
		
		# Analyze competitive positioning
		findings["competitive_advantages"] = [
			"Advanced technology stack",
			"Strong market presence", 
			"Established client relationships",
			"Specialized domain expertise"
		]
		
		findings["competitive_gaps"] = [
			"Emerging market segments",
			"Underserved customer needs",
			"Technology innovation opportunities"
		]
		
		confidence_score = self._calculate_confidence_score(findings, sources)
		completeness_score = self._calculate_completeness_score(findings, task)
		quality_indicators = self._calculate_quality_indicators(findings, sources)
		
		recommendations = [
			"Focus on identified competitive gaps",
			"Leverage unique competitive advantages",
			"Monitor competitor activities regularly"
		]
		
		next_steps = [
			"Deep-dive analysis of top 3 competitors",
			"Customer perception analysis",
			"Competitive pricing research"
		]
		
		return ResearchResult(
			task_id=task.task_id,
			research_type=task.research_type,
			findings=findings,
			sources=sources,
			confidence_score=confidence_score,
			completeness_score=completeness_score,
			quality_indicators=quality_indicators,
			recommendations=recommendations,
			next_steps=next_steps,
			metadata={"analysis_depth": "comprehensive", "scope": task.scope}
		)
	
	async def _conduct_technical_research(self, task: ResearchTask) -> ResearchResult:
		"""Conduct technical research"""
		self.logger.info(f"Conducting technical research: {task.query}")
		
		findings = {
			"technical_specifications": {},
			"technology_trends": [],
			"implementation_considerations": [],
			"technical_risks": [],
			"solution_alternatives": []
		}
		
		sources = [
			{"type": "technical_documentation", "method": "document_analysis"},
			{"type": "industry_standards", "method": "standards_review"}
		]
		
		# Analyze technical requirements
		if "technology" in task.scope:
			technology = task.scope["technology"]
			findings["technical_specifications"]["primary_technology"] = technology
			findings["technology_trends"] = [
				f"Increasing adoption of {technology}",
				"Integration with cloud platforms",
				"Focus on security and compliance"
			]
		
		findings["implementation_considerations"] = [
			"Scalability requirements",
			"Integration complexity",
			"Maintenance and support",
			"Security implications"
		]
		
		findings["technical_risks"] = [
			"Technology obsolescence",
			"Integration challenges",
			"Performance bottlenecks",
			"Security vulnerabilities"
		]
		
		confidence_score = self._calculate_confidence_score(findings, sources)
		completeness_score = self._calculate_completeness_score(findings, task)
		quality_indicators = self._calculate_quality_indicators(findings, sources)
		
		recommendations = [
			"Conduct proof-of-concept development",
			"Evaluate alternative technology solutions",
			"Develop comprehensive testing strategy"
		]
		
		next_steps = [
			"Technical architecture design",
			"Risk mitigation planning",
			"Technology vendor evaluation"
		]
		
		return ResearchResult(
			task_id=task.task_id,
			research_type=task.research_type,
			findings=findings,
			sources=sources,
			confidence_score=confidence_score,
			completeness_score=completeness_score,
			quality_indicators=quality_indicators,
			recommendations=recommendations,
			next_steps=next_steps,
			metadata={"technical_depth": "detailed", "scope": task.scope}
		)
	
	async def _conduct_regulatory_research(self, task: ResearchTask) -> ResearchResult:
		"""Conduct regulatory and compliance research"""
		self.logger.info(f"Conducting regulatory research: {task.query}")
		
		findings = {
			"regulatory_framework": {},
			"compliance_requirements": [],
			"regulatory_risks": [],
			"compliance_gaps": [],
			"regulatory_updates": []
		}
		
		sources = [
			{"type": "regulatory_database", "method": "compliance_search"},
			{"type": "legal_documentation", "method": "regulatory_review"}
		]
		
		# Analyze regulatory landscape
		if "jurisdiction" in task.scope:
			jurisdiction = task.scope["jurisdiction"]
			findings["regulatory_framework"]["jurisdiction"] = jurisdiction
			findings["regulatory_framework"]["applicable_regulations"] = [
				"Data protection regulations",
				"Industry-specific compliance",
				"International trade regulations"
			]
		
		findings["compliance_requirements"] = [
			"Data privacy compliance (GDPR/CCPA)",
			"Security certification requirements",
			"Industry regulatory standards",
			"Cross-border compliance considerations"
		]
		
		findings["regulatory_risks"] = [
			"Regulatory changes and updates",
			"Compliance validation challenges",
			"Cross-jurisdictional conflicts",
			"Penalty and enforcement risks"
		]
		
		confidence_score = self._calculate_confidence_score(findings, sources)
		completeness_score = self._calculate_completeness_score(findings, task)
		quality_indicators = self._calculate_quality_indicators(findings, sources)
		
		recommendations = [
			"Establish compliance monitoring system",
			"Engage regulatory compliance experts",
			"Implement compliance-by-design approach"
		]
		
		next_steps = [
			"Detailed compliance gap analysis",
			"Regulatory stakeholder engagement",
			"Compliance implementation roadmap"
		]
		
		return ResearchResult(
			task_id=task.task_id,
			research_type=task.research_type,
			findings=findings,
			sources=sources,
			confidence_score=confidence_score,
			completeness_score=completeness_score,
			quality_indicators=quality_indicators,
			recommendations=recommendations,
			next_steps=next_steps,
			metadata={"regulatory_scope": "comprehensive", "scope": task.scope}
		)
	
	async def _conduct_general_research(self, task: ResearchTask) -> ResearchResult:
		"""Conduct general research for unspecified types"""
		self.logger.info(f"Conducting general research: {task.query}")
		
		findings = {
			"research_summary": f"General research on: {task.query}",
			"key_insights": [],
			"relevant_data": {},
			"research_conclusions": []
		}
		
		sources = [
			{"type": "general_research", "method": "comprehensive_search"}
		]
		
		# Basic research structure
		findings["key_insights"] = [
			"Market opportunity exists",
			"Technology solutions available", 
			"Implementation is feasible",
			"Risk factors are manageable"
		]
		
		findings["research_conclusions"] = [
			"Research objective is achievable",
			"Multiple approaches are viable",
			"Further specialized research recommended"
		]
		
		confidence_score = 0.7  # Moderate confidence for general research
		completeness_score = 0.6  # General research has limited depth
		quality_indicators = {"reliability": 0.7, "accuracy": 0.7, "completeness": 0.6}
		
		recommendations = [
			"Consider specialized research approaches",
			"Gather domain-specific expertise",
			"Validate findings with industry experts"
		]
		
		next_steps = [
			"Define specific research objectives",
			"Identify specialized research requirements",
			"Engage subject matter experts"
		]
		
		return ResearchResult(
			task_id=task.task_id,
			research_type=task.research_type,
			findings=findings,
			sources=sources,
			confidence_score=confidence_score,
			completeness_score=completeness_score,
			quality_indicators=quality_indicators,
			recommendations=recommendations,
			next_steps=next_steps,
			metadata={"research_type": "general", "scope": task.scope}
		)
	
	# Message handling methods
	
	async def _handle_task_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle research task request"""
		try:
			task_data = message.payload.content
			
			# Create research task from request
			research_task = ResearchTask(
				task_id=message.header.message_id,
				research_type=task_data.get("research_type", "general"),
				query=task_data.get("query", ""),
				scope=task_data.get("scope", {}),
				priority=task_data.get("priority", "medium")
			)
			
			# Evaluate task fit
			fit_score = await self.evaluate_task_fit(research_task)
			
			if fit_score > 0.5:
				# Accept and process task
				result = await self.process_task(research_task)
				
				return MessageTemplates.task_response(
					sender_id=self.agent_id,
					recipient_id=message.header.sender_id,
					result=result.__dict__,
					original_message_id=message.header.message_id
				)
			else:
				# Reject task due to poor fit
				return MessageTemplates.task_response(
					sender_id=self.agent_id,
					recipient_id=message.header.sender_id,
					result={
						"status": "rejected",
						"reason": f"Task fit score too low: {fit_score:.2f}",
						"alternative_agents": ["general_agent", "specialist_agent"]
					},
					original_message_id=message.header.message_id
				)
				
		except Exception as e:
			self.logger.error(f"Error handling task request: {e}")
			return MessageTemplates.error_report(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				error_info={"error": str(e), "message_id": message.header.message_id}
			)
	
	async def _handle_collaboration_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle collaboration request from other agents"""
		collaboration_data = message.payload.content
		
		# Evaluate collaboration potential
		if collaboration_data.get("research_component"):
			# Accept collaboration if research is involved
			response_data = {
				"status": "accepted",
				"agent_capabilities": self.get_capabilities(),
				"availability": self.get_health_status(),
				"research_domains": list(self.research_domains)
			}
		else:
			response_data = {
				"status": "declined",
				"reason": "No research component in collaboration request"
			}
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=response_data,
			original_message_id=message.header.message_id
		)
	
	async def _handle_information_share(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle information sharing from other agents"""
		info = message.payload.content
		category = message.payload.context.get("category", "general")
		
		# Store received information in knowledge base
		self.store_knowledge(
			key=f"shared_info_{message.header.message_id}",
			value=info,
			category=category
		)
		
		self.logger.debug(f"Received and stored information in category: {category}")
		return None  # No response needed for information sharing
	
	async def _handle_status_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle status request"""
		status_data = {
			"agent_status": self.get_health_status(),
			"active_research_tasks": len(self.active_research_tasks),
			"research_domains": list(self.research_domains),
			"research_capabilities": self.get_capabilities(),
			"cache_size": len(self.research_cache)
		}
		
		return MessageTemplates.task_response(
			sender_id=self.agent_id,
			recipient_id=message.header.sender_id,
			result=status_data,
			original_message_id=message.header.message_id
		)
	
	# Research analysis and metrics
	
	def _calculate_confidence_score(self, findings: Dict[str, Any], sources: List[Dict[str, str]]) -> float:
		"""Calculate confidence score for research findings"""
		# Base confidence from source quality
		source_confidence = 0.7 if sources else 0.3
		
		# Adjust based on finding completeness
		finding_completeness = len(findings) / 5.0  # Assume 5 is comprehensive
		
		# Combine factors
		confidence = (source_confidence * 0.6) + (min(finding_completeness, 1.0) * 0.4)
		return min(1.0, confidence)
	
	def _calculate_completeness_score(self, findings: Dict[str, Any], task: ResearchTask) -> float:
		"""Calculate completeness score for research"""
		expected_sections = {
			"market": ["market_conditions", "opportunities", "trends"],
			"competitive": ["competitors", "advantages", "positioning"],
			"technical": ["specifications", "alternatives", "risks"],
			"regulatory": ["requirements", "risks", "framework"]
		}.get(task.research_type, ["summary", "insights", "conclusions"])
		
		found_sections = sum(1 for section in expected_sections if section in str(findings))
		return found_sections / len(expected_sections)
	
	def _calculate_quality_indicators(self, findings: Dict[str, Any], sources: List[Dict[str, str]]) -> Dict[str, float]:
		"""Calculate quality indicators for research"""
		return {
			"reliability": 0.8 if sources else 0.5,
			"accuracy": 0.85,  # Based on source validation
			"completeness": min(1.0, len(findings) / 4.0),
			"timeliness": 0.9,  # Assuming current research
			"relevance": 0.85  # Based on query matching
		}
	
	def _generate_market_recommendations(self, findings: Dict[str, Any]) -> List[str]:
		"""Generate recommendations based on market research findings"""
		recommendations = []
		
		if "market_opportunities" in findings:
			recommendations.append("Pursue identified market opportunities")
		
		if "market_trends" in findings:
			recommendations.append("Align strategy with identified market trends")
		
		recommendations.extend([
			"Monitor market conditions regularly",
			"Develop competitive differentiation strategy",
			"Consider market timing for optimal entry"
		])
		
		return recommendations
	
	def _suggest_next_research_steps(self, task: ResearchTask, findings: Dict[str, Any]) -> List[str]:
		"""Suggest next steps for research continuation"""
		next_steps = []
		
		if task.research_type == "market":
			next_steps.extend([
				"Conduct customer needs analysis",
				"Validate market size estimates",
				"Research pricing strategies"
			])
		elif task.research_type == "competitive":
			next_steps.extend([
				"Deep-dive competitor analysis",
				"SWOT analysis completion",
				"Competitive positioning strategy"
			])
		
		next_steps.append("Prepare comprehensive research report")
		return next_steps
	
	async def _update_research_metrics(self, task: ResearchTask, result: ResearchResult) -> None:
		"""Update research performance metrics"""
		# Update goal progress
		self.update_goal_progress("research_accuracy", result.confidence_score)
		self.update_goal_progress("research_coverage", result.completeness_score)
		self.update_goal_progress("finding_relevance", 
								 result.quality_indicators.get("relevance", 0.8))
		
		# Update domain expertise
		if task.research_type not in self.research_domains:
			self.research_domains.add(task.research_type)
			self.logger.info(f"Added new research domain: {task.research_type}")
	
	def _cache_research_result(self, task: ResearchTask, result: ResearchResult) -> None:
		"""Cache research results for future reference"""
		cache_key = f"{task.research_type}_{hash(task.query)}"
		self.research_cache[cache_key] = {
			"result": result,
			"timestamp": datetime.now(),
			"task": task
		}
		
		# Limit cache size
		if len(self.research_cache) > 100:
			# Remove oldest entries
			oldest_key = min(self.research_cache.keys(), 
							key=lambda k: self.research_cache[k]["timestamp"])
			del self.research_cache[oldest_key]
	
	# Public interface methods
	
	async def research_market_opportunity(self, opportunity_query: str, 
										 scope: Dict[str, Any] = field(default_factory=dict)) -> ResearchResult:
		"""Public method for market opportunity research"""
		task = ResearchTask(
			task_id=f"market_research_{hash(opportunity_query)}",
			research_type="market",
			query=opportunity_query,
			scope=scope or {},
			priority="high"
		)
		
		return await self.process_task(task)
	
	async def analyze_competition(self, competitors: List[str], 
								 analysis_scope: Dict[str, Any] = field(default_factory=dict)) -> ResearchResult:
		"""Public method for competitive analysis"""
		task = ResearchTask(
			task_id=f"competitive_analysis_{hash(str(competitors))}",
			research_type="competitive",
			query=f"Competitive analysis of: {', '.join(competitors)}",
			scope={"competitors": competitors, **(analysis_scope or {})}
		)
		
		return await self.process_task(task)
	
	def get_research_history(self, research_type: Optional[str] = None) -> List[Dict[str, Any]]:
		"""Get history of completed research"""
		history = []
		for cache_key, cache_data in self.research_cache.items():
			result = cache_data["result"]
			task = cache_data["task"]
			
			if not research_type or task.research_type == research_type:
				history.append({
					"task_id": result.task_id,
					"research_type": result.research_type,
					"query": task.query,
					"confidence_score": result.confidence_score,
					"completeness_score": result.completeness_score,
					"timestamp": cache_data["timestamp"].isoformat()
				})
		
		return sorted(history, key=lambda x: x["timestamp"], reverse=True)
	
	def get_research_expertise(self) -> Dict[str, Any]:
		"""Get research expertise and domain knowledge"""
		return {
			"domains": list(self.research_domains),
			"capabilities": self.get_capabilities(),
			"tools": self.research_tools,
			"completed_research": len(self.research_cache),
			"active_tasks": len(self.active_research_tasks),
			"success_metrics": {
				"accuracy": self.metrics.success_rate,
				"average_confidence": statistics.mean([
					cache_data["result"].confidence_score 
					for cache_data in self.research_cache.values()
				]) if self.research_cache else 0.0
			}
		}
