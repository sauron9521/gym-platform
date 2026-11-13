import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared visual shell only. Next.js may cache layouts during navigation.
 * Each private page MUST verify the session before rendering private UI.
 */
export default function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold">
            Gym Platform
          </Link>
          <nav aria-label="Особистий кабінет">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
              Кабінет
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
