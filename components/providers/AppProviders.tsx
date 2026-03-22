'use client';

import { ReactNode } from 'react';
import { PlayerProvider } from '@/components/providers/PlayerProvider';
import { BabyProfileProvider } from '@/components/providers/BabyProfileProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BabyProfileProvider>
      <PlayerProvider>{children}</PlayerProvider>
    </BabyProfileProvider>
  );
}
