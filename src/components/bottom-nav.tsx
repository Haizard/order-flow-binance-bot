
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChartHorizontalBig, History, Settings, Rocket, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

// This is a temporary solution for the demo to identify the admin.
// In a real app, this would come from an authentication context.
const DEMO_USER_ID = "admin001";
const ADMIN_USER_ID = "admin001";
const IS_ADMIN = DEMO_USER_ID === ADMIN_USER_ID;

const allMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, admin: false },
  { href: '/footprint-charts', label: 'Charts', icon: BarChartHorizontalBig, admin: false },
  { href: '/invest', label: 'Invest', icon: Rocket, admin: false },
  ...(IS_ADMIN ? [{ href: '/admin/projects', label: 'Admin', icon: Shield, admin: true }] : []),
  { href: '/trades', label: 'History', icon: History, admin: false },
  { href: '/settings', label: 'Settings', icon: Settings, admin: false },
];

// Ensure we have exactly 5 items for the grid
const menuItems = IS_ADMIN
  ? allMenuItems.filter(item => !item.admin || item.href === '/admin/projects').slice(0, 5)
  : allMenuItems.filter(item => !item.admin).slice(0, 5);


export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="grid h-16 grid-cols-5 items-center">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-colors hover:text-primary",
                isActive ? "text-primary" : ""
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
