import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const middleware = createMiddleware(routing);
export default function proxy(request: NextRequest) {
  if (process.env.LANDING_ENABLE_I18N_ROUTES !== 'true') return NextResponse.next();
  return middleware(request);
}
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
