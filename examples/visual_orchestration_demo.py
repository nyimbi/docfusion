#!/usr/bin/env python3
"""
Visual Agent Orchestration Demo

Demonstrates the visual agent workflow composition system with
drag-and-drop interface, prompt editing, and real-time execution.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025

Usage:
    python examples/visual_orchestration_demo.py
    
    Then open http://localhost:8000 in your browser
"""

import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from docfusion.orchestration import (
    VisualWorkflowEditor, 
    AgentComposer, 
    WorkflowBuilder,
    WorkflowEngine
)
from docfusion.orchestration.agent_composer import AgentConfiguration, AgentTemplate
from docfusion.orchestration.workflow_engine import WorkflowType


async def demo_visual_editor():
    """Demonstrate visual workflow editor capabilities"""
    
    print("🚀 Visual Agent Orchestration Demo")
    print("=" * 50)
    
    # Initialize visual editor
    editor = VisualWorkflowEditor()
    
    print("\n1. Initializing Visual Editor...")
    init_result = await editor.initialize_editor({
        "canvas_width": 1600,
        "canvas_height": 1200,
        "preferences": {
            "auto_save": True,
            "show_grid": True,
            "theme": "light"
        }
    })
    
    if init_result.get("success"):
        print(f"   ✅ Editor initialized: {init_result['editor_id']}")
    else:
        print(f"   ❌ Initialization failed: {init_result.get('error')}")
        return
    
    # Create workflow
    print("\n2. Creating New Workflow...")
    workflow_result = await editor.agent_composer.create_workflow(
        "Proposal Generation Workflow",
        WorkflowType.SEQUENTIAL
    )
    
    if workflow_result.get("success"):
        print(f"   ✅ Workflow created: {workflow_result['workflow_id']}")
    else:
        print(f"   ❌ Workflow creation failed: {workflow_result.get('error')}")
        return
    
    # Create and configure agents
    print("\n3. Creating and Configuring Agents...")
    
    agents = [
        {
            "name": "Research Specialist",
            "type": AgentTemplate.RESEARCH_AGENT,
            "prompt": "Research the given proposal topic thoroughly. Focus on: {topic}\nGather information about: {focus_areas}\nProvide comprehensive insights and supporting data.",
            "position": (100, 100)
        },
        {
            "name": "Content Creator",
            "type": AgentTemplate.CONTENT_AGENT, 
            "prompt": "Create compelling proposal content based on research findings.\nTopic: {topic}\nTarget audience: {audience}\nTone: {tone}\nLength: {word_count} words",
            "position": (400, 100)
        },
        {
            "name": "Quality Reviewer",
            "type": AgentTemplate.REVIEW_AGENT,
            "prompt": "Review the proposal content for:\n- Clarity and coherence\n- Persuasiveness\n- Technical accuracy\n- Grammar and style\nProvide specific feedback and improvement suggestions.",
            "position": (700, 100)
        },
        {
            "name": "Document Editor",
            "type": AgentTemplate.EDITOR_AGENT,
            "prompt": "Edit and finalize the proposal ensuring:\n- Consistent formatting\n- Professional presentation\n- Complete sections\n- Executive summary\n- Call to action",
            "position": (1000, 100)
        }
    ]
    
    agent_ids = []
    for agent_data in agents:
        # Create agent configuration
        agent_config = AgentConfiguration(
            name=agent_data["name"],
            agent_type=agent_data["type"],
            custom_prompt=agent_data["prompt"],
            temperature=0.7,
            max_tokens=3000,
            input_variables=["topic", "focus_areas", "audience", "tone", "word_count"]
        )
        
        # Create agent
        agent_result = await editor.agent_composer.create_agent(agent_config)
        
        if agent_result.get("success"):
            print(f"   ✅ Created agent: {agent_data['name']}")
            
            # Add to workflow canvas
            canvas_result = await editor.workflow_builder.add_agent_to_workflow(
                agent_config,
                agent_data["position"]
            )
            
            if canvas_result.get("success"):
                agent_ids.append(agent_config.agent_id)
                print(f"      Added to canvas at {agent_data['position']}")
            else:
                print(f"      ❌ Failed to add to canvas: {canvas_result.get('error')}")
        else:
            print(f"   ❌ Failed to create agent: {agent_result.get('error')}")
    
    # Create connections between agents
    print("\n4. Connecting Agents in Sequence...")
    
    for i in range(len(agent_ids) - 1):
        source_id = agent_ids[i]
        target_id = agent_ids[i + 1]
        
        connection_result = await editor.workflow_builder.connect_elements(
            source_id,
            target_id
        )
        
        if connection_result.get("success"):
            print(f"   ✅ Connected agents: {i+1} → {i+2}")
        else:
            print(f"   ❌ Connection failed: {connection_result.get('error')}")
    
    # Demonstrate prompt editing
    print("\n5. Demonstrating Prompt Editor...")
    
    if agent_ids:
        first_agent_id = agent_ids[0]
        
        # Open prompt editor
        prompt_result = await editor.open_prompt_editor(first_agent_id)
        
        if prompt_result.get("success"):
            session_id = prompt_result["session_id"]
            print(f"   ✅ Prompt editor opened for: {prompt_result['agent_name']}")
            print(f"      Session ID: {session_id}")
            
            # Update prompt
            new_prompt = """You are an expert research specialist for proposal development.

Your mission:
1. Conduct thorough research on the proposal topic: {topic}
2. Focus on these key areas: {focus_areas}
3. Identify market opportunities and competitive advantages
4. Gather supporting statistics and case studies
5. Analyze target audience needs and pain points

Provide comprehensive research findings that will form the foundation for a winning proposal.

Research depth: {depth_level}
Industry context: {industry}
Competitive landscape: {competitive_analysis}"""
            
            update_result = await editor.update_prompt(session_id, new_prompt)
            
            if update_result.get("success"):
                print(f"   ✅ Prompt updated successfully")
                print(f"      Variables found: {len(update_result['variables'])}")
                print(f"      Validation: {'✅ Valid' if update_result['validation']['valid'] else '❌ Invalid'}")
                
                # Save prompt
                save_result = await editor.save_prompt(session_id)
                if save_result.get("success"):
                    print(f"   ✅ Prompt saved successfully")
                else:
                    print(f"   ❌ Prompt save failed: {save_result.get('error')}")
            else:
                print(f"   ❌ Prompt update failed: {update_result.get('error')}")
        else:
            print(f"   ❌ Failed to open prompt editor: {prompt_result.get('error')}")
    
    # Auto-arrange workflow
    print("\n6. Auto-Arranging Workflow...")
    
    arrange_result = await editor.arrange_workflow("hierarchical")
    
    if arrange_result.get("success"):
        print(f"   ✅ Workflow arranged: {arrange_result['elements_arranged']} elements")
    else:
        print(f"   ❌ Arrangement failed: {arrange_result.get('error')}")
    
    # Get workflow templates
    print("\n7. Available Workflow Templates...")
    
    templates_result = await editor.agent_composer.get_workflow_templates()
    
    if templates_result.get("success"):
        print(f"   ✅ Found {templates_result['total']} templates:")
        for template in templates_result['templates']:
            print(f"      - {template['name']} ({template['category']}) - {template['node_count']} nodes")
    else:
        print(f"   ❌ Failed to get templates: {templates_result.get('error')}")
    
    # Export workflow
    print("\n8. Exporting Workflow...")
    
    export_result = await editor.workflow_builder.export_to_workflow()
    
    if export_result.get("success"):
        workflow = export_result["workflow"]
        print(f"   ✅ Workflow exported successfully")
        print(f"      Workflow ID: {workflow.workflow_id}")
        print(f"      Nodes: {len(workflow.nodes)}")
        print(f"      Edges: {len(workflow.edges)}")
        print(f"      Entry points: {len(workflow.entry_nodes)}")
        print(f"      Exit points: {len(workflow.exit_nodes)}")
    else:
        print(f"   ❌ Export failed: {export_result.get('error')}")
        return
    
    # Execute workflow
    print("\n9. Executing Workflow...")
    
    execution_context = {
        "topic": "AI-Powered Document Generation Platform",
        "focus_areas": "market analysis, technical feasibility, competitive advantages",
        "audience": "enterprise decision makers",
        "tone": "professional and persuasive",
        "word_count": 2000,
        "depth_level": "comprehensive",
        "industry": "technology",
        "competitive_analysis": "enabled"
    }
    
    execution_result = await editor.execute_workflow(execution_context)
    
    if execution_result.get("success"):
        print(f"   ✅ Workflow execution started")
        print(f"      Execution ID: {execution_result['execution_id']}")
        print(f"      Duration: {execution_result.get('duration', 0):.2f} seconds")
        print(f"      Status: {execution_result['status']}")
        
        # Show node results summary
        node_results = execution_result.get("node_results", {})
        successful_nodes = sum(1 for result in node_results.values() if result.get("success"))
        print(f"      Successful nodes: {successful_nodes}/{len(node_results)}")
        
        # Show sample results
        for node_id, result in list(node_results.items())[:2]:  # Show first 2
            if result.get("success"):
                print(f"      Node {node_id}: ✅ {result.get('execution_time', 0):.2f}s")
    else:
        print(f"   ❌ Execution failed: {execution_result.get('error')}")
    
    # Get editor state for UI rendering
    print("\n10. Final Editor State...")
    
    state_result = await editor.get_editor_state()
    
    if state_result.get("success"):
        print(f"   ✅ Editor state retrieved")
        print(f"      Current mode: {state_result['current_mode']}")
        print(f"      UI components: {sum(1 for v in state_result['ui_components'].values() if v)} visible")
        print(f"      Canvas elements: {len(state_result['canvas']['elements'])}")
        print(f"      Connections: {len(state_result['canvas']['connections'])}")
        print(f"      Selected elements: {len(state_result['selected_elements'])}")
        print(f"      Prompt sessions: {len(state_result['prompt_sessions'])}")
    else:
        print(f"   ❌ Failed to get editor state: {state_result.get('error')}")
    
    print("\n" + "=" * 50)
    print("🎉 Visual Orchestration Demo Complete!")
    print("\nKey Features Demonstrated:")
    print("✅ Visual workflow editor initialization")
    print("✅ Agent creation and configuration")
    print("✅ Drag-and-drop workflow building") 
    print("✅ Interactive prompt editing with validation")
    print("✅ Auto-arrangement algorithms")
    print("✅ Workflow templates and export")
    print("✅ Real-time workflow execution")
    print("✅ Comprehensive state management")
    
    return editor


async def demo_web_interface():
    """Demonstrate web interface"""
    print("\n🌐 Starting Web Interface Demo...")
    
    try:
        from docfusion.orchestration.web_interface import create_app
        import uvicorn
        
        app = create_app()
        
        print("🚀 Web interface starting at http://localhost:8000")
        print("   Features available:")
        print("   - Drag-and-drop workflow builder")
        print("   - Real-time prompt editing")
        print("   - Live collaboration")
        print("   - Workflow execution monitoring")
        print("   - Auto-arrangement tools")
        print("\nPress Ctrl+C to stop the server")
        
        # Run the web server
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
        
    except ImportError:
        print("❌ FastAPI not available. Install with: pip install fastapi uvicorn")
        print("   Skipping web interface demo")
    except KeyboardInterrupt:
        print("\n👋 Web server stopped")


async def main():
    """Main demo function"""
    print("Visual Agent Orchestration System")
    print("DocuFusion AI Agent Framework")
    print("=" * 50)
    
    try:
        # Run core demo
        editor = await demo_visual_editor()
        
        # Ask user if they want to see the web interface
        print("\n🌐 Would you like to start the web interface? (y/n): ", end="")
        response = input().strip().lower()
        
        if response in ['y', 'yes']:
            await demo_web_interface()
        else:
            print("👋 Demo completed. Thank you!")
            
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())