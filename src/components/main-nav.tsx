
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
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/session-client';

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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdminStatus() {
        const session = await getSession();
        if(session?.isAdmin) {
            setIsAdmin(true);
        }
    }
    checkAdminStatus();
  }, []);

  const allItems = isAdmin ? [...menuItems, ...adminMenuItems] : menuItems;

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
