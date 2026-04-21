import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 统一 HTTP 错误体，便于前端 `apiRequest` 解析 `message` / `statusCode`。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const resBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const payload =
      typeof resBody === 'string'
        ? {
            statusCode: status,
            message: resBody,
            path: request.url,
          }
        : {
            ...resBody,
            statusCode: status,
            path: request.url,
          };

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json(payload);
  }
}
