import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed',
  401: 'Missing or invalid API key',
  404: 'Not found',
  409: 'Conflict — resource already exists',
  413: 'Input too large',
  429: 'Rate limit exceeded',
  503: 'Service saturated, retry later',
};

interface ApiDocOptions {
  summary: string;
  auth?: boolean;
  errors?: number[];
}

export function ApiDoc(options: ApiDocOptions) {
  return applyDecorators(
    ApiOperation({ summary: options.summary }),
    ...(options.auth ? [ApiSecurity('api-key')] : []),
    ...(options.errors ?? []).map((status) =>
      ApiResponse({ status, description: ERROR_DESCRIPTIONS[status] }),
    ),
  );
}
