'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { usePlayer } from '@/components/providers/PlayerProvider';

const NAV_ITEMS = [
  {
    href: '/home',
    label: '摇篮',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3C7 3 3 7.5 3 12c0 1.5.5 3 1.2 4.2" />
        <path d="M21 12c0-4.5-4-9-9-9" />
        <path d="M12 21c-4 0-7.5-2.5-8.8-6" />
        <path d="M12 21c2.5 0 5-1 6.8-2.8" />
        <ellipse cx="12" cy="12" rx="4" ry="6" />
      </svg>
    ),
    activeIcon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3C7 3 3 7.5 3 12c0 1.5.5 3 1.2 4.2" />
        <path d="M21 12c0-4.5-4-9-9-9" />
        <path d="M12 21c-4 0-7.5-2.5-8.8-6" />
        <path d="M12 21c2.5 0 5-1 6.8-2.8" />
        <ellipse cx="12" cy="12" rx="4" ry="6" />
      </svg>
    ),
  },
  {
    href: '/stories',
    label: '探索',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
    activeIcon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
  },
  {
    href: '/music',
    label: '乐音',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    activeIcon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    href: '/me',
    label: '珍藏',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    activeIcon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isPlaying } = usePlayer();

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {/* 播放中流光条 */}
      {isPlaying && <div className="bottom-nav-playing-bar" />}

      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/home' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx('bottom-nav-item', { active: isActive })}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive ? item.activeIcon : item.icon}
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
