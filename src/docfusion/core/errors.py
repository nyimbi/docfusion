"""DocuFusion canonical exception types."""


class DocuFusionError(Exception):
	"""Base class for all DocuFusion-specific exceptions."""


class PendingImplementationError(DocuFusionError):
	"""Raised by deliberately unimplemented stubs that have an open ticket.

	This is the sanctioned replacement for `NotImplementedError`. The message
	MUST reference the tracking task ID so maintainers can find the owner.

	Example:
		raise PendingImplementationError("See task-042: agent memory ttl cleanup")
	"""

	def __init__(self, message: str) -> None:
		if "task-" not in message.lower():
			raise ValueError(
				"PendingImplementationError message must reference a task ID, "
				f"got: {message!r}"
			)
		super().__init__(message)
