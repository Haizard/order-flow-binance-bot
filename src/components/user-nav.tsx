
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { handleLogout } from "@/lib/actions";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/session-client";
import type { User } from "@/types/user";

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Since getSession can only run on server, we need a client-side way to get info.
    // This is a placeholder. In a real app with AuthContext, this would be cleaner.
    async function fetchSession() {
        const session = await getSession();
        if (session) {
            setUser(session);
        }
    }
    fetchSession();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://placehold.co/40x40.png" alt="@shadcn" data-ai-hint="profile avatar" />
            <AvatarFallback>
              <UserCircle className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user ? user.email.split('@')[0] : "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email || "loading..."}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <UserCircle className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleLogout()}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
