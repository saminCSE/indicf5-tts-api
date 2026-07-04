import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed',
  401: 'Missing or invalid API key',
  404: 'Not found',
  409: 'Conflict',
  413: 'Input too large',
  422: 'Semantically invalid input',
  429: 'Rate limit exceeded',
  503: 'Service saturated, retry later',
};

const ERROR_EXAMPLES: Record<number, { message: string; error: string }> = {
  400: { message: 'text must be shorter than or equal to 1000 characters', error: 'Bad Request' },
  401: { message: 'Missing x-api-key header', error: 'Unauthorized' },
  404: { message: 'Job not found', error: 'Not Found' },
  409: { message: "Audio not ready — job status is 'processing'", error: 'Conflict' },
  422: { message: 'Text must contain Bengali characters', error: 'Unprocessable Entity' },
  429: { message: 'Rate limit exceeded, slow down', error: 'Too Many Requests' },
  503: { message: 'Queue is full, please retry shortly', error: 'Service Unavailable' },
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
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status],
        schema: {
          example: {
            success: false,
            statusCode: status,
            ...ERROR_EXAMPLES[status],
          },
        },
      }),
    ),
  );
}
