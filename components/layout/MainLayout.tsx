import { ReactNode } from 'react';
import { BottomNav } from '@/components/navigation/BottomNav';

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container">
      <main className="page-content">{children}</main>
      <BottomNav />
    </div>
  );
}
