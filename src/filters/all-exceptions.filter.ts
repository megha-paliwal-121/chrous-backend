import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name); // Initialize logger

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    // Log the error for debugging purposes
    // this.logError(exception, request);

    // Format and send the response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: message,
    });
  }

  private logError(exception: any, request: any) {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const logMessage = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      exception: {
        message: exception.message || 'Internal server error',
        stack: exception.stack || null, // Don't include the stack for HttpExceptions
      },
    };

    // Log errors based on the status
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Internal Server Error: ${JSON.stringify(logMessage)}`);
    } else {
      this.logger.warn(`Exception: ${JSON.stringify(logMessage)}`);
    }
  }
}
