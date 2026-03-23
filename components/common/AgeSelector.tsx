'use client';

import clsx from 'clsx';
import { AGE_GROUPS, type AgeGroup } from '@/components/providers/BabyProfileProvider';

interface AgeSelectorProps {
  value: AgeGroup;
  onChange: (age: AgeGroup) => void;
}

export function AgeSelector({ value, onChange }: AgeSelectorProps) {
  return (
    <div className="age-selector" role="radiogroup" aria-label="选择宝宝月龄">
      {AGE_GROUPS.map((group) => (
        <button
          key={group.value}
          type="button"
          role="radio"
          aria-checked={value === group.value}
          className={clsx('age-pill', { active: value === group.value })}
          onClick={() => onChange(group.value)}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
