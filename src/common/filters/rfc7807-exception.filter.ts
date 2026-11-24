import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { logger } from '../../infrastructure/logger/pino.logger';

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  request_id?: string;
  invalid_params?: Array<{ name: string; reason: string }>;
  [key: string]: any;
}

@Catch()
export class Rfc7807ExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || (request as any).id;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Terjadi kesalahan internal';
    let detail = 'Terjadi kesalahan yang tidak terduga pada server.';
    let code = 'INTERNAL_SERVER_ERROR';
    let invalidParams: Array<{ name: string; reason: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        detail = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        title = obj.error || exception.name;
        detail = obj.message || exception.message;
        code = obj.code || this.mapStatusToCode(status);

        if (Array.isArray(obj.message)) {
          // ValidationPipe errors
          detail = 'Satu atau lebih parameter permintaan tidak valid.';
          code = 'VALIDATION_FAILED';
          invalidParams = obj.message.map((msg: string) => {
            const parts = msg.split(' ');
            return {
              name: parts[0] || 'parameter',
              reason: msg,
            };
          });
        }
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
      logger.error({ err: exception, requestId }, 'Unhandled exception');
    }

    const problem: ProblemDetails = {
      type: `https://errors.depofarmasi.local/${code.toLowerCase()}`,
      title,
      status,
      detail,
      instance: request.url,
      code,
      request_id: requestId,
      invalid_params: invalidParams,
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problem);
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'HTTP_ERROR';
    }
  }
}

