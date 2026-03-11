export class HeadyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'HeadyError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ServiceUnavailableError extends HeadyError {
  constructor(service: string, message?: string) {
    super(
      message || `Service ${service} is unavailable`,
      'SERVICE_UNAVAILABLE',
      503,
      { service }
    );
  }
}

export class ValidationError extends HeadyError {
  constructor(message: string, errors?: any[]) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
  }
}

export class AuthenticationError extends HeadyError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
  }
}
