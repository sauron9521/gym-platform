import { SetMetadata } from '@nestjs/common';

export const ADMIN_COOKIE_ROUTE = 'gym:auth:admin-cookie-route';

/** Only annotated routes may authenticate through the privileged Admin cookie. */
export const AdminCookieRoute = () => SetMetadata(ADMIN_COOKIE_ROUTE, true);
