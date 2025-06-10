"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, History, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
  { href: '/trades', label: 'Trade History', icon: History },
  { href: '/subscription', label: 'Subscription', icon: CreditCard },
];

export function MainNav() {
  const pathname = usePathname();
  const { open } = useSidebar();

  return (
    <SidebarMenu>
      {menuItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} legacyBehavior passHref>
            <SidebarMenuButton
              isActive={pathname === item.href}
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
