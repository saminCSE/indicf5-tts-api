import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: unknown;
}

interface HandlerResult<T> {
  message?: string;
  result: T;
  meta?: unknown;
}

function isHandlerResult<T>(value: unknown): value is HandlerResult<T> {
  return typeof value === 'object' && value !== null && 'result' in value;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiEnvelope<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((payload: unknown) => {
        const statusCode = response.statusCode;

        if (isHandlerResult<T>(payload)) {
          const envelope: ApiEnvelope<T> = {
            success: true,
            statusCode,
            message: payload.message ?? 'Request successful',
            data: payload.result,
          };
          if (payload.meta !== undefined) {
            envelope.meta = payload.meta;
          }
          return envelope;
        }

        return {
          success: true,
          statusCode,
          message: 'Request successful',
          data: payload as T,
        };
      }),
    );
  }
}
