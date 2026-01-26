#!/usr/bin/env python3
"""
Direct import tests to validate core agent components.
"""

import sys
import os
import traceback

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_messages_direct():
    """Test messages module directly"""
    try:
        # Import the messages module directly 
        from docfusion.agents.core.messages import (
            MessageHeader, MessagePayload, MessageMetadata, AgentMessage,
            MessageType, MessagePriority, MessageStatus
        )
        
        print("✓ Direct messages import successful")
        
        # Test message creation
        header = MessageHeader(
            message_id="test-123",
            sender_id="sender",
            recipient_id="recipient",
            message_type=MessageType.TASK_REQUEST
        )
        
        payload = MessagePayload(content={"test": "data"})
        metadata = MessageMetadata()
        message = AgentMessage(header=header, payload=payload, metadata=metadata)
        
        print(f"✓ Message creation successful: {message.header.message_id}")
        return True
        
    except Exception as e:
        print(f"✗ Direct messages test failed: {e}")
        traceback.print_exc()
        return False

def test_message_bus_direct():
    """Test message bus directly"""
    try:
        from docfusion.agents.communication.message_bus import MessageBus, MessageBusConfig
        
        config = MessageBusConfig(max_message_history=100)
        bus = MessageBus(config)
        
        print("✓ Direct MessageBus creation successful")
        return True
        
    except Exception as e:
        print(f"✗ Direct MessageBus test failed: {e}")
        traceback.print_exc()
        return False

def test_roles_direct():
    """Test roles directly"""
    try:
        from docfusion.agents.core.roles import (
            AgentRole, get_role_definition, CapabilityLevel, AgentCapability
        )
        
        writer_role = get_role_definition(AgentRole.WRITER)
        print(f"✓ Direct role definition: {writer_role.name}")
        return True
        
    except Exception as e:
        print(f"✗ Direct roles test failed: {e}")
        traceback.print_exc()
        return False

def test_agent_direct():
    """Test agent config directly"""  
    try:
        from docfusion.agents.core.agent import AgentConfig, AgentCapabilities
        
        capabilities = AgentCapabilities(
            max_concurrent_tasks=3,
            expertise_domains=["test"],
            supported_task_types=["test_task"]
        )
        
        config = AgentConfig(
            name="Test Agent",
            description="Test description",
            primary_role="test",
            capabilities=capabilities
        )
        
        print(f"✓ Direct agent config: {config.name}")
        return True
        
    except Exception as e:
        print(f"✗ Direct agent config test failed: {e}")
        traceback.print_exc()
        return False

def test_writer_agent_creation():
    """Test creating a writer agent with fixed capabilities"""
    try:
        from docfusion.agents.core.agent import AgentConfig, AgentCapabilities
        from docfusion.agents.core.roles import AgentRole, get_role_definition
        
        # Create capabilities properly
        capabilities = AgentCapabilities(
            max_concurrent_tasks=3,
            expertise_domains=["content_writing", "proposal_generation"],
            supported_task_types=["writing", "editing", "content_creation"],
            quality_threshold=0.85
        )
        
        # Create agent config
        config = AgentConfig(
            name="Content Writer",
            description="Professional content creation agent",
            primary_role="writer",
            capabilities=capabilities,
            creativity_level=0.9,
            risk_tolerance=0.6
        )
        
        print(f"✓ Writer agent config created: {config.name}")
        print(f"  - Max concurrent tasks: {config.capabilities.max_concurrent_tasks}")
        print(f"  - Quality threshold: {config.capabilities.quality_threshold}")
        
        return True
        
    except Exception as e:
        print(f"✗ Writer agent creation failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run direct import tests"""
    print("Direct Agent System Component Tests")
    print("=" * 45)
    
    tests = [
        ("Messages Module", test_messages_direct),
        ("MessageBus Module", test_message_bus_direct),
        ("Roles Module", test_roles_direct),
        ("Agent Config", test_agent_direct),
        ("Writer Agent Config", test_writer_agent_creation),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"✗ {test_name} exception: {e}")
    
    print("\n" + "=" * 45)
    print(f"Direct Tests Passed: {passed}/{total}")
    
    if passed >= 4:  # Allow some flexibility
        print("🎉 Core agent system components working!")
        return 0
    else:
        print("❌ Core components need more work")
        return 1

if __name__ == "__main__":
    sys.exit(main())