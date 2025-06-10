import { TrendingUp } from 'lucide-react';
import Link from 'next/link';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LogoProps extends HTMLAttributes<HTMLAnchorElement> {}

export function Logo({ className, ...props }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <TrendingUp className="h-6 w-6 text-primary" />
      <span className="font-headline">Binance Trailblazer</span>
    </Link>
  );
}
