'use client';

import { Toaster } from 'sonner';

/** One persistent, accessible notification layer for the web application. */
export function WebToaster() {
  return <Toaster position="top-right" richColors closeButton duration={4_500} visibleToasts={3} />;
}
