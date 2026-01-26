"""
Research Tools for Agents

Provides advanced research capabilities combining web search, data processing,
and analysis for gathering business intelligence and market insights.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import re

from .base import AgentTool, ToolResult, ToolCapability, ToolError, ToolConfig
from .web_tools import WebSearchTool, WebScrapeTool
from .data_tools import JSONProcessorTool, TextProcessorTool


class CompanyResearchTool(AgentTool):
	"""
	Tool for researching companies and organizations
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="company_research",
			description="Research companies and organizations for business intelligence",
			capabilities=[ToolCapability.RESEARCH, ToolCapability.WEB_SEARCH, ToolCapability.DATA_PROCESSING],
			config=config
		)
		self.web_search = WebSearchTool()
		self.web_scrape = WebScrapeTool()
		self.text_processor = TextProcessorTool()
	
	async def execute(self, company_name: str, research_depth: str = "basic",
					 include_financials: bool = True, include_news: bool = True,
					 include_competitors: bool = False, **kwargs) -> ToolResult:
		"""Execute company research"""
		
		try:
			research_data = {
				"company_name": company_name,
				"research_timestamp": datetime.now().isoformat(),
				"research_depth": research_depth
			}
			
			# Basic company information search
			basic_info = await self._research_basic_info(company_name)
			research_data["basic_info"] = basic_info
			
			# Financial information if requested
			if include_financials:
				financial_info = await self._research_financial_info(company_name)
				research_data["financial_info"] = financial_info
			
			# Recent news if requested
			if include_news:
				news_info = await self._research_company_news(company_name)
				research_data["news"] = news_info
			
			# Competitor analysis if requested
			if include_competitors and research_depth == "comprehensive":
				competitor_info = await self._research_competitors(company_name)
				research_data["competitors"] = competitor_info
			
			# Generate summary and insights
			summary = await self._generate_company_summary(research_data)
			research_data["summary"] = summary
			
			return ToolResult(
				success=True,
				data=research_data,
				tool_name=self.name,
				metadata={
					"company_name": company_name,
					"research_depth": research_depth,
					"data_sources": ["web_search", "web_scraping"]
				}
			)
			
		except Exception as e:
			raise ToolError(f"Company research failed: {str(e)}", self.name, "RESEARCH_ERROR")
	
	async def _research_basic_info(self, company_name: str) -> Dict[str, Any]:
		"""Research basic company information"""
		search_queries = [
			f"{company_name} company information",
			f"{company_name} headquarters address",
			f"{company_name} founded year industry"
		]
		
		search_results = []
		for query in search_queries:
			result = await self.web_search.safe_execute(query=query, max_results=5)
			if result.success and result.data:
				search_results.extend(result.data[:3])  # Top 3 results per query
		
		# Extract key information from search results
		basic_info = {
			"search_results": search_results[:10],  # Limit total results
			"key_facts": await self._extract_company_facts(search_results),
			"official_websites": await self._identify_official_websites(search_results, company_name)
		}
		
		return basic_info
	
	async def _research_financial_info(self, company_name: str) -> Dict[str, Any]:
		"""Research financial information"""
		financial_queries = [
			f"{company_name} revenue earnings financial",
			f"{company_name} stock price market cap",
			f"{company_name} financial results annual report"
		]
		
		financial_results = []
		for query in financial_queries:
			result = await self.web_search.safe_execute(query=query, max_results=3)
			if result.success and result.data:
				financial_results.extend(result.data)
		
		return {
			"search_results": financial_results,
			"financial_indicators": await self._extract_financial_indicators(financial_results)
		}
	
	async def _research_company_news(self, company_name: str) -> Dict[str, Any]:
		"""Research recent company news"""
		news_queries = [
			f"{company_name} news recent",
			f"{company_name} press release announcement",
			f"{company_name} latest developments 2024"
		]
		
		news_results = []
		for query in news_queries:
			result = await self.web_search.safe_execute(query=query, max_results=5)
			if result.success and result.data:
				news_results.extend(result.data)
		
		return {
			"news_articles": news_results[:15],  # Limit to recent articles
			"news_summary": await self._summarize_news(news_results)
		}
	
	async def _research_competitors(self, company_name: str) -> Dict[str, Any]:
		"""Research company competitors"""
		competitor_query = f"{company_name} competitors rivals industry"
		
		result = await self.web_search.safe_execute(query=competitor_query, max_results=10)
		
		if result.success and result.data:
			competitors = await self._extract_competitors(result.data, company_name)
			return {
				"search_results": result.data,
				"identified_competitors": competitors
			}
		
		return {"competitors": []}
	
	async def _extract_company_facts(self, search_results: List[Any]) -> List[str]:
		"""Extract key company facts from search results"""
		facts = []
		
		for result in search_results[:5]:  # Process top 5 results
			if hasattr(result, 'snippet') and result.snippet:
				# Look for common fact patterns
				snippet = result.snippet
				
				# Founded year
				founded_match = re.search(r'founded (?:in )?(\d{4})', snippet, re.IGNORECASE)
				if founded_match:
					facts.append(f"Founded in {founded_match.group(1)}")
				
				# Headquarters
				hq_patterns = [
					r'headquartered in ([^,]+)',
					r'based in ([^,]+)',
					r'headquarters[^,]*in ([^,]+)'
				]
				for pattern in hq_patterns:
					hq_match = re.search(pattern, snippet, re.IGNORECASE)
					if hq_match:
						facts.append(f"Headquarters: {hq_match.group(1).strip()}")
						break
				
				# Industry
				industry_match = re.search(r'(technology|software|manufacturing|retail|financial|healthcare|automotive|aerospace|energy|telecommunications|media|pharmaceutical|consulting|real estate|hospitality) (?:company|corporation|firm)', snippet, re.IGNORECASE)
				if industry_match:
					facts.append(f"Industry: {industry_match.group(1).title()}")
		
		return list(set(facts))[:10]  # Remove duplicates and limit
	
	async def _identify_official_websites(self, search_results: List[Any], company_name: str) -> List[str]:
		"""Identify official company websites"""
		websites = []
		company_keywords = company_name.lower().split()
		
		for result in search_results:
			if hasattr(result, 'url') and result.url:
				url_lower = result.url.lower()
				# Simple heuristic: URL contains company name or common official indicators
				if any(keyword in url_lower for keyword in company_keywords):
					if not any(unofficial in url_lower for unofficial in ['wikipedia', 'linkedin', 'crunchbase', 'bloomberg']):
						websites.append(result.url)
		
		return list(set(websites))[:3]  # Top 3 potential official websites
	
	async def _extract_financial_indicators(self, financial_results: List[Any]) -> Dict[str, Any]:
		"""Extract financial indicators from search results"""
		indicators = {}
		
		for result in financial_results[:5]:
			if hasattr(result, 'snippet') and result.snippet:
				snippet = result.snippet
				
				# Revenue patterns
				revenue_patterns = [
					r'revenue[^$]*\$([0-9,.]+ (?:billion|million))',
					r'sales[^$]*\$([0-9,.]+ (?:billion|million))',
					r'\$([0-9,.]+ (?:billion|million))[^,]*revenue'
				]
				
				for pattern in revenue_patterns:
					match = re.search(pattern, snippet, re.IGNORECASE)
					if match:
						indicators['revenue'] = match.group(1)
						break
				
				# Employees
				employee_match = re.search(r'([0-9,]+)[^,]*employees', snippet, re.IGNORECASE)
				if employee_match:
					indicators['employees'] = employee_match.group(1)
		
		return indicators
	
	async def _summarize_news(self, news_results: List[Any]) -> str:
		"""Summarize recent news about the company"""
		if not news_results:
			return "No recent news found."
		
		# Combine news snippets
		news_text = " ".join([
			result.snippet for result in news_results[:10] 
			if hasattr(result, 'snippet') and result.snippet
		])
		
		# Use text processor to create summary
		if news_text:
			summary_result = await self.text_processor.safe_execute(
				operation="summarize",
				text=news_text,
				max_sentences=3
			)
			if summary_result.success:
				return summary_result.data.get("summary", "Unable to summarize news.")
		
		return "Limited news information available."
	
	async def _extract_competitors(self, search_results: List[Any], company_name: str) -> List[str]:
		"""Extract competitor names from search results"""
		competitors = []
		
		for result in search_results:
			if hasattr(result, 'snippet') and result.snippet:
				snippet = result.snippet
				
				# Look for competitor mentions
				competitor_patterns = [
					r'competitors? include ([^.]+)',
					r'competes with ([^.]+)',
					r'rivals? (?:include|are) ([^.]+)'
				]
				
				for pattern in competitor_patterns:
					match = re.search(pattern, snippet, re.IGNORECASE)
					if match:
						# Extract company names from the match
						competitor_text = match.group(1)
						# Simple extraction: split by common separators
						potential_competitors = re.split(r'[,;]|\sand\s', competitor_text)
						competitors.extend([c.strip() for c in potential_competitors if c.strip()])
		
		# Filter out the original company name and common non-company words
		filtered_competitors = []
		for comp in competitors:
			if (company_name.lower() not in comp.lower() and 
				len(comp) > 2 and 
				not re.match(r'^(and|or|the|a|an|in|on|at|for|with)$', comp, re.IGNORECASE)):
				filtered_competitors.append(comp)
		
		return list(set(filtered_competitors))[:10]  # Remove duplicates and limit
	
	async def _generate_company_summary(self, research_data: Dict[str, Any]) -> str:
		"""Generate a comprehensive company summary"""
		company_name = research_data["company_name"]
		summary_parts = [f"Research Summary for {company_name}:"]
		
		# Basic info summary
		if "basic_info" in research_data and "key_facts" in research_data["basic_info"]:
			facts = research_data["basic_info"]["key_facts"]
			if facts:
				summary_parts.append(f"Key Facts: {'; '.join(facts[:3])}")
		
		# Financial summary
		if "financial_info" in research_data and "financial_indicators" in research_data["financial_info"]:
			indicators = research_data["financial_info"]["financial_indicators"]
			if indicators:
				financial_items = [f"{k}: {v}" for k, v in indicators.items()]
				summary_parts.append(f"Financial Indicators: {'; '.join(financial_items)}")
		
		# News summary
		if "news" in research_data and "news_summary" in research_data["news"]:
			news_summary = research_data["news"]["news_summary"]
			if news_summary and news_summary != "No recent news found.":
				summary_parts.append(f"Recent Developments: {news_summary}")
		
		return " | ".join(summary_parts)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for company research"""
		return {
			"type": "object",
			"properties": {
				"company_name": {
					"type": "string",
					"description": "Name of the company to research"
				},
				"research_depth": {
					"type": "string",
					"enum": ["basic", "comprehensive"],
					"default": "basic",
					"description": "Depth of research to perform"
				},
				"include_financials": {
					"type": "boolean",
					"default": True,
					"description": "Include financial information in research"
				},
				"include_news": {
					"type": "boolean",
					"default": True,
					"description": "Include recent news in research"
				},
				"include_competitors": {
					"type": "boolean",
					"default": False,
					"description": "Include competitor analysis"
				}
			},
			"required": ["company_name"]
		}


class MarketResearchTool(AgentTool):
	"""
	Tool for market research and analysis
	"""
	
	def __init__(self, config: Optional[ToolConfig] = None):
		super().__init__(
			name="market_research",
			description="Research market trends, size, and opportunities",
			capabilities=[ToolCapability.RESEARCH, ToolCapability.WEB_SEARCH, ToolCapability.DATA_PROCESSING],
			config=config
		)
		self.web_search = WebSearchTool()
		self.text_processor = TextProcessorTool()
	
	async def execute(self, market_or_industry: str, geographic_scope: str = "global",
					 time_horizon: str = "current", include_trends: bool = True,
					 include_size: bool = True, **kwargs) -> ToolResult:
		"""Execute market research"""
		
		try:
			research_data = {
				"market_or_industry": market_or_industry,
				"geographic_scope": geographic_scope,
				"time_horizon": time_horizon,
				"research_timestamp": datetime.now().isoformat()
			}
			
			# Market size research
			if include_size:
				size_info = await self._research_market_size(market_or_industry, geographic_scope)
				research_data["market_size"] = size_info
			
			# Trend analysis
			if include_trends:
				trend_info = await self._research_market_trends(market_or_industry, time_horizon)
				research_data["trends"] = trend_info
			
			# Key players research
			players_info = await self._research_key_players(market_or_industry)
			research_data["key_players"] = players_info
			
			# Generate market insights
			insights = await self._generate_market_insights(research_data)
			research_data["insights"] = insights
			
			return ToolResult(
				success=True,
				data=research_data,
				tool_name=self.name,
				metadata={
					"market": market_or_industry,
					"scope": geographic_scope,
					"horizon": time_horizon
				}
			)
			
		except Exception as e:
			raise ToolError(f"Market research failed: {str(e)}", self.name, "RESEARCH_ERROR")
	
	async def _research_market_size(self, market: str, scope: str) -> Dict[str, Any]:
		"""Research market size information"""
		queries = [
			f"{market} market size {scope}",
			f"{market} industry value {scope}",
			f"{market} market worth revenue {scope}"
		]
		
		size_results = []
		for query in queries:
			result = await self.web_search.safe_execute(query=query, max_results=5)
			if result.success and result.data:
				size_results.extend(result.data)
		
		# Extract size indicators
		size_indicators = await self._extract_market_size_indicators(size_results)
		
		return {
			"search_results": size_results[:10],
			"size_indicators": size_indicators
		}
	
	async def _research_market_trends(self, market: str, time_horizon: str) -> Dict[str, Any]:
		"""Research market trends"""
		trend_queries = [
			f"{market} market trends {time_horizon}",
			f"{market} industry growth forecast",
			f"{market} emerging trends 2024 2025"
		]
		
		trend_results = []
		for query in trend_queries:
			result = await self.web_search.safe_execute(query=query, max_results=5)
			if result.success and result.data:
				trend_results.extend(result.data)
		
		# Extract trend information
		trends = await self._extract_trends(trend_results)
		
		return {
			"search_results": trend_results[:10],
			"identified_trends": trends
		}
	
	async def _research_key_players(self, market: str) -> Dict[str, Any]:
		"""Research key market players"""
		player_queries = [
			f"{market} leading companies market leaders",
			f"{market} top players major companies",
			f"{market} industry leaders key players"
		]
		
		player_results = []
		for query in player_queries:
			result = await self.web_search.safe_execute(query=query, max_results=5)
			if result.success and result.data:
				player_results.extend(result.data)
		
		# Extract player information
		key_players = await self._extract_key_players(player_results)
		
		return {
			"search_results": player_results[:10],
			"key_players": key_players
		}
	
	async def _extract_market_size_indicators(self, search_results: List[Any]) -> Dict[str, Any]:
		"""Extract market size indicators from search results"""
		indicators = {}
		
		for result in search_results[:8]:
			if hasattr(result, 'snippet') and result.snippet:
				snippet = result.snippet
				
				# Market value patterns
				value_patterns = [
					r'market (?:size|value|worth)[^$]*\$([0-9,.]+ (?:billion|million|trillion))',
					r'\$([0-9,.]+ (?:billion|million|trillion))[^,]*market',
					r'valued at[^$]*\$([0-9,.]+ (?:billion|million|trillion))'
				]
				
				for pattern in value_patterns:
					match = re.search(pattern, snippet, re.IGNORECASE)
					if match:
						indicators['market_value'] = match.group(1)
						break
				
				# Growth rate patterns
				growth_patterns = [
					r'grow(?:th|ing) (?:at |by )?([0-9.]+%)',
					r'CAGR[^0-9]*([0-9.]+%)',
					r'compound annual growth rate[^0-9]*([0-9.]+%)'
				]
				
				for pattern in growth_patterns:
					match = re.search(pattern, snippet, re.IGNORECASE)
					if match:
						indicators['growth_rate'] = match.group(1)
						break
		
		return indicators
	
	async def _extract_trends(self, trend_results: List[Any]) -> List[str]:
		"""Extract market trends from search results"""
		trends = []
		
		for result in trend_results[:10]:
			if hasattr(result, 'snippet') and result.snippet:
				snippet = result.snippet
				
				# Look for trend keywords
				trend_keywords = [
					'artificial intelligence', 'AI', 'machine learning', 'automation',
					'digital transformation', 'cloud computing', 'IoT', 'blockchain',
					'sustainability', 'green technology', 'renewable energy',
					'remote work', 'e-commerce', 'mobile-first', 'cybersecurity',
					'personalization', 'data analytics', 'augmented reality', 'AR', 'VR'
				]
				
				for keyword in trend_keywords:
					if keyword.lower() in snippet.lower():
						# Extract sentence containing the keyword
						sentences = snippet.split('.')
						for sentence in sentences:
							if keyword.lower() in sentence.lower():
								trends.append(sentence.strip())
								break
		
		return list(set(trends))[:10]  # Remove duplicates and limit
	
	async def _extract_key_players(self, player_results: List[Any]) -> List[str]:
		"""Extract key market players from search results"""
		players = []
		
		for result in player_results[:8]:
			if hasattr(result, 'snippet') and result.snippet:
				snippet = result.snippet
				
				# Look for company mentions
				player_patterns = [
					r'(?:leading|top|major|key) (?:companies|players|firms)[^.]*include ([^.]+)',
					r'market leaders[^.]*(?:include|are) ([^.]+)',
					r'dominated by ([^.]+)',
					r'key players[^.]*(?:include|are) ([^.]+)'
				]
				
				for pattern in player_patterns:
					match = re.search(pattern, snippet, re.IGNORECASE)
					if match:
						# Extract company names
						player_text = match.group(1)
						potential_players = re.split(r'[,;]|\sand\s', player_text)
						for player in potential_players:
							clean_player = re.sub(r'[^a-zA-Z0-9\s]', '', player.strip())
							if len(clean_player) > 2 and clean_player not in ['Inc', 'LLC', 'Corp']:
								players.append(clean_player)
		
		return list(set(players))[:15]  # Remove duplicates and limit
	
	async def _generate_market_insights(self, research_data: Dict[str, Any]) -> str:
		"""Generate market insights summary"""
		market = research_data["market_or_industry"]
		insights = [f"Market Research Insights for {market}:"]
		
		# Size insights
		if "market_size" in research_data and "size_indicators" in research_data["market_size"]:
			indicators = research_data["market_size"]["size_indicators"]
			if indicators:
				size_items = [f"{k.replace('_', ' ').title()}: {v}" for k, v in indicators.items()]
				insights.append(f"Market Size: {'; '.join(size_items)}")
		
		# Trend insights
		if "trends" in research_data and "identified_trends" in research_data["trends"]:
			trends = research_data["trends"]["identified_trends"]
			if trends:
				insights.append(f"Key Trends: {len(trends)} major trends identified")
		
		# Player insights
		if "key_players" in research_data and "key_players" in research_data["key_players"]:
			players = research_data["key_players"]["key_players"]
			if players:
				insights.append(f"Market Leaders: {len(players)} key players identified")
		
		return " | ".join(insights)
	
	def get_parameters_schema(self) -> Dict[str, Any]:
		"""Get parameters schema for market research"""
		return {
			"type": "object",
			"properties": {
				"market_or_industry": {
					"type": "string",
					"description": "Market or industry to research"
				},
				"geographic_scope": {
					"type": "string",
					"enum": ["global", "north_america", "europe", "asia_pacific", "local"],
					"default": "global",
					"description": "Geographic scope of research"
				},
				"time_horizon": {
					"type": "string",
					"enum": ["current", "short_term", "long_term"],
					"default": "current",
					"description": "Time horizon for analysis"
				},
				"include_trends": {
					"type": "boolean",
					"default": True,
					"description": "Include trend analysis"
				},
				"include_size": {
					"type": "boolean",
					"default": True,
					"description": "Include market size research"
				}
			},
			"required": ["market_or_industry"]
		}


# Additional research tools would go here:
# CompetitorAnalysisTool, TrendAnalysisTool, etc.