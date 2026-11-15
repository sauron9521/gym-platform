'use client';

import React, { useEffect, useLayoutEffect } from 'react';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import { Uniwind } from 'uniwind';

import { script } from './script';

export type ModeType = 'light' | 'dark' | 'system';

const useSafeLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function GluestackUIProvider({
  mode = 'dark',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
}) {
  useSafeLayoutEffect(() => {
    const applyMode = (resolvedMode: 'light' | 'dark') => {
      script(resolvedMode);
      Uniwind.setTheme(resolvedMode);
    };

    if (mode !== 'system') {
      applyMode(mode);
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemMode = () => applyMode(media.matches ? 'dark' : 'light');

    // The previous inline script initialized this before React mounted.
    // On client-rendered Expo Web, initialize here to avoid React 19's
    // client-side <script> warning and still honor the current system theme.
    syncSystemMode();
    media.addEventListener('change', syncSystemMode);
    return () => media.removeEventListener('change', syncSystemMode);
  }, [mode]);

  return (
    <OverlayProvider>
      <ToastProvider>{props.children}</ToastProvider>
    </OverlayProvider>
  );
}
