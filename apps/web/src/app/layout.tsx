import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { WebQueryProvider } from './providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Gym Platform',
  description: 'Gym Platform web application.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="uk">
      <body className="min-h-screen antialiased">
        <WebQueryProvider>{children}</WebQueryProvider>
      </body>
    </html>
  );
}
