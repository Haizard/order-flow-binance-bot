import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Logo />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
