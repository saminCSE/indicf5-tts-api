import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MongoServerError } from 'mongodb';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else {
        const record = body as Record<string, unknown>;
        const rawMessage: unknown = Array.isArray(record.message)
          ? record.message[0]
          : record.message;
        message =
          typeof rawMessage === 'string' ? rawMessage : exception.message;
        error =
          typeof record.error === 'string' ? record.error : exception.name;
      }
    } else if (exception instanceof MongoServerError) {
      if (exception.code === 11000) {
        statusCode = HttpStatus.CONFLICT;
        message = 'Duplicate value for a unique field';
        error = 'Conflict';
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(String(exception));
    }

    if (statusCode === HttpStatus.SERVICE_UNAVAILABLE) {
      response.setHeader('Retry-After', '30');
    }

    response
      .status(statusCode)
      .json({ success: false, statusCode, message, error });
  }
}
