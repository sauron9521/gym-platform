import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '#src/common/config/app-config.types';

type OriginHeaders = Record<string, string | string[] | undefined>;
function header(headers: OriginHeaders, name: string): string | undefined {
  const value = headers[name];
  // Repeated security headers are ambiguous: reject rather than trust the first.
  return typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.length === 1
        ? value[0]
        : '\0'
      : undefined;
}

function originOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
      ? parsed.origin
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Admin browser traffic has a narrower origin than normal API traffic:
 * an exact ADMIN_APP_URL (or APP_URL in legacy single-web deployments).
 * This does NOT replace the existing session library's CSRF enforcement.
 * Unadorned server-to-server GETs must work for Admin Next.js SSR, while a
 * browser presenting a foreign Origin, Referer or Fetch Metadata fails closed.
 */
export function isAllowedAdminOrigin(headers: OriginHeaders, expected: string): boolean {
  const origin = header(headers, 'origin');
  // Compare exact serialized origins, not subdomains, suffixes or URLs with paths.
  if (origin !== undefined && origin !== expected) return false;

  const referer = header(headers, 'referer');
  if (referer !== undefined && originOf(referer) !== expected) return false;
  if (origin !== undefined) return true;

  const fetchSite = header(headers, 'sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    // A cross-site/sibling-origin browser that omits Origin is NOT trusted.
    return false;
  }
  return true;
}

@Injectable()
export class AdminOriginGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const adminUrl = this.config.get('ADMIN_APP_URL');
    const appUrl = this.config.get('APP_URL');
    // Fail closed on invalid/missing configuration.
    const expected = originOf(adminUrl ?? appUrl ?? '');
    const request = context.switchToHttp().getRequest<{ headers?: OriginHeaders }>();
    if (!expected || !isAllowedAdminOrigin(request.headers ?? {}, expected)) {
      throw new ForbiddenException('Administrative request origin not trusted');
    }
    return true;
  }
}
