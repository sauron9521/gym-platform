'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  BookOpen,
  CircleHelp,
  Dumbbell,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';

import { BrandLogo } from '@gym/ui-web';

import {
  SIDEBAR_COOKIE_MAX_AGE_SECONDS,
  SIDEBAR_COOKIE_NAME,
} from '@/shared/lib/sidebar-preference';
import type { ThemePreference } from '@/shared/lib/theme-preference';
import { LocaleSwitcher } from '@/shared/ui/locale-switcher';
import { ThemeSwitcher } from '@/shared/ui/theme-switcher';

type NavigationLink = { href: string; label: string };

type AthleteShellProps = {
  children: ReactNode;
  links: NavigationLink[];
  navigationLabel: string;
  locale: string;
  initialPreference: ThemePreference;
  initialCollapsed: boolean;
};

export function isCurrentNavigationLink(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const navigationIcons: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/workouts': Dumbbell,
  '/exercises': BookOpen,
  '/profile': UserRound,
};

/**
 * Shared presentation only: route pages own their individual server-side guards.
 * The small-screen navigation is a non-modal menu, not a focus-trapping dialog.
 */
export function AthleteShell({
  children,
  links,
  navigationLabel,
  locale,
  initialPreference,
  initialCollapsed,
}: AthleteShellProps) {
  const pathname = usePathname() ?? '';
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const menuOpen = openedOnPath === pathname;
  const menuId = useId();
  const desktopNavId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const english = locale === 'en';
  const openLabel = english ? 'Open navigation' : 'Відкрити навігацію';
  const closeLabel = english ? 'Close navigation' : 'Закрити навігацію';
  const homeLabel = english ? 'OVRANTO — home' : 'OVRANTO — головна';
  const expandLabel = english ? 'Expand sidebar' : 'Розгорнути бічну панель';
  const collapseLabel = english ? 'Collapse sidebar' : 'Згорнути бічну панель';

  const toggleSidebar = () => {
    const next = !collapsed;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      SIDEBAR_COOKIE_NAME +
      '=' +
      (next ? 'collapsed' : 'expanded') +
      '; Path=/; Max-Age=' +
      SIDEBAR_COOKIE_MAX_AGE_SECONDS +
      '; SameSite=Lax' +
      secure;
    setCollapsed(next);
  };

  const shellClassName =
    'min-h-screen bg-background text-foreground lg:grid lg:transition-[grid-template-columns] lg:duration-200 motion-reduce:transition-none ' +
    (collapsed ? 'lg:grid-cols-[5.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]');
  const sidebarClassName =
    'sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-border bg-card py-6 lg:flex ' +
    (collapsed ? 'items-center px-2' : 'px-4');
  const toggleClassName =
    'mt-auto flex min-h-11 items-center gap-3 rounded-lg border border-border text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ' +
    (collapsed ? 'size-11 justify-center' : 'w-full px-4');
  const logoClassName = collapsed ? 'w-12 overflow-hidden' : undefined;
  const toggleText = collapsed ? expandLabel : collapseLabel;

  const navLinks = (compact: boolean, onNavigate?: () => void) =>
    links.map((link) => {
      const active = isCurrentNavigationLink(pathname, link.href);
      const Icon = navigationIcons[link.href] ?? CircleHelp;
      const classes = [
        'flex min-h-11 items-center gap-3 rounded-lg border py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'transition-colors motion-reduce:transition-none',
        compact ? 'justify-center px-2' : 'px-4',
        active
          ? 'border-primary/20 bg-primary/10 font-semibold text-primary'
          : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
      ].join(' ');

      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
          title={compact ? link.label : undefined}
          className={classes}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
          <span className={compact ? 'sr-only' : 'min-w-0'}>{link.label}</span>
        </Link>
      );
    });

  return (
    <div data-sidebar-collapsed={collapsed ? 'true' : 'false'} className={shellClassName}>
      <aside className={sidebarClassName}>
        <Link
          href="/"
          aria-label={homeLabel}
          className="mb-10 inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <BrandLogo showTagline={!collapsed} className={logoClassName} />
        </Link>
        <p
          className={
            collapsed
              ? 'sr-only'
              : 'mb-3 px-4 text-xs font-semibold tracking-wide text-muted-foreground'
          }
        >
          {navigationLabel}
        </p>
        <nav id={desktopNavId} aria-label={navigationLabel} className="flex w-full flex-col gap-1">
          {navLinks(collapsed)}
        </nav>
        <button
          type="button"
          aria-label={collapsed ? expandLabel : collapseLabel}
          aria-controls={desktopNavId}
          aria-expanded={!collapsed}
          title={collapsed ? expandLabel : collapseLabel}
          onClick={toggleSidebar}
          className={toggleClassName}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
          )}
          <span className={collapsed ? 'sr-only' : undefined}>{toggleText}</span>
        </button>
      </aside>

      <div className="min-w-0">
        <header
          data-testid="athlete-shell-header"
          className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm"
          onKeyDown={(event) => {
            if (menuOpen && event.key === 'Escape') {
              setOpenedOnPath(null);
              menuButtonRef.current?.focus();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
            <Link
              href="/"
              aria-label={homeLabel}
              className="inline-flex min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden"
            >
              <BrandLogo showTagline={false} className="max-w-full" />
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-controls={menuId}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? closeLabel : openLabel}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
              onClick={() => setOpenedOnPath(menuOpen ? null : pathname)}
            >
              {menuOpen ? (
                <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
              ) : (
                <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />
              )}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-2 lg:border-t-0 lg:px-8">
            <ThemeSwitcher initialPreference={initialPreference} locale={locale} />
            <LocaleSwitcher />
          </div>

          <nav
            id={menuId}
            aria-label={navigationLabel}
            hidden={!menuOpen}
            className="absolute inset-x-0 top-full max-h-[65dvh] overflow-y-auto border-b border-border bg-card p-3 shadow-sm lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks(false, () => setOpenedOnPath(null))}
            </div>
          </nav>
        </header>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
