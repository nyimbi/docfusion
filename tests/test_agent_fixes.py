#!/usr/bin/env python3
"""
Test script to validate agent system fixes in isolation.
"""

import sys
import traceback

def test_message_system():
    """Test the core message system"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
        
        from docfusion.agents.core.messages import (
            AgentMessage, MessageHeader, MessagePayload, MessageMetadata,
            MessageType, MessagePriority, MessageStatus
        )
        print("✓ Message system imports successful")
        
        # Test message creation
        header = MessageHeader(
            message_id="test-123",
            sender_id="agent-1", 
            recipient_id="agent-2",
            message_type=MessageType.TASK_REQUEST
        )
        payload = MessagePayload(content={"task": "test"})
        metadata = MessageMetadata()
        
        message = AgentMessage(header=header, payload=payload, metadata=metadata)
        print("✓ Message creation successful")
        return True
        
    except Exception as e:
        print(f"✗ Message system test failed: {e}")
        traceback.print_exc()
        return False

def test_message_bus():
    """Test the message bus in isolation"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
        
        from docfusion.agents.communication.message_bus import MessageBus, MessageBusConfig
        
        # Test instantiation
        config = MessageBusConfig(max_message_history=100)
        bus = MessageBus(config)
        print("✓ MessageBus instantiation successful")
        return True
        
    except Exception as e:
        print(f"✗ MessageBus test failed: {e}")
        traceback.print_exc()
        return False

def test_core_roles():
    """Test the roles system"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
        
        from docfusion.agents.core.roles import (
            AgentRole, AgentCapability, CapabilityLevel,
            get_role_definition
        )
        
        # Test role definition retrieval
        writer_role = get_role_definition(AgentRole.WRITER)
        print(f"✓ Role definition successful: {writer_role.name}")
        return True
        
    except Exception as e:
        print(f"✗ Roles test failed: {e}")
        traceback.print_exc()
        return False

def test_agent_config():
    """Test agent configuration with capabilities"""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
        
        from docfusion.agents.core.agent import AgentConfig, AgentCapabilities
        
        # Test AgentCapabilities creation
        capabilities = AgentCapabilities(
            max_concurrent_tasks=3,
            expertise_domains=["test"],
            supported_task_types=["test_task"],
            quality_threshold=0.8
        )
        
        # Test AgentConfig creation
        config = AgentConfig(
            name="Test Agent",
            description="Test agent for validation",
            primary_role="test",
            capabilities=capabilities
        )
        
        print("✓ Agent config and capabilities creation successful")
        return True
        
    except Exception as e:
        print(f"✗ Agent config test failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("Testing Agent System Fixes")
    print("=" * 40)
    
    tests = [
        ("Message System", test_message_system),
        ("Message Bus", test_message_bus), 
        ("Core Roles", test_core_roles),
        ("Agent Config", test_agent_config),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        if test_func():
            passed += 1
    
    print("\n" + "=" * 40)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All core agent system tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())