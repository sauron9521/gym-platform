import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gym Platform Admin',
  description: 'Закрита адміністративна консоль Gym Platform.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="uk">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
