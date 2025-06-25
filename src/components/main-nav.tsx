
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, History, LayoutDashboard, Settings as SettingsIcon, BarChartHorizontalBig, Rocket, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

// This is a temporary solution for the demo to identify the admin.
// In a real app, this would come from an authentication context.
const DEMO_USER_ID = "admin001";
const ADMIN_USER_ID = "admin001";
const IS_ADMIN = DEMO_USER_ID === ADMIN_USER_ID;

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/footprint-charts', label: 'Footprint Charts', icon: BarChartHorizontalBig },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
  { href: '/trades', label: 'Trade History', icon: History },
  { href: '/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/invest', label: 'Invest', icon: Rocket },
];

const adminMenuItems = [
    { href: '/admin/projects', label: 'Admin', icon: Shield },
];

export function MainNav() {
  const pathname = usePathname();
  const { open } = useSidebar();

  const allItems = IS_ADMIN ? [...menuItems, ...adminMenuItems] : menuItems;

  return (
    <SidebarMenu>
      {allItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href}>
            <SidebarMenuButton
              isActive={pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/')}
              tooltip={open ? undefined : item.label}
              aria-label={item.label}
            >
              <item.icon className="h-5 w-5" />
              <span className={cn(open ? "opacity-100" : "opacity-0 delay-100", "transition-opacity duration-150 ease-in-out")}>{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
