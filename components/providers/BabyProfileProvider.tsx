'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type AgeGroup = '0-3' | '4-6' | '7-9' | '10-12' | '13-18' | '19-24' | '25-36';

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: '0-3', label: '0-3月' },
  { value: '4-6', label: '4-6月' },
  { value: '7-9', label: '7-9月' },
  { value: '10-12', label: '10-12月' },
  { value: '13-18', label: '13-18月' },
  { value: '19-24', label: '19-24月' },
  { value: '25-36', label: '25-36月' },
];

interface BabyProfileContextValue {
  ageGroup: AgeGroup;
  setAgeGroup: (age: AgeGroup) => void;
}

const BabyProfileContext = createContext<BabyProfileContextValue | undefined>(undefined);

const STORAGE_KEY = 've_baby_age_group';

export function BabyProfileProvider({ children }: { children: ReactNode }) {
  const [ageGroup, setAgeGroupState] = useState<AgeGroup>('0-3');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setAgeGroupState(saved as AgeGroup);
  }, []);

  const setAgeGroup = useCallback((age: AgeGroup) => {
    setAgeGroupState(age);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, age);
    }
  }, []);

  return (
    <BabyProfileContext.Provider value={{ ageGroup, setAgeGroup }}>
      {children}
    </BabyProfileContext.Provider>
  );
}

export function useBabyProfile() {
  const context = useContext(BabyProfileContext);
  if (!context) {
    throw new Error('useBabyProfile 必须在 BabyProfileProvider 内使用');
  }
  return context;
}
