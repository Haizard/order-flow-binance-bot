'use client';

import { Shield, Box, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine the active tab from the pathname
  const activeTab = pathname.includes('/admin/users') ? 'users' : 'projects';

  const onTabChange = (value: string) => {
    router.push(`/admin/${value}`);
  };

  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Admin Dashboard
        </h1>
      </div>
      
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="projects">
            <Box className="mr-2 h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="users">
             <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="mt-2">{children}</div>
    </div>
  );
}
