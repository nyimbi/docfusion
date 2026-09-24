"""Test configuration and fixtures."""
import sys
import types
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SRC_ROOT = PROJECT_ROOT / "src"
DOCFUSION_ROOT = SRC_ROOT / "docfusion"

sys.path.insert(0, str(SRC_ROOT))

# Legacy integration tests still import the pre-rename package path
# ``src.proposal_writer``. Keep that alias in test collection only.
src_package = sys.modules.setdefault("src", types.ModuleType("src"))
src_package.__path__ = [str(SRC_ROOT)]

proposal_writer = sys.modules.setdefault(
	"src.proposal_writer",
	types.ModuleType("src.proposal_writer"),
)
proposal_writer.__path__ = [str(DOCFUSION_ROOT)]

agent_system_module = types.ModuleType("src.proposal_writer.agents.agent_system")


class AgentSystem:
	"""Compatibility spec for legacy tests that mock the old agent system."""


agent_system_module.AgentSystem = AgentSystem
sys.modules.setdefault("src.proposal_writer.agents.agent_system", agent_system_module)

email_validator_module = types.ModuleType("email_validator")


class EmailNotValidError(ValueError):
	"""Compatibility error used by Pydantic's EmailStr integration."""


class _EmailParts:
	def __init__(self, email: str) -> None:
		self.normalized = email
		self.local_part = email.split("@", 1)[0]


def validate_email(email: str, check_deliverability: bool = False) -> _EmailParts:
	del check_deliverability
	if "@" not in email:
		raise EmailNotValidError("email must contain @")
	return _EmailParts(email.strip())


email_validator_module.EmailNotValidError = EmailNotValidError
email_validator_module.validate_email = validate_email
sys.modules.setdefault("email_validator", email_validator_module)

try:
	import pydantic.networks as _pydantic_networks

	_real_distribution_version = _pydantic_networks.version

	def _test_distribution_version(distribution_name: str) -> str:
		if distribution_name == "email-validator":
			return "2.0.0"
		return _real_distribution_version(distribution_name)

	_pydantic_networks.version = _test_distribution_version
except Exception:
	pass
