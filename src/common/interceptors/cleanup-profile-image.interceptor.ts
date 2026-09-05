import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { removeProfileImage } from '../utils/multer-options.utils';

/**
 * Deletes a Multer-uploaded profile image if the request fails
 * after the file was written to disk (validation, DB, etc.).
 */
@Injectable()
export class CleanupProfileImageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      file?: Express.Multer.File;
    }>();

    return next.handle().pipe(
      catchError((error) => {
        void removeProfileImage(request.file);
        return throwError(() => error);
      }),
    );
  }
}
