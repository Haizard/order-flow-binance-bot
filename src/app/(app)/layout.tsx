
"use client";

import * as React from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Moon, Sun, RefreshCw } from 'lucide-react';

// A simple theme toggle example - in a real app, this would use context/state management
function ThemeToggle() {
  const [theme, setTheme] = React.useState('light');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(storedTheme);
  }, []);

  React.useEffect(() => {
    if (mounted) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme, mounted]);

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled className="h-9 w-9" aria-label="Toggle theme" />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}


export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      router.refresh();
      console.log(`[${new Date().toISOString()}] AppLayout: Automatic router.refresh() called (every 5 seconds).`);
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(intervalId); // Clear interval on component unmount
  }, [router]);

  const handleRefresh = () => {
    router.refresh();
    console.log(`[${new Date().toISOString()}] AppLayout: Manual router.refresh() called.`);
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="p-3">
          <Logo />
        </SidebarHeader>
        <SidebarContent className="p-2 flex-grow">
          <MainNav />
        </SidebarContent>
        <SidebarFooter className="p-2">
          {/* You can add footer items here if needed */}
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger className="md:hidden" /> {/* Only show on mobile */}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh data" className="h-9 w-9">
              <RefreshCw className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
