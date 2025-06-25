import { Shield } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Admin Dashboard
        </h1>
      </div>
      {children}
    </div>
  );
}
