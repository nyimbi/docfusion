"""
Agent Composition Language Parser

Parses YAML-based composition files into executable workflow structures.
Handles syntax validation, operator parsing, and workflow graph construction.

Author: Nyimbi Odero
Company: Datacraft Ltd
Copyright (c) 2025
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .language import CompositionLanguage
from ...core.utils import uuid7str

class OperatorType(Enum):
    """Operator types for composition language"""

    SEQUENCE = "sequence"
    PARALLEL = "parallel"
    BRANCH = "branch"
    PIPELINE = "pipeline"
    JOIN = "join"
    CONDITIONAL = "conditional"
    LOOP = "loop"
    ERROR_HANDLER = "error_handler"
    ASYNC = "async"
    FALLBACK = "fallback"

@dataclass
class ParsedExpression:
    """Represents a parsed flow expression"""

    operator: OperatorType
    left_operand: str
    right_operand: Optional[str] = None
    condition: Optional[str] = None
    condition_value: Optional[Any] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    raw_expression: str = ""

@dataclass
class ParsedFlow:
    """Represents a parsed workflow flow"""

    flow_id: str
    expressions: List[ParsedExpression]
    entry_points: List[str]
    exit_points: List[str]
    dependencies: Dict[str, List[str]]
    raw_definition: str

@dataclass
class ParsedComposition:
    """Complete parsed composition structure"""

    composition_id: str
    name: str
    version: str
    description: str
    config: Dict[str, Any]
    context: Dict[str, Any]
    agents: Dict[str, Dict[str, Any]]
    flows: Dict[str, ParsedFlow]
    transformations: Dict[str, Any]
    validation_rules: Dict[str, Any]
    error_handling: Dict[str, Any]
    monitoring: Dict[str, Any]
    metadata: Dict[str, Any]

class CompositionParseError(Exception):
    """Exception raised during composition parsing"""

    def __init__(
        self,
        message: str,
        line_number: Optional[int] = None,
        context: Optional[str] = None,
    ):
        self.message = message
        self.line_number = line_number
        self.context = context
        super().__init__(self._format_message())

    def _format_message(self) -> str:
        """Format error message with context"""
        msg = f"Composition parse error: {self.message}"
        if self.line_number:
            msg += f" at line {self.line_number}"
        if self.context:
            msg += f" in context: {self.context}"
        return msg

class CompositionParser:
    """
    Parser for Agent Composition Language (ACL)

    Converts YAML composition files into structured, executable workflow definitions.
    Handles operator parsing, validation, and dependency resolution.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.operators = CompositionLanguage.OPERATORS
        self.conditions = CompositionLanguage.CONDITIONS
        self.functions = CompositionLanguage.FUNCTIONS

        # Compile regex patterns for operator parsing
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for efficient parsing"""
        # Operator patterns
        self.operator_patterns = {}

        # Sequence: agent1 -> agent2
        self.operator_patterns["sequence"] = re.compile(r"(\w+)\s*->\s*(\w+)")

        # Parallel: agent1 || agent2
        self.operator_patterns["parallel"] = re.compile(r"(\w+)\s*\|\|\s*(\w+)")

        # Branch: agent1 < (agent2, agent3, condition)
        self.operator_patterns["branch"] = re.compile(
            r"(\w+)\s*<\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)"
        )

        # Pipeline: agent1 >> agent2
        self.operator_patterns["pipeline"] = re.compile(r"(\w+)\s*>>\s*(\w+)")

        # Join: agent1 & agent2
        self.operator_patterns["join"] = re.compile(r"(\w+)\s*&\s*(\w+)")

        # Conditional: agent1 ? condition
        self.operator_patterns["conditional"] = re.compile(r"(\w+)\s*\?\s*(\w+)")

        # Loop: agent1 * count/condition
        self.operator_patterns["loop"] = re.compile(r"(\w+)\s*\*\s*(\w+|\d+)")

        # Error handler: agent1 ! error_agent
        self.operator_patterns["error_handler"] = re.compile(r"(\w+)\s*!\s*(\w+)")

        # Async: ~agent1
        self.operator_patterns["async"] = re.compile(r"~(\w+)")

        # Fallback: agent1 | agent2
        self.operator_patterns["fallback"] = re.compile(r"(\w+)\s*\|\s*(\w+)")

        # Complex expressions with parentheses
        self.parentheses_pattern = re.compile(r"\(([^)]+)\)")

        # Variable substitution pattern
        self.variable_pattern = re.compile(r"\$\{([^}]+)\}")

    async def parse_composition(self, composition_yaml: str) -> ParsedComposition:
        """Parse complete composition from YAML string"""
        try:
            # Parse YAML
            composition_data = yaml.safe_load(composition_yaml)

            # Validate structure
            await self._validate_structure(composition_data)

            # Extract main sections
            composition_info = composition_data.get("composition", {})
            agents = composition_data.get("agents", {})
            flow_data = composition_data.get("flow", {})

            # Generate composition ID
            composition_id = uuid7str()

            # Parse flows
            flows = {}
            for flow_id, flow_definition in flow_data.items():
                # Check if this is a flow definition or a function definition
                if "sequence" in flow_definition:
                    # This is a proper flow definition
                    parsed_flow = await self._parse_flow(
                        flow_id, flow_definition, agents
                    )
                    flows[flow_id] = parsed_flow
                elif "function" in flow_definition:
                    # This is a function definition - skip for now
                    # These will be handled in the transformations section
                    continue
                else:
                    # Try to parse as flow anyway
                    try:
                        parsed_flow = await self._parse_flow(
                            flow_id, flow_definition, agents
                        )
                        flows[flow_id] = parsed_flow
                    except CompositionParseError:
                        # Skip if it's not a valid flow
                        continue

            # Create parsed composition
            parsed_composition = ParsedComposition(
                composition_id=composition_id,
                name=composition_info.get("name", "Untitled Composition"),
                version=composition_info.get("version", "1.0"),
                description=composition_info.get("description", ""),
                config=composition_data.get("config", {}),
                context=composition_data.get("context", {}),
                agents=agents,
                flows=flows,
                transformations=composition_data.get("transformations", {}),
                validation_rules=composition_data.get("validation", {}),
                error_handling=composition_data.get("error_handling", {}),
                monitoring=composition_data.get("monitoring", {}),
                metadata={
                    "parsed_at": str(__import__("datetime").datetime.now()),
                    "parser_version": CompositionLanguage.VERSION,
                    "total_agents": len(agents),
                    "total_flows": len(flows),
                },
            )

            # Validate dependencies
            await self._validate_dependencies(parsed_composition)

            self.logger.info(
                f"Successfully parsed composition: {parsed_composition.name}"
            )
            return parsed_composition

        except yaml.YAMLError as e:
            raise CompositionParseError(f"Invalid YAML syntax: {str(e)}") from e
        except Exception as e:
            raise CompositionParseError(f"Parsing failed: {str(e)}") from e

    async def _validate_structure(self, composition_data: Dict[str, Any]):
        """Validate basic composition structure"""
        required_sections = ["composition", "agents", "flow"]

        for section in required_sections:
            if section not in composition_data:
                raise CompositionParseError(f"Missing required section: {section}")

        # Validate composition section
        composition_info = composition_data["composition"]
        if not isinstance(composition_info, dict):
            raise CompositionParseError("Composition section must be a dictionary")

        # Validate agents section
        agents = composition_data["agents"]
        if not isinstance(agents, dict):
            raise CompositionParseError("Agents section must be a dictionary")

        if not agents:
            raise CompositionParseError("At least one agent must be defined")

        # Validate flow section
        flow = composition_data["flow"]
        if not isinstance(flow, dict):
            raise CompositionParseError("Flow section must be a dictionary")

        if not flow:
            raise CompositionParseError("At least one flow must be defined")

    async def _parse_flow(
        self, flow_id: str, flow_definition: Dict[str, Any], agents: Dict[str, Any]
    ) -> ParsedFlow:
        """Parse individual flow definition"""
        try:
            expressions = []
            entry_points = []
            exit_points = []
            dependencies = {}

            # Get sequence definition
            sequence = flow_definition.get("sequence", "")
            if not sequence:
                raise CompositionParseError(
                    f"Flow {flow_id} missing sequence definition"
                )

            # Parse the sequence into expressions
            parsed_expressions = await self._parse_sequence(sequence, agents)

            # Analyze expressions for flow structure
            for expr in parsed_expressions:
                expressions.append(expr)

                # Track dependencies
                if expr.left_operand not in dependencies:
                    dependencies[expr.left_operand] = []

                if expr.right_operand and expr.right_operand not in dependencies:
                    dependencies[expr.right_operand] = []

                # Build dependency relationships
                if expr.operator in [OperatorType.SEQUENCE, OperatorType.PIPELINE]:
                    if expr.right_operand:
                        dependencies[expr.right_operand].append(expr.left_operand)
                elif expr.operator == OperatorType.PARALLEL:
                    # Parallel operations don't create dependencies between operands
                    pass
                elif expr.operator == OperatorType.BRANCH:
                    if expr.right_operand:
                        dependencies[expr.right_operand].append(expr.left_operand)

            # Determine entry and exit points
            all_agents = set()
            dependent_agents = set()

            for expr in expressions:
                if expr.left_operand:
                    all_agents.add(expr.left_operand)
                if expr.right_operand:
                    all_agents.add(expr.right_operand)
                    dependent_agents.add(expr.right_operand)

            # Entry points are agents with no dependencies
            entry_points = list(all_agents - dependent_agents)

            # Exit points are agents that don't appear as left operands
            left_operands = {
                expr.left_operand for expr in expressions if expr.left_operand
            }
            exit_points = list(all_agents - left_operands)

            return ParsedFlow(
                flow_id=flow_id,
                expressions=expressions,
                entry_points=entry_points,
                exit_points=exit_points,
                dependencies=dependencies,
                raw_definition=str(flow_definition),
            )

        except Exception as e:
            raise CompositionParseError(f"Failed to parse flow {flow_id}: {str(e)}") from e

    async def _parse_sequence(
        self, sequence: str, agents: Dict[str, Any]
    ) -> List[ParsedExpression]:
        """Parse sequence string into expressions"""
        expressions = []

        # Clean and normalize sequence
        sequence = sequence.strip()

        # Handle multi-line sequences
        if "|" in sequence and sequence.startswith("|"):
            # Multi-line sequence format
            lines = [line.strip() for line in sequence.split("\n") if line.strip()]
            sequence = " ".join(lines[1:])  # Skip the first '|'

        # Split into individual expressions
        # This is a simplified parser - a full parser would use a proper grammar
        expressions_text = self._split_expressions(sequence)

        for expr_text in expressions_text:
            parsed_expr = await self._parse_expression(expr_text.strip(), agents)
            if parsed_expr:
                expressions.append(parsed_expr)

        return expressions

    def _split_expressions(self, sequence: str) -> List[str]:
        """Split sequence into individual expressions"""
        # For now, use a simple approach for basic binary operators
        # This handles the most common cases like "agent1 -> agent2"

        # First, handle the simple case of a single binary expression
        for operator in ["->", "||", ">>", "<<", "&", "?", "*", "!", "~", "|"]:
            if operator in sequence and sequence.count(operator) == 1:
                # Simple binary expression
                return [sequence.strip()]

        # For more complex expressions, split by spaces and try to group
        # This is a simplified approach - a full parser would use proper grammar
        tokens = sequence.split()
        expressions = []
        current_expr = ""

        i = 0
        while i < len(tokens):
            token = tokens[i]

            if current_expr:
                current_expr += " " + token
            else:
                current_expr = token

            # Check if we have a complete expression
            # Look for operator patterns
            if any(
                op in current_expr for op in ["->", "||", ">>", "&", "?", "*", "!", "~"]
            ):
                # Check if this looks like a complete binary expression
                parts = current_expr.split()
                if len(parts) >= 3:  # agent1 -> agent2
                    expressions.append(current_expr.strip())
                    current_expr = ""

            i += 1

        # Add any remaining expression
        if current_expr.strip():
            expressions.append(current_expr.strip())

        # If no expressions were found, return the original sequence as a single expression
        if not expressions:
            expressions = [sequence.strip()]

        return expressions

    async def _parse_expression(
        self, expr_text: str, agents: Dict[str, Any]
    ) -> Optional[ParsedExpression]:
        """Parse individual expression"""
        expr_text = expr_text.strip()

        if not expr_text:
            return None

        # Try to match against operator patterns
        for operator_name, pattern in self.operator_patterns.items():
            match = pattern.search(expr_text)

            if match:
                # Convert operator name to enum
                operator_type = OperatorType(
                    self.operators.get(
                        self._get_operator_symbol(operator_name), operator_name
                    )
                )

                # Extract operands based on operator type
                if operator_type == OperatorType.BRANCH:
                    # Special handling for branch operator
                    left_operand = match.group(1)
                    right_operand = match.group(2)
                    condition = match.group(4)

                    return ParsedExpression(
                        operator=operator_type,
                        left_operand=left_operand,
                        right_operand=right_operand,
                        condition=condition,
                        raw_expression=expr_text,
                    )

                elif operator_type == OperatorType.ASYNC:
                    # Async operator has only one operand
                    return ParsedExpression(
                        operator=operator_type,
                        left_operand=match.group(1),
                        raw_expression=expr_text,
                    )

                elif operator_type in [OperatorType.CONDITIONAL, OperatorType.LOOP]:
                    # Conditional and loop operators
                    return ParsedExpression(
                        operator=operator_type,
                        left_operand=match.group(1),
                        condition=match.group(2),
                        raw_expression=expr_text,
                    )

                else:
                    # Binary operators
                    return ParsedExpression(
                        operator=operator_type,
                        left_operand=match.group(1),
                        right_operand=match.group(2)
                        if len(match.groups()) > 1
                        else None,
                        raw_expression=expr_text,
                    )

        # If no pattern matched, treat as simple agent or function reference
        if expr_text in agents:
            return ParsedExpression(
                operator=OperatorType.SEQUENCE,
                left_operand=expr_text,
                raw_expression=expr_text,
            )

        # Check if it's a valid identifier (could be a transformation)
        if expr_text.isidentifier():
            return ParsedExpression(
                operator=OperatorType.SEQUENCE,
                left_operand=expr_text,
                raw_expression=expr_text,
            )

        raise CompositionParseError(f"Unable to parse expression: {expr_text}")

    def _get_operator_symbol(self, operator_name: str) -> str:
        """Get operator symbol from name"""
        symbol_map = {
            "sequence": "->",
            "parallel": "||",
            "branch": "<",
            "pipeline": ">>",
            "join": "&",
            "conditional": "?",
            "loop": "*",
            "error_handler": "!",
            "async": "~",
            "fallback": "|",
        }
        return symbol_map.get(operator_name, operator_name)

    async def _validate_dependencies(self, composition: ParsedComposition):
        """Validate agent dependencies and references"""
        defined_agents = set(composition.agents.keys())

        for flow_id, flow in composition.flows.items():
            for expr in flow.expressions:
                # Check if referenced agents exist
                if expr.left_operand and expr.left_operand not in defined_agents:
                    # Check if it's a function or transformation
                    if expr.left_operand not in composition.transformations:
                        raise CompositionParseError(
                            f"Flow {flow_id} references undefined agent: {expr.left_operand}"
                        )

                if expr.right_operand and expr.right_operand not in defined_agents:
                    if expr.right_operand not in composition.transformations:
                        raise CompositionParseError(
                            f"Flow {flow_id} references undefined agent: {expr.right_operand}"
                        )

    async def parse_flow_syntax(self, flow_syntax: str) -> List[ParsedExpression]:
        """Parse flow syntax without full composition context"""
        try:
            expressions = await self._parse_sequence(flow_syntax, {})
            return expressions
        except Exception as e:
            raise CompositionParseError(f"Failed to parse flow syntax: {str(e)}") from e

    async def validate_expression(
        self, expression: str, agents: List[str]
    ) -> Dict[str, Any]:
        """Validate individual expression syntax"""
        try:
            # Create mock agents dict
            mock_agents = {agent: {} for agent in agents}

            # Parse expression
            parsed_expr = await self._parse_expression(expression, mock_agents)

            if parsed_expr:
                return {
                    "valid": True,
                    "operator": parsed_expr.operator.value,
                    "left_operand": parsed_expr.left_operand,
                    "right_operand": parsed_expr.right_operand,
                    "condition": parsed_expr.condition,
                    "issues": [],
                }
            else:
                return {"valid": False, "issues": ["Unable to parse expression"]}

        except CompositionParseError as e:
            return {"valid": False, "issues": [e.message]}
        except Exception as e:
            return {"valid": False, "issues": [f"Validation error: {str(e)}"]}

    def get_supported_operators(self) -> Dict[str, Dict[str, Any]]:
        """Get information about supported operators"""
        return CompositionLanguage.get_syntax_reference()["operators"]

    def get_builtin_conditions(self) -> Dict[str, str]:
        """Get built-in condition definitions"""
        return self.conditions.copy()

    def get_builtin_functions(self) -> Dict[str, str]:
        """Get built-in function definitions"""
        return self.functions.copy()
