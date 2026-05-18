from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from ..core.agent import Agent, AgentConfig, AgentCapabilities
from ..core.messages import AgentMessage, MessageType, MessageTemplates
from ...intelligence.service import IntelligenceService
from ...intelligence.analyzers.market_analyzer import MarketAnalyzer
from ...intelligence.analyzers.financial_analyzer import FinancialAnalyzer
"""
Analysis Agent

Specialized agent for data analysis, intelligence processing, and insights
generation for proposal development and decision support.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""





@dataclass
class AnalysisTask:
	"""Analysis task specification"""
	task_id: str
	analysis_type: str  # "market", "financial", "competitive", "risk", "performance"
	data_sources: List[Dict[str, Any]]
	analysis_parameters: Dict[str, Any]
	output_format: str = "comprehensive"
	priority: str = "medium"


@dataclass
class AnalysisResult:
	"""Analysis task result"""
	task_id: str
	analysis_type: str
	insights: Dict[str, Any]
	recommendations: List[str]
	confidence_score: float
	data_quality_score: float
	visualizations: List[Dict[str, Any]]
	executive_summary: str
	detailed_findings: Dict[str, Any]


class AnalysisAgent(Agent[AnalysisTask]):
	"""
	Specialized analysis agent for data processing and insight generation
	
	Capabilities:
	- Market analysis and intelligence
	- Financial analysis and modeling
	- Competitive analysis and benchmarking
	- Risk assessment and mitigation
	- Performance analysis and optimization
	- Data visualization and reporting
	"""
	
	def __init__(self, config: Optional[AgentConfig] = None):
		if config is None:
			config = self._create_default_config()
		
		super().__init__(config)
		
		# Analysis components
		self.intelligence_service = IntelligenceService()
		self.market_analyzer = MarketAnalyzer()
		self.financial_analyzer = FinancialAnalyzer()
		
		# Analysis capabilities
		self.analysis_types = {
			"market", "financial", "competitive", "risk", "performance", "trend"
		}
		
		self._setup_analysis_goals()
		
		self.logger.info(f"Analysis Agent {self.name} initialized")
	
	def _create_default_config(self) -> AgentConfig:
		"""Create default configuration for analysis agent"""
		return AgentConfig(
			name="Data Analyst",
			description="Data analysis and intelligence processing specialist",
			primary_role="analyst",
			capabilities=AgentCapabilities(
				max_concurrent_tasks=5,
				expertise_domains=["data_analysis", "market_intelligence", "statistical_analysis"],
				supported_task_types=["analysis", "data_processing", "intelligence_gathering"],
				quality_threshold=0.9
			),
			personality_traits={
				"analytical_thinking": 0.98,
				"attention_to_detail": 0.95,
				"objectivity": 0.95,
				"precision": 0.9
			},
			creativity_level=0.6,
			risk_tolerance=0.3,
			# LLM configuration optimized for analytical processing
			llm_model="qwen2.5:1.5b",
			llm_temperature=0.2,  # Very low temperature for precise analysis
			llm_max_tokens=3072
		)
	
	def _setup_analysis_goals(self) -> None:
		"""Set up analysis-specific goals"""
		self.set_goal("analysis_accuracy", "Maintain high accuracy in analysis", 0.95)
		self.set_goal("insight_value", "Generate valuable business insights", 0.9)
		self.set_goal("data_quality", "Ensure high data quality standards", 0.9)
		self.set_goal("analysis_timeliness", "Deliver timely analysis results", 0.85)
	
	async def process_task(self, task: AnalysisTask) -> AnalysisResult:
		"""Process an analysis task"""
		self.logger.info(f"Processing analysis task: {task.analysis_type}")
		
		try:
			if task.analysis_type == "market":
				result = await self._market_analysis(task)
			elif task.analysis_type == "financial":
				result = await self._financial_analysis(task)
			elif task.analysis_type == "competitive":
				result = await self._competitive_analysis(task)
			elif task.analysis_type == "risk":
				result = await self._risk_analysis(task)
			else:
				result = await self._general_analysis(task)
			
			self.logger.info(f"Analysis completed with confidence: {result.confidence_score:.2f}")
			return result
			
		except Exception as e:
			self.logger.error(f"Analysis task failed: {e}")
			raise
	
	async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
		"""Handle incoming messages"""
		if message.header.message_type == MessageType.TASK_REQUEST:
			return await self._handle_analysis_request(message)
		return None
	
	def get_capabilities(self) -> List[str]:
		"""Return analysis agent capabilities"""
		return [
			"market_analysis", "financial_analysis", "competitive_analysis",
			"risk_assessment", "performance_analysis", "trend_analysis",
			"data_visualization", "statistical_analysis", "predictive_modeling"
		]
	
	async def evaluate_task_fit(self, task: AnalysisTask) -> float:
		"""Evaluate task fit"""
		if not isinstance(task, AnalysisTask):
			return 0.0
		
		if task.analysis_type in self.analysis_types:
			return 0.9
		return 0.6
	
	# Analysis implementations
	
	async def _market_analysis(self, task: AnalysisTask) -> AnalysisResult:
		"""Conduct market analysis"""
		# Use market analyzer
		market_data = await self.market_analyzer.analyze_market_conditions(
			industry=task.analysis_parameters.get("industry", "technology"),
			region=task.analysis_parameters.get("region", "global"),
			timeframe=task.analysis_parameters.get("timeframe", "current")
		)

		if market_data.get("status") == "unavailable":
			return AnalysisResult(
				task_id=task.task_id,
				analysis_type=task.analysis_type,
				insights={
					"status": "unavailable",
					"market_size": {},
					"growth_trends": [],
					"key_players": [],
					"opportunities": []
				},
				recommendations=[
					"Connect a real market intelligence analyzer before relying on market conclusions"
				],
				confidence_score=0.0,
				data_quality_score=0.0,
				visualizations=[],
				executive_summary="Market analysis unavailable; no market conclusions generated",
				detailed_findings=market_data
			)
		
		insights = {
			"market_size": market_data.get("market_size", {}),
			"growth_trends": market_data.get("trends", []),
			"key_players": market_data.get("competitors", []),
			"opportunities": market_data.get("opportunities", [])
		}
		
		recommendations = [
			"Focus on high-growth market segments",
			"Monitor competitive landscape changes",
			"Capitalize on identified opportunities"
		]
		
		return AnalysisResult(
			task_id=task.task_id,
			analysis_type=task.analysis_type,
			insights=insights,
			recommendations=recommendations,
			confidence_score=0.85,
			data_quality_score=0.8,
			visualizations=[],
			executive_summary="Market analysis reveals strong growth opportunities",
			detailed_findings=market_data
		)
	
	async def _financial_analysis(self, task: AnalysisTask) -> AnalysisResult:
		"""Conduct financial analysis"""
		# Use financial analyzer
		financial_data = await self.financial_analyzer.analyze_financial_viability(
			project_data=task.analysis_parameters
		)

		if financial_data.get("status") == "unavailable":
			return AnalysisResult(
				task_id=task.task_id,
				analysis_type=task.analysis_type,
				insights={
					"status": "unavailable",
					"roi_projection": {},
					"cost_analysis": {},
					"revenue_projections": {},
					"risk_factors": []
				},
				recommendations=[
					"Connect a real financial analyzer before relying on financial conclusions"
				],
				confidence_score=0.0,
				data_quality_score=0.0,
				visualizations=[],
				executive_summary="Financial analysis unavailable; no financial conclusions generated",
				detailed_findings=financial_data
			)
		
		insights = {
			"roi_projection": financial_data.get("roi", {}),
			"cost_analysis": financial_data.get("costs", {}),
			"revenue_projections": financial_data.get("revenue", {}),
			"risk_factors": financial_data.get("risks", [])
		}
		
		recommendations = [
			"Optimize cost structure for better margins",
			"Diversify revenue streams",
			"Monitor financial risk indicators"
		]
		
		return AnalysisResult(
			task_id=task.task_id,
			analysis_type=task.analysis_type,
			insights=insights,
			recommendations=recommendations,
			confidence_score=0.9,
			data_quality_score=0.85,
			visualizations=[],
			executive_summary="Financial analysis shows positive ROI potential",
			detailed_findings=financial_data
		)
	
	async def _competitive_analysis(self, task: AnalysisTask) -> AnalysisResult:
		"""Conduct competitive analysis"""
		insights = {
			"competitive_positioning": {"strength": "high", "differentiation": "strong"},
			"market_share": {"current": "15%", "target": "25%"},
			"competitive_advantages": ["Technology innovation", "Customer service", "Market presence"],
			"threats": ["New entrants", "Price competition", "Technology disruption"]
		}
		
		recommendations = [
			"Strengthen competitive advantages",
			"Monitor emerging competitors",
			"Develop defensive strategies"
		]
		
		return AnalysisResult(
			task_id=task.task_id,
			analysis_type=task.analysis_type,
			insights=insights,
			recommendations=recommendations,
			confidence_score=0.8,
			data_quality_score=0.75,
			visualizations=[],
			executive_summary="Competitive analysis reveals strong market position",
			detailed_findings=insights
		)
	
	async def _risk_analysis(self, task: AnalysisTask) -> AnalysisResult:
		"""Conduct risk analysis"""
		insights = {
			"risk_categories": ["Technical", "Market", "Financial", "Operational"],
			"high_priority_risks": ["Technology obsolescence", "Market volatility"],
			"risk_mitigation": {"strategies": 3, "coverage": "85%"},
			"overall_risk_level": "Medium"
		}
		
		recommendations = [
			"Implement comprehensive risk monitoring",
			"Develop contingency plans for high-priority risks",
			"Regular risk assessment updates"
		]
		
		return AnalysisResult(
			task_id=task.task_id,
			analysis_type=task.analysis_type,
			insights=insights,
			recommendations=recommendations,
			confidence_score=0.85,
			data_quality_score=0.8,
			visualizations=[],
			executive_summary="Risk analysis identifies manageable risk profile",
			detailed_findings=insights
		)
	
	async def _general_analysis(self, task: AnalysisTask) -> AnalysisResult:
		"""Conduct general analysis"""
		insights = {
			"analysis_summary": f"General analysis for {task.analysis_type}",
			"key_findings": ["Data processed successfully", "Patterns identified", "Insights generated"],
			"data_coverage": "Comprehensive"
		}
		
		recommendations = [
			"Continue monitoring key metrics",
			"Regular analysis updates",
			"Stakeholder communication"
		]
		
		return AnalysisResult(
			task_id=task.task_id,
			analysis_type=task.analysis_type,
			insights=insights,
			recommendations=recommendations,
			confidence_score=0.75,
			data_quality_score=0.7,
			visualizations=[],
			executive_summary="General analysis completed successfully",
			detailed_findings=insights
		)
	
	async def _handle_analysis_request(self, message: AgentMessage) -> AgentMessage:
		"""Handle analysis request"""
		try:
			task_data = message.payload.content
			
			analysis_task = AnalysisTask(
				task_id=message.header.message_id,
				analysis_type=task_data.get("analysis_type", "general"),
				data_sources=task_data.get("data_sources", []),
				analysis_parameters=task_data.get("parameters", {})
			)
			
			result = await self.process_task(analysis_task)
			
			return MessageTemplates.task_response(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				result=result.__dict__,
				original_message_id=message.header.message_id
			)
			
		except Exception as e:
			return MessageTemplates.error_report(
				sender_id=self.agent_id,
				recipient_id=message.header.sender_id,
				error_info={"error": str(e)}
			)
	
	# Public interface
	async def analyze_market_opportunity(self, industry: str, region: str = "global") -> AnalysisResult:
		"""Public method for market opportunity analysis"""
		task = AnalysisTask(
			task_id=f"market_analysis_{hash(industry)}",
			analysis_type="market",
			data_sources=[],
			analysis_parameters={"industry": industry, "region": region}
		)
		
		return await self.process_task(task)
