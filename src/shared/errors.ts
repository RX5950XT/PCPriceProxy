export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number = 500,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ScraperError extends AppError {
  constructor(source: string, message: string, context?: Record<string, unknown>) {
    super(`[${source}] ${message}`, 'SCRAPER_ERROR', 502, { source, ...context });
    this.name = 'ScraperError';
  }
}

export class ParserError extends AppError {
  constructor(source: string, message: string, context?: Record<string, unknown>) {
    super(`[${source}] Parse error: ${message}`, 'PARSER_ERROR', 500, { source, ...context });
    this.name = 'ParserError';
  }
}

export class ApiError extends AppError {
  constructor(message: string, statusCode: number = 400, context?: Record<string, unknown>) {
    super(message, 'API_ERROR', statusCode, context);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429, { retryAfterSeconds });
    this.name = 'RateLimitError';
  }
}
