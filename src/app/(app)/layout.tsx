"use client";

import * as React from 'react';
import type { ReactNode } from 'react';
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
import { Moon, Sun } from 'lucide-react'; // Assuming you might want a theme toggle
import { Separator } from '@/components/ui/separator';

// A simple theme toggle example - in a real app, this would use context/state management
function ThemeToggle() {
  const [theme, setTheme] = React.useState('light');
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}


export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarHeader className="p-4">
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <SidebarTrigger className="md:hidden" /> {/* Only show on mobile */}
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <UserNav />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
