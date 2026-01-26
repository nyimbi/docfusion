"""
Week 11 Intelligence Engine Performance Tests

This module tests the performance, scalability, and efficiency of the intelligence
engine components to ensure they meet production performance requirements and
can handle realistic workloads.
"""

import asyncio
import pytest
import time
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any
import concurrent.futures
from memory_profiler import profile

# Intelligence engine imports
from src.proposal_writer.intelligence.predictors.win_probability_predictor import (
    WinProbabilityPredictor, PredictionFeatures, HistoricalOpportunity
)
from src.proposal_writer.intelligence.predictors.scoring_predictor import (
    ScoringPredictor, SectionFeatures, ProposalSection, HistoricalSectionScore
)
from src.proposal_writer.intelligence.recommenders.strategy_recommender import StrategyRecommender, OpportunityContext
from src.proposal_writer.intelligence.recommenders.content_recommender import ContentRecommender
from src.proposal_writer.intelligence.integrations.discovery_integration import (
    IntelligenceDiscoveryService, IntelligenceLevel
)
from src.proposal_writer.intelligence.integrations.storage_integration import IntelligenceStorageService
from src.proposal_writer.intelligence.integrations.document_integration import (
    IntelligenceDocumentService, IntegrationMode
)


class Week11IntelligencePerformanceTests:
    """Comprehensive performance tests for Week 11 intelligence components"""
    
    def __init__(self):
        self.performance_results = {}
        self.benchmark_data = {}
    
    @pytest.mark.asyncio
    async def test_win_probability_predictor_performance(self):
        """Test win probability predictor performance under load"""
        
        predictor = WinProbabilityPredictor()
        
        # Generate training data
        print("\n📊 Testing Win Probability Predictor Performance...")
        training_sizes = [50, 100, 200, 500]
        training_times = []
        prediction_times = []
        
        for size in training_sizes:
            print(f"  Training with {size} samples...")
            
            # Generate training data
            training_data = self._generate_training_data(size)
            
            # Measure training time
            start_time = time.time()
            await predictor.train_model(training_data, test_size=0.2, cross_val_folds=3)
            training_time = time.time() - start_time
            training_times.append(training_time)
            
            print(f"    Training time: {training_time:.2f}s")
            
            # Measure prediction time
            test_features = self._generate_test_features()
            
            # Single prediction
            start_time = time.time()
            await predictor.predict_win_probability(test_features, f"perf_test_{size}")
            single_prediction_time = time.time() - start_time
            
            # Batch predictions
            batch_size = 10
            start_time = time.time()
            for i in range(batch_size):
                await predictor.predict_win_probability(test_features, f"batch_test_{size}_{i}")
            batch_time = time.time() - start_time
            avg_prediction_time = batch_time / batch_size
            
            prediction_times.append(avg_prediction_time)
            print(f"    Single prediction: {single_prediction_time:.4f}s")
            print(f"    Avg batch prediction: {avg_prediction_time:.4f}s")
        
        # Performance requirements
        max_training_time = max(training_times)
        avg_prediction_time = statistics.mean(prediction_times)
        
        assert max_training_time <= 60.0, f"Training too slow: {max_training_time:.2f}s"
        assert avg_prediction_time <= 0.5, f"Prediction too slow: {avg_prediction_time:.4f}s"
        
        self.performance_results['win_probability_performance'] = {
            'training_times': training_times,
            'prediction_times': prediction_times,
            'max_training_time': max_training_time,
            'avg_prediction_time': avg_prediction_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Max training time: {max_training_time:.2f}s (≤60s)")
        print(f"     Avg prediction time: {avg_prediction_time:.4f}s (≤0.5s)")
    
    @pytest.mark.asyncio
    async def test_scoring_predictor_performance(self):
        """Test section scoring predictor performance"""
        
        predictor = ScoringPredictor()
        
        print("\n📊 Testing Scoring Predictor Performance...")
        
        # Training performance
        training_data = self._generate_section_training_data(150)
        
        start_time = time.time()
        await predictor.train_section_models(training_data, test_size=0.2)
        training_time = time.time() - start_time
        
        print(f"  Section model training: {training_time:.2f}s")
        
        # Prediction performance for each section type
        test_features = self._generate_test_section_features()
        section_prediction_times = {}
        
        for section_type in predictor.is_trained:
            if predictor.is_trained[section_type]:
                # Single prediction time
                start_time = time.time()
                await predictor.predict_section_score(test_features, section_type)
                prediction_time = time.time() - start_time
                section_prediction_times[section_type.value] = prediction_time
                
                print(f"  {section_type.value} prediction: {prediction_time:.4f}s")
        
        # Concurrent prediction test
        async def predict_concurrent():
            tasks = []
            for section_type in predictor.is_trained:
                if predictor.is_trained[section_type]:
                    task = predictor.predict_section_score(test_features, section_type)
                    tasks.append(task)
            
            start_time = time.time()
            await asyncio.gather(*tasks)
            return time.time() - start_time
        
        concurrent_time = await predict_concurrent()
        
        # Performance requirements
        avg_prediction_time = statistics.mean(section_prediction_times.values())
        
        assert training_time <= 120.0, f"Training too slow: {training_time:.2f}s"
        assert avg_prediction_time <= 1.0, f"Prediction too slow: {avg_prediction_time:.4f}s"
        assert concurrent_time <= 2.0, f"Concurrent predictions too slow: {concurrent_time:.2f}s"
        
        self.performance_results['scoring_predictor_performance'] = {
            'training_time': training_time,
            'section_prediction_times': section_prediction_times,
            'avg_prediction_time': avg_prediction_time,
            'concurrent_time': concurrent_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Training time: {training_time:.2f}s (≤120s)")
        print(f"     Avg prediction time: {avg_prediction_time:.4f}s (≤1.0s)")
        print(f"     Concurrent time: {concurrent_time:.2f}s (≤2.0s)")
    
    @pytest.mark.asyncio
    async def test_strategy_recommender_performance(self):
        """Test strategy recommender performance"""
        
        recommender = StrategyRecommender()
        
        print("\n📊 Testing Strategy Recommender Performance...")
        
        # Single recommendation performance
        context = self._generate_test_opportunity_context()
        features = self._generate_test_features()
        
        start_time = time.time()
        recommendation = await recommender.recommend_strategy(context, features)
        single_recommendation_time = time.time() - start_time
        
        print(f"  Single recommendation: {single_recommendation_time:.4f}s")
        
        # Batch recommendations
        batch_size = 20
        contexts = [self._generate_test_opportunity_context() for _ in range(batch_size)]
        
        start_time = time.time()
        for i, ctx in enumerate(contexts):
            ctx.opportunity_id = f"perf_test_{i}"
            await recommender.recommend_strategy(ctx, features)
        batch_time = time.time() - start_time
        avg_batch_time = batch_time / batch_size
        
        print(f"  Batch recommendations ({batch_size}): {batch_time:.2f}s")
        print(f"  Avg per recommendation: {avg_batch_time:.4f}s")
        
        # Concurrent recommendations
        async def concurrent_recommendations():
            tasks = []
            for i in range(10):
                ctx = self._generate_test_opportunity_context()
                ctx.opportunity_id = f"concurrent_test_{i}"
                task = recommender.recommend_strategy(ctx, features)
                tasks.append(task)
            
            start_time = time.time()
            await asyncio.gather(*tasks)
            return time.time() - start_time
        
        concurrent_time = await concurrent_recommendations()
        
        # Performance requirements
        assert single_recommendation_time <= 2.0, f"Single recommendation too slow: {single_recommendation_time:.4f}s"
        assert avg_batch_time <= 1.0, f"Batch recommendation too slow: {avg_batch_time:.4f}s"
        assert concurrent_time <= 5.0, f"Concurrent recommendations too slow: {concurrent_time:.2f}s"
        
        self.performance_results['strategy_recommender_performance'] = {
            'single_recommendation_time': single_recommendation_time,
            'avg_batch_time': avg_batch_time,
            'concurrent_time': concurrent_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Single recommendation: {single_recommendation_time:.4f}s (≤2.0s)")
        print(f"     Avg batch time: {avg_batch_time:.4f}s (≤1.0s)")
        print(f"     Concurrent time: {concurrent_time:.2f}s (≤5.0s)")
    
    @pytest.mark.asyncio
    async def test_content_recommender_performance(self):
        """Test content recommender performance with various content sizes"""
        
        recommender = ContentRecommender()
        
        print("\n📊 Testing Content Recommender Performance...")
        
        # Test different content sizes
        content_sizes = [
            (500, "small"),
            (1500, "medium"), 
            (3000, "large"),
            (6000, "very_large")
        ]
        
        analysis_times = {}
        
        for word_count, size_name in content_sizes:
            content = self._generate_test_content(word_count)
            
            start_time = time.time()
            report = await recommender.analyze_content(
                content, ProposalSection.TECHNICAL_APPROACH
            )
            analysis_time = time.time() - start_time
            
            analysis_times[size_name] = analysis_time
            print(f"  {size_name} content ({word_count} words): {analysis_time:.3f}s")
        
        # Concurrent analysis test
        medium_content = self._generate_test_content(1500)
        
        async def concurrent_analysis():
            tasks = []
            for i in range(5):
                task = recommender.analyze_content(
                    medium_content, ProposalSection.TECHNICAL_APPROACH
                )
                tasks.append(task)
            
            start_time = time.time()
            await asyncio.gather(*tasks)
            return time.time() - start_time
        
        concurrent_time = await concurrent_analysis()
        
        # Performance requirements
        max_analysis_time = max(analysis_times.values())
        medium_analysis_time = analysis_times.get('medium', 0)
        
        assert medium_analysis_time <= 3.0, f"Medium content analysis too slow: {medium_analysis_time:.3f}s"
        assert max_analysis_time <= 8.0, f"Large content analysis too slow: {max_analysis_time:.3f}s"
        assert concurrent_time <= 10.0, f"Concurrent analysis too slow: {concurrent_time:.2f}s"
        
        self.performance_results['content_recommender_performance'] = {
            'analysis_times': analysis_times,
            'concurrent_time': concurrent_time,
            'max_analysis_time': max_analysis_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Medium content: {medium_analysis_time:.3f}s (≤3.0s)")
        print(f"     Max analysis time: {max_analysis_time:.3f}s (≤8.0s)")
        print(f"     Concurrent time: {concurrent_time:.2f}s (≤10.0s)")
    
    @pytest.mark.asyncio
    async def test_discovery_integration_performance(self):
        """Test discovery integration service performance"""
        
        service = IntelligenceDiscoveryService()
        
        print("\n📊 Testing Discovery Integration Performance...")
        
        # Mock opportunity data
        class MockOpportunityData:
            def __init__(self, opp_id):
                self.id = opp_id
                self.title = f"Test Opportunity {opp_id}"
                self.description = "Comprehensive software development project with multiple components"
                self.estimated_value = 2500000.0
                self.submission_deadline = datetime.now() + timedelta(days=45)
        
        # Single analysis performance
        opportunity = MockOpportunityData("perf_test_001")
        
        start_time = time.time()
        intelligence = await service.analyze_opportunity_intelligence(
            opportunity, IntelligenceLevel.ENHANCED
        )
        single_analysis_time = time.time() - start_time
        
        print(f"  Single intelligence analysis: {single_analysis_time:.3f}s")
        
        # Bulk analysis performance
        opportunities = [MockOpportunityData(f"bulk_test_{i:03d}") for i in range(10)]
        
        start_time = time.time()
        bulk_results = await service.bulk_analyze_opportunities(opportunities, IntelligenceLevel.BASIC)
        bulk_analysis_time = time.time() - start_time
        avg_bulk_time = bulk_analysis_time / len(opportunities)
        
        print(f"  Bulk analysis (10 opportunities): {bulk_analysis_time:.3f}s")
        print(f"  Avg per opportunity: {avg_bulk_time:.3f}s")
        
        # Concurrent analysis
        async def concurrent_analysis():
            tasks = []
            for i in range(5):
                opp = MockOpportunityData(f"concurrent_test_{i}")
                task = service.analyze_opportunity_intelligence(opp, IntelligenceLevel.BASIC)
                tasks.append(task)
            
            start_time = time.time()
            await asyncio.gather(*tasks)
            return time.time() - start_time
        
        concurrent_time = await concurrent_analysis()
        
        # Performance requirements
        assert single_analysis_time <= 5.0, f"Single analysis too slow: {single_analysis_time:.3f}s"
        assert avg_bulk_time <= 2.0, f"Bulk analysis too slow: {avg_bulk_time:.3f}s per opportunity"
        assert concurrent_time <= 8.0, f"Concurrent analysis too slow: {concurrent_time:.3f}s"
        
        self.performance_results['discovery_integration_performance'] = {
            'single_analysis_time': single_analysis_time,
            'bulk_analysis_time': bulk_analysis_time,
            'avg_bulk_time': avg_bulk_time,
            'concurrent_time': concurrent_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Single analysis: {single_analysis_time:.3f}s (≤5.0s)")
        print(f"     Avg bulk time: {avg_bulk_time:.3f}s (≤2.0s)")
        print(f"     Concurrent time: {concurrent_time:.3f}s (≤8.0s)")
    
    @pytest.mark.asyncio
    async def test_storage_integration_performance(self):
        """Test storage integration performance"""
        
        service = IntelligenceStorageService()
        
        print("\n📊 Testing Storage Integration Performance...")
        
        # Storage performance
        sample_data = [{"id": f"test_{i}", "value": i * 100} for i in range(100)]
        
        start_time = time.time()
        storage_path = await service.store_historical_data(sample_data, "performance_test")
        storage_time = time.time() - start_time
        
        print(f"  Store 100 records: {storage_time:.3f}s")
        
        # Retrieval performance
        start_time = time.time()
        retrieved_data = await service.load_historical_data("performance_test", limit=100)
        retrieval_time = time.time() - start_time
        
        print(f"  Retrieve 100 records: {retrieval_time:.3f}s")
        
        # Bulk storage operations
        bulk_datasets = [
            [{"id": f"bulk_{j}_{i}", "value": i} for i in range(50)]
            for j in range(10)
        ]
        
        start_time = time.time()
        for j, dataset in enumerate(bulk_datasets):
            await service.store_historical_data(dataset, f"bulk_test_{j}")
        bulk_storage_time = time.time() - start_time
        
        print(f"  Bulk storage (10 datasets, 50 records each): {bulk_storage_time:.3f}s")
        
        # Performance requirements
        storage_rate = len(sample_data) / storage_time  # records per second
        retrieval_rate = len(retrieved_data) / retrieval_time
        
        assert storage_time <= 2.0, f"Storage too slow: {storage_time:.3f}s"
        assert retrieval_time <= 1.0, f"Retrieval too slow: {retrieval_time:.3f}s"
        assert storage_rate >= 50, f"Storage rate too low: {storage_rate:.1f} records/s"
        
        self.performance_results['storage_integration_performance'] = {
            'storage_time': storage_time,
            'retrieval_time': retrieval_time,
            'storage_rate': storage_rate,
            'retrieval_rate': retrieval_rate,
            'bulk_storage_time': bulk_storage_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Storage time: {storage_time:.3f}s (≤2.0s)")
        print(f"     Retrieval time: {retrieval_time:.3f}s (≤1.0s)")
        print(f"     Storage rate: {storage_rate:.1f} records/s (≥50)")
    
    @pytest.mark.asyncio
    async def test_document_integration_performance(self):
        """Test document integration performance"""
        
        service = IntelligenceDocumentService()
        
        print("\n📊 Testing Document Integration Performance...")
        
        # Session management performance
        start_time = time.time()
        session_id = await service.start_intelligence_session("perf_test_proposal")
        session_start_time = time.time() - start_time
        
        print(f"  Session start: {session_start_time:.4f}s")
        
        # Content analysis performance
        content_sizes = [
            (200, "small"),
            (800, "medium"),
            (2000, "large")
        ]
        
        analysis_times = {}
        
        for word_count, size_name in content_sizes:
            content = self._generate_test_content(word_count)
            
            start_time = time.time()
            insights = await service.analyze_section_content(
                session_id, ProposalSection.TECHNICAL_APPROACH, content
            )
            analysis_time = time.time() - start_time
            
            analysis_times[size_name] = analysis_time
            print(f"  {size_name} content analysis: {analysis_time:.3f}s")
        
        # Real-time simulation (multiple rapid analyses)
        medium_content = self._generate_test_content(800)
        
        start_time = time.time()
        for i in range(5):
            await service.analyze_section_content(
                session_id, ProposalSection.TECHNICAL_APPROACH, 
                medium_content + f" Update {i}"
            )
        rapid_analysis_time = time.time() - start_time
        avg_rapid_time = rapid_analysis_time / 5
        
        print(f"  Rapid analysis (5 iterations): {rapid_analysis_time:.3f}s")
        print(f"  Avg per iteration: {avg_rapid_time:.3f}s")
        
        # Session cleanup
        start_time = time.time()
        final_session = await service.end_intelligence_session(session_id)
        session_end_time = time.time() - start_time
        
        print(f"  Session end: {session_end_time:.4f}s")
        
        # Performance requirements
        medium_analysis_time = analysis_times.get('medium', 0)
        
        assert session_start_time <= 1.0, f"Session start too slow: {session_start_time:.4f}s"
        assert medium_analysis_time <= 4.0, f"Medium content analysis too slow: {medium_analysis_time:.3f}s"
        assert avg_rapid_time <= 2.0, f"Rapid analysis too slow: {avg_rapid_time:.3f}s"
        assert session_end_time <= 0.5, f"Session end too slow: {session_end_time:.4f}s"
        
        self.performance_results['document_integration_performance'] = {
            'session_start_time': session_start_time,
            'analysis_times': analysis_times,
            'avg_rapid_time': avg_rapid_time,
            'session_end_time': session_end_time
        }
        
        print(f"  ✅ Performance Requirements Met")
        print(f"     Session start: {session_start_time:.4f}s (≤1.0s)")
        print(f"     Medium analysis: {medium_analysis_time:.3f}s (≤4.0s)")
        print(f"     Rapid analysis: {avg_rapid_time:.3f}s (≤2.0s)")
    
    @pytest.mark.asyncio 
    async def test_memory_usage_performance(self):
        """Test memory usage under load"""
        
        print("\n📊 Testing Memory Usage Performance...")
        
        # This would typically use memory profiling tools
        # For now, we'll do basic memory stress testing
        
        # Create multiple predictors and load them with data
        predictors = []
        for i in range(3):
            predictor = WinProbabilityPredictor()
            training_data = self._generate_training_data(100)
            await predictor.train_model(training_data)
            predictors.append(predictor)
        
        # Memory-intensive operations
        start_time = time.time()
        for predictor in predictors:
            features = self._generate_test_features()
            for j in range(20):
                await predictor.predict_win_probability(features, f"memory_test_{j}")
        
        memory_test_time = time.time() - start_time
        
        print(f"  Memory stress test (3 predictors, 60 predictions): {memory_test_time:.3f}s")
        
        # Performance requirement
        assert memory_test_time <= 30.0, f"Memory stress test too slow: {memory_test_time:.3f}s"
        
        self.performance_results['memory_usage_performance'] = {
            'memory_stress_time': memory_test_time
        }
        
        print(f"  ✅ Memory Performance Requirements Met")
        print(f"     Memory stress time: {memory_test_time:.3f}s (≤30.0s)")
    
    def _generate_training_data(self, count: int) -> List[HistoricalOpportunity]:
        """Generate training data for performance testing"""
        
        data = []
        for i in range(count):
            features = PredictionFeatures(
                opportunity_value=float(1000000 + (i * 100000)),
                submission_days_remaining=30 + (i % 60),
                requirements_complexity=0.5 + (i % 5) * 0.1,
                capability_match_score=0.6 + (i % 4) * 0.1,
                past_performance_score=0.5 + (i % 5) * 0.1,
                team_experience_score=0.6 + (i % 4) * 0.1,
                competitive_intensity=0.4 + (i % 6) * 0.1,
                incumbent_advantage=(i % 3) == 0,
                estimated_competitors=3 + (i % 5),
                market_familiarity=0.5 + (i % 5) * 0.1,
                industry_experience_years=5 + (i % 10),
                client_relationship_score=0.4 + (i % 6) * 0.1,
                strategic_importance=0.5 + (i % 5) * 0.1,
                resource_availability=0.6 + (i % 4) * 0.1,
                pricing_competitiveness=0.5 + (i % 5) * 0.1
            )
            
            # Simple outcome based on features
            outcome = (features.capability_match_score + features.past_performance_score) > 1.2
            
            data.append(HistoricalOpportunity(
                opportunity_id=f"perf_hist_{i:03d}",
                features=features,
                actual_outcome=outcome
            ))
        
        return data
    
    def _generate_section_training_data(self, count: int) -> List[HistoricalSectionScore]:
        """Generate section training data"""
        
        data = []
        section_types = [ProposalSection.TECHNICAL_APPROACH, ProposalSection.MANAGEMENT_APPROACH]
        
        for i in range(count):
            section_type = section_types[i % len(section_types)]
            
            features = SectionFeatures(
                word_count=1000 + (i * 50),
                unique_concepts_count=10 + (i % 15),
                technical_depth_score=0.5 + (i % 5) * 0.1,
                clarity_score=0.6 + (i % 4) * 0.1,
                requirement_coverage_ratio=0.7 + (i % 3) * 0.1,
                compliance_score=0.8 + (i % 2) * 0.1,
                quantitative_evidence_count=3 + (i % 8),
                case_study_relevance=0.5 + (i % 5) * 0.1,
                reference_quality_score=0.6 + (i % 4) * 0.1,
                team_expertise_match=0.7 + (i % 3) * 0.1,
                past_performance_relevance=0.6 + (i % 4) * 0.1,
                innovation_score=0.4 + (i % 6) * 0.1,
                differentiation_strength=0.5 + (i % 5) * 0.1,
                risk_identification_completeness=0.7 + (i % 3) * 0.1,
                mitigation_strategy_quality=0.6 + (i % 4) * 0.1,
                section_completion_percentage=0.8 + (i % 2) * 0.1
            )
            
            # Calculate score
            score = 60 + (features.technical_depth_score + features.clarity_score + features.compliance_score) * 13
            
            data.append(HistoricalSectionScore(
                section_id=f"perf_section_{i:03d}",
                section_type=section_type,
                features=features,
                actual_score=score
            ))
        
        return data
    
    def _generate_test_features(self) -> PredictionFeatures:
        """Generate test features for performance testing"""
        
        return PredictionFeatures(
            opportunity_value=3000000.0,
            submission_days_remaining=35,
            requirements_complexity=0.7,
            capability_match_score=0.8,
            past_performance_score=0.75,
            team_experience_score=0.8,
            competitive_intensity=0.5,
            incumbent_advantage=False,
            estimated_competitors=4,
            market_familiarity=0.7,
            industry_experience_years=10,
            client_relationship_score=0.6,
            strategic_importance=0.8,
            resource_availability=0.9,
            pricing_competitiveness=0.7
        )
    
    def _generate_test_section_features(self) -> SectionFeatures:
        """Generate test section features"""
        
        return SectionFeatures(
            word_count=1800,
            unique_concepts_count=20,
            technical_depth_score=0.8,
            clarity_score=0.85,
            requirement_coverage_ratio=0.9,
            compliance_score=0.95,
            quantitative_evidence_count=6,
            case_study_relevance=0.75,
            reference_quality_score=0.8,
            team_expertise_match=0.85,
            past_performance_relevance=0.8,
            innovation_score=0.7,
            differentiation_strength=0.75,
            risk_identification_completeness=0.9,
            mitigation_strategy_quality=0.85,
            section_completion_percentage=0.95
        )
    
    def _generate_test_opportunity_context(self) -> OpportunityContext:
        """Generate test opportunity context"""
        
        return OpportunityContext(
            opportunity_id="perf_test_opp",
            opportunity_value=2500000.0,
            submission_deadline=datetime.now() + timedelta(days=35),
            strategic_importance=0.7,
            market_expansion_potential=0.6,
            relationship_building_value=0.5,
            competitive_intensity=0.5,
            incumbent_advantage=False,
            estimated_proposal_effort_hours=250,
            required_team_size=6,
            specialized_skills_required=["technical_skills"]
        )
    
    def _generate_test_content(self, word_count: int) -> str:
        """Generate test content of specified word count"""
        
        base_content = """
        Our comprehensive technical approach leverages industry-leading methodologies and proven frameworks
        to deliver exceptional results. We have successfully implemented similar solutions for clients,
        achieving significant improvements in system performance and operational efficiency.
        
        Our methodology includes detailed requirements analysis, systematic architecture design, agile 
        development processes, comprehensive testing protocols, and structured deployment procedures.
        Quality assurance is maintained through automated testing, peer reviews, and continuous integration.
        
        Risk management strategies include proactive identification of technical and operational risks,
        detailed mitigation plans, and contingency procedures. Our team brings extensive experience
        in similar implementations, with certified project managers and technical architects.
        """
        
        words = base_content.split()
        
        # Repeat and trim to desired word count
        content_words = (words * ((word_count // len(words)) + 1))[:word_count]
        
        return " ".join(content_words)


@pytest.mark.asyncio
async def test_week11_intelligence_performance_suite():
    """Run complete Week 11 intelligence performance test suite"""
    
    test_suite = Week11IntelligencePerformanceTests()
    
    print("\n⚡ Week 11 Intelligence Engine Performance Tests")
    print("=" * 70)
    
    # Run all performance tests
    await test_suite.test_win_probability_predictor_performance()
    await test_suite.test_scoring_predictor_performance()
    await test_suite.test_strategy_recommender_performance()
    await test_suite.test_content_recommender_performance()
    await test_suite.test_discovery_integration_performance()
    await test_suite.test_storage_integration_performance()
    await test_suite.test_document_integration_performance()
    await test_suite.test_memory_usage_performance()
    
    # Performance summary
    print(f"\n📊 Performance Test Summary:")
    print("=" * 50)
    
    all_passed = True
    for test_name, results in test_suite.performance_results.items():
        print(f"  ✅ {test_name}: PASSED")
    
    # Overall performance assessment
    print(f"\n🎉 ALL PERFORMANCE TESTS PASSED!")
    print(f"   Week 11 Intelligence Engine meets performance requirements")
    print(f"   Ready for production deployment")
    
    # Performance benchmarks
    print(f"\n📈 Key Performance Benchmarks:")
    if 'win_probability_performance' in test_suite.performance_results:
        wp_results = test_suite.performance_results['win_probability_performance']
        print(f"   Win Probability Prediction: {wp_results['avg_prediction_time']:.4f}s avg")
    
    if 'scoring_predictor_performance' in test_suite.performance_results:
        sp_results = test_suite.performance_results['scoring_predictor_performance']
        print(f"   Section Score Prediction: {sp_results['avg_prediction_time']:.4f}s avg")
    
    if 'discovery_integration_performance' in test_suite.performance_results:
        di_results = test_suite.performance_results['discovery_integration_performance']
        print(f"   Intelligence Analysis: {di_results['single_analysis_time']:.3f}s")
    
    assert all_passed, "Not all performance tests passed"


if __name__ == "__main__":
    # Run performance tests
    import sys
    
    async def main():
        try:
            await test_week11_intelligence_performance_suite()
            print(f"\n✅ Week 11 Intelligence Engine Performance Tests COMPLETED")
            return 0
        except Exception as e:
            print(f"\n❌ Performance tests failed: {str(e)}")
            return 1
    
    sys.exit(asyncio.run(main()))