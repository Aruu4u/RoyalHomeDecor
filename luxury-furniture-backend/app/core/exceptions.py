class ApplicationError(Exception):
    """Base exception for expected application errors."""


class ResourceNotFoundError(ApplicationError):
    """Raised when a requested database resource does not exist."""


class ResourceConflictError(ApplicationError):
    """Raised when a unique resource already exists."""
