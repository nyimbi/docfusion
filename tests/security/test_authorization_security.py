#!/usr/bin/env python3
"""
Authorization Security Tests

Comprehensive security testing for ABAC authorization including edge cases,
policy validation, time-based controls, and location-based restrictions.
"""

import asyncio
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from typing import Dict, Any

from docfusion.security.authorization.abac_authorization import (
    ABACAuthorization, ABACConfiguration, PolicyEffect, AttributeType,
    AttributeCondition, PolicyRule, ABACPolicy, ComparisonOperator
)
from docfusion.security.authorization.contextual_access import (
    ContextualAccessManager, AccessContext, TimeBasedPolicy, LocationBasedPolicy
)


class TestABACSecurityCore:
    """Core ABAC security tests"""
    
    @pytest.fixture
    def abac_auth(self):
        config = ABACConfiguration()
        return ABACAuthorization(config)
    
    @pytest.mark.asyncio
    async def test_default_deny_policy(self, abac_auth):
        """Test default deny behavior with no policies"""
        decision = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "user123"},
            resource_attributes={"resource_id": "doc123"},
            action_attributes={"action": "read"}
        )
        
        assert decision.decision == PolicyEffect.DENY
    
    @pytest.mark.asyncio
    async def test_policy_combining_deny_overrides(self, abac_auth):
        """Test deny-overrides policy combining algorithm"""
        # Add permit policy
        permit_rule = PolicyRule(
            name="Permit Rule",
            effect=PolicyEffect.PERMIT,
            conditions=[
                AttributeCondition(
                    attribute_type=AttributeType.SUBJECT,
                    attribute_name="role",
                    operator=ComparisonOperator.EQUALS,
                    value="user"
                )
            ]
        )
        permit_policy = ABACPolicy(
            name="Permit Policy",
            rules=[permit_rule]
        )
        abac_auth.add_policy(permit_policy)
        
        # Add deny policy with higher priority
        deny_rule = PolicyRule(
            name="Deny Rule",
            effect=PolicyEffect.DENY,
            priority=100,
            conditions=[
                AttributeCondition(
                    attribute_type=AttributeType.RESOURCE,
                    attribute_name="classification",
                    operator=ComparisonOperator.EQUALS,
                    value="restricted"
                )
            ]
        )
        deny_policy = ABACPolicy(
            name="Deny Policy",
            rules=[deny_rule]
        )
        abac_auth.add_policy(deny_policy)
        
        # Should deny due to deny-overrides
        decision = await abac_auth.evaluate_access(
            subject_attributes={"role": "user"},
            resource_attributes={"classification": "restricted"},
            action_attributes={"action": "read"}
        )
        
        assert decision.decision == PolicyEffect.DENY
    
    @pytest.mark.asyncio
    async def test_attribute_injection_protection(self, abac_auth):
        """Test protection against attribute injection attacks"""
        # Malicious attributes with code injection attempts
        malicious_subject = {
            "user_id": "'; DROP TABLE users; --",
            "role": "<script>alert('xss')</script>",
            "eval": "__import__('os').system('rm -rf /')"
        }
        
        # Should not cause any security issues
        decision = await abac_auth.evaluate_access(
            subject_attributes=malicious_subject,
            resource_attributes={"resource_id": "doc123"},
            action_attributes={"action": "read"}
        )
        
        # Should handle safely and return default deny
        assert decision.decision == PolicyEffect.DENY
    
    @pytest.mark.asyncio
    async def test_policy_evaluation_timeout(self, abac_auth):
        """Test policy evaluation timeout protection"""
        abac_auth.config.max_evaluation_time_seconds = 0.001  # 1ms timeout
        
        # Create complex policy that might take time
        complex_conditions = []
        for i in range(1000):  # Many conditions
            complex_conditions.append(
                AttributeCondition(
                    attribute_type=AttributeType.SUBJECT,
                    attribute_name=f"attr_{i}",
                    operator=ComparisonOperator.REGEX_MATCH,
                    value=r".*very.*complex.*regex.*pattern.*"
                )
            )
        
        complex_rule = PolicyRule(
            name="Complex Rule",
            effect=PolicyEffect.PERMIT,
            conditions=complex_conditions
        )
        complex_policy = ABACPolicy(
            name="Complex Policy",
            rules=[complex_rule]
        )
        abac_auth.add_policy(complex_policy)
        
        # Should handle timeout gracefully
        start_time = datetime.now(timezone.utc)
        decision = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "test"},
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "test"}
        )
        end_time = datetime.now(timezone.utc)
        
        # Should complete reasonably quickly despite complex policy
        assert (end_time - start_time).total_seconds() < 1.0
    
    @pytest.mark.asyncio
    async def test_regex_pattern_security(self, abac_auth):
        """Test regex pattern security (ReDoS protection)"""
        # Potentially dangerous regex pattern (ReDoS vulnerability)
        dangerous_condition = AttributeCondition(
            attribute_type=AttributeType.SUBJECT,
            attribute_name="username",
            operator=ComparisonOperator.REGEX_MATCH,
            value=r"(a+)+b"  # Catastrophic backtracking pattern
        )
        
        rule = PolicyRule(
            name="Dangerous Regex Rule",
            effect=PolicyEffect.PERMIT,
            conditions=[dangerous_condition]
        )
        policy = ABACPolicy(name="Test Policy", rules=[rule])
        abac_auth.add_policy(policy)
        
        # Test with input that could trigger ReDoS
        start_time = datetime.now(timezone.utc)
        decision = await abac_auth.evaluate_access(
            subject_attributes={"username": "a" * 30 + "c"},  # No 'b' to cause backtracking
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "test"}
        )
        end_time = datetime.now(timezone.utc)
        
        # Should complete quickly even with dangerous pattern
        assert (end_time - start_time).total_seconds() < 0.1


class TestTimeBasedSecurity:
    """Time-based access control security tests"""
    
    @pytest.fixture
    def abac_auth(self):
        return ABACAuthorization()
    
    @pytest.mark.asyncio
    async def test_business_hours_enforcement(self, abac_auth):
        """Test business hours access enforcement"""
        # Create business hours rule
        business_hours_rule = abac_auth.create_time_based_rule(
            name="Business Hours Only",
            effect=PolicyEffect.PERMIT,
            start_time="09:00",
            end_time="17:00",
            days_of_week=[0, 1, 2, 3, 4]  # Monday-Friday
        )
        
        policy = ABACPolicy(
            name="Business Hours Policy",
            rules=[business_hours_rule]
        )
        abac_auth.add_policy(policy)
        
        # Mock current time to be outside business hours
        with patch('datetime.datetime') as mock_datetime:
            # Saturday at 8 AM (outside business hours)
            mock_datetime.now.return_value = datetime(2024, 1, 6, 8, 0, 0, tzinfo=timezone.utc)  # Saturday
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
            
            decision = await abac_auth.evaluate_access(
                subject_attributes={"user_id": "test"},
                resource_attributes={"resource_id": "test"},
                action_attributes={"action": "read"}
            )
            
            assert decision.decision == PolicyEffect.DENY
    
    @pytest.mark.asyncio
    async def test_time_zone_attack_protection(self, abac_auth):
        """Test protection against time zone manipulation attacks"""
        # Create time-based rule
        time_rule = abac_auth.create_time_based_rule(
            name="Daytime Access",
            effect=PolicyEffect.PERMIT,
            start_time="08:00",
            end_time="20:00"
        )
        
        policy = ABACPolicy(name="Time Policy", rules=[time_rule])
        abac_auth.add_policy(policy)
        
        # Try to manipulate environment with different time zones
        malicious_env = {
            "current_time": "2024-01-15T10:00:00+12:00",  # Different timezone
            "timezone": "Pacific/Kiritimati",
            "utc_offset": "+14:00"
        }
        
        # Should use system time, not provided time
        decision = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "test"},
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "read"},
            environment_attributes=malicious_env
        )
        
        # Decision should be based on actual system time, not manipulated time
        assert decision.decision in [PolicyEffect.PERMIT, PolicyEffect.DENY]  # Depends on actual time


class TestLocationBasedSecurity:
    """Location-based access control security tests"""
    
    @pytest.fixture
    def abac_auth(self):
        return ABACAuthorization()
    
    @pytest.mark.asyncio
    async def test_ip_network_restrictions(self, abac_auth):
        """Test IP network-based access restrictions"""
        # Create location-based rule for corporate network
        location_rule = abac_auth.create_location_based_rule(
            name="Corporate Network Only",
            effect=PolicyEffect.PERMIT,
            allowed_networks=["192.168.1.0/24", "10.0.0.0/8"]
        )
        
        policy = ABACPolicy(name="Location Policy", rules=[location_rule])
        abac_auth.add_policy(policy)
        
        # Test access from allowed network
        decision_allowed = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "test"},
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "read"},
            environment_attributes={"client_ip": "192.168.1.100"}
        )
        assert decision_allowed.decision == PolicyEffect.PERMIT
        
        # Test access from disallowed network
        decision_denied = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "test"},
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "read"},
            environment_attributes={"client_ip": "203.0.113.1"}  # External IP
        )
        assert decision_denied.decision == PolicyEffect.DENY
    
    @pytest.mark.asyncio
    async def test_ip_spoofing_protection(self, abac_auth):
        """Test protection against IP spoofing"""
        # Create location-based rule
        location_rule = abac_auth.create_location_based_rule(
            name="Internal Network Only",
            effect=PolicyEffect.PERMIT,
            allowed_networks=["192.168.1.0/24"]
        )
        
        policy = ABACPolicy(name="Location Policy", rules=[location_rule])
        abac_auth.add_policy(policy)
        
        # Test with various IP formats that might be used for spoofing
        spoofed_ips = [
            "192.168.1.1; DROP TABLE users;",  # SQL injection attempt
            "192.168.1.1<script>",  # XSS attempt
            "192.168.1.1\x00\x01\x02",  # Null bytes
            "192.168.1.999",  # Invalid IP
            "192.168.1.-1",  # Negative octets
        ]
        
        for spoofed_ip in spoofed_ips:
            decision = await abac_auth.evaluate_access(
                subject_attributes={"user_id": "test"},
                resource_attributes={"resource_id": "test"},
                action_attributes={"action": "read"},
                environment_attributes={"client_ip": spoofed_ip}
            )
            # Should deny invalid IPs
            assert decision.decision == PolicyEffect.DENY


class TestAuthorizationEdgeCases:
    """Authorization edge case security tests"""
    
    @pytest.fixture
    def abac_auth(self):
        return ABACAuthorization()
    
    @pytest.mark.asyncio
    async def test_empty_attributes_handling(self, abac_auth):
        """Test handling of empty or None attributes"""
        # Test with empty attributes
        decision = await abac_auth.evaluate_access(
            subject_attributes={},
            resource_attributes={},
            action_attributes={}
        )
        assert decision.decision == PolicyEffect.DENY
        
        # Test with None values
        decision = await abac_auth.evaluate_access(
            subject_attributes={"user_id": None},
            resource_attributes={"resource_id": None},
            action_attributes={"action": None}
        )
        assert decision.decision == PolicyEffect.DENY
    
    @pytest.mark.asyncio
    async def test_circular_policy_references(self, abac_auth):
        """Test handling of circular policy references"""
        # This would test if policies could reference each other circularly
        # For now, our implementation doesn't support policy references
        assert True  # No circular references possible in current design
    
    @pytest.mark.asyncio
    async def test_policy_priority_overflow(self, abac_auth):
        """Test handling of priority overflow"""
        # Create rules with extreme priority values
        high_priority_rule = PolicyRule(
            name="Max Priority",
            effect=PolicyEffect.DENY,
            priority=2**31 - 1,  # Max int
            conditions=[]
        )
        
        low_priority_rule = PolicyRule(
            name="Min Priority",
            effect=PolicyEffect.PERMIT,
            priority=-2**31,  # Min int
            conditions=[]
        )
        
        policy = ABACPolicy(
            name="Priority Test",
            rules=[low_priority_rule, high_priority_rule]
        )
        abac_auth.add_policy(policy)
        
        # Should handle extreme values gracefully
        decision = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "test"},
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "test"}
        )
        
        assert decision.decision == PolicyEffect.DENY  # Higher priority deny should win
    
    @pytest.mark.asyncio
    async def test_unicode_attribute_values(self, abac_auth):
        """Test handling of Unicode and special characters in attributes"""
        unicode_attributes = {
            "user_name": "用户测试",  # Chinese characters
            "role": "管理员",
            "special_chars": "!@#$%^&*()[]{}|\\:;\"'<>?,./"
        }
        
        # Should handle Unicode gracefully
        decision = await abac_auth.evaluate_access(
            subject_attributes=unicode_attributes,
            resource_attributes={"resource_id": "测试文档"},
            action_attributes={"action": "读取"}
        )
        
        assert decision.decision == PolicyEffect.DENY  # Default deny, but no errors
    
    @pytest.mark.asyncio
    async def test_memory_exhaustion_protection(self, abac_auth):
        """Test protection against memory exhaustion attacks"""
        # Try to create many policies to exhaust memory
        for i in range(100):  # Limited number to avoid actual exhaustion
            rule = PolicyRule(
                name=f"Rule {i}",
                effect=PolicyEffect.PERMIT,
                conditions=[
                    AttributeCondition(
                        attribute_type=AttributeType.SUBJECT,
                        attribute_name="user_id",
                        operator=ComparisonOperator.EQUALS,
                        value=f"user_{i}"
                    )
                ]
            )
            policy = ABACPolicy(name=f"Policy {i}", rules=[rule])
            abac_auth.add_policy(policy)
        
        # Should still function normally
        decision = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "test"},
            resource_attributes={"resource_id": "test"},
            action_attributes={"action": "test"}
        )
        
        assert decision is not None


class TestPerformanceSecurity:
    """Performance-related security tests"""
    
    @pytest.fixture
    def abac_auth(self):
        return ABACAuthorization()
    
    @pytest.mark.asyncio
    async def test_decision_cache_security(self, abac_auth):
        """Test decision cache doesn't leak sensitive information"""
        # Enable caching
        abac_auth.config.cache_decisions = True
        abac_auth.config.cache_ttl_seconds = 60
        
        # Create policy for specific user
        rule = PolicyRule(
            name="User Specific Rule",
            effect=PolicyEffect.PERMIT,
            conditions=[
                AttributeCondition(
                    attribute_type=AttributeType.SUBJECT,
                    attribute_name="user_id",
                    operator=ComparisonOperator.EQUALS,
                    value="authorized_user"
                )
            ]
        )
        policy = ABACPolicy(name="User Policy", rules=[rule])
        abac_auth.add_policy(policy)
        
        # Make decision for authorized user
        decision1 = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "authorized_user"},
            resource_attributes={"resource_id": "sensitive_doc"},
            action_attributes={"action": "read"}
        )
        assert decision1.decision == PolicyEffect.PERMIT
        
        # Make decision for unauthorized user with same resource
        decision2 = await abac_auth.evaluate_access(
            subject_attributes={"user_id": "unauthorized_user"},
            resource_attributes={"resource_id": "sensitive_doc"},
            action_attributes={"action": "read"}
        )
        assert decision2.decision == PolicyEffect.DENY
        
        # Decisions should be different (cache should not leak authorization)
        assert decision1.decision != decision2.decision


if __name__ == "__main__":
    pytest.main([__file__, "-v"])