export class NovaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'NovaError';
  }
}

export class AuthenticationError extends NovaError {
  constructor(message = 'Not authenticated') {
    super(message, 'UNAUTHENTICATED');
  }
}

export class AuthorizationError extends NovaError {
  constructor(message = 'Not authorized') {
    super(message, 'FORBIDDEN');
  }
}

export class NotFoundError extends NovaError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND');
  }
}

export class RateLimitError extends NovaError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED');
  }
}

export class ValidationError extends NovaError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}
