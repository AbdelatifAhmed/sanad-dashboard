import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Automatically attaches the JWT Bearer token to every outgoing HTTP request.
 * On 401 responses, attempts a silent token refresh once before giving up.
 *
 * Registered via provideHttpClient(withInterceptors([authInterceptor])) in app.config.ts.
 * Services no longer need to call getHeaders() manually.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Skip attaching the header for auth endpoints themselves
  const isAuthEndpoint = req.url.includes('/auth/login') ||
                         req.url.includes('/auth/refresh-token');

  const authReq = token && !isAuthEndpoint
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Attempt silent refresh only for 401s on non-auth endpoints
      if (error.status === 401 && !isAuthEndpoint) {
        return authService.refreshToken().pipe(
          switchMap((newToken) => {
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => throwError(() => refreshError)),
        );
      }
      return throwError(() => error);
    }),
  );
};
