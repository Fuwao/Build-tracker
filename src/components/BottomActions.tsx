import type { ReactNode } from 'react';

export function BottomActions({ children }: { children: ReactNode }) {
  return <div className="bottom-actions">{children}</div>;
}
