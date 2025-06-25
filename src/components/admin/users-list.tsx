'use client';

import type { SettingsFormValues } from '@/components/settings/settings-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface UsersListProps {
  users: SettingsFormValues[];
}

export function UsersList({ users }: UsersListProps) {
  
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">No users found.</p>
        <p className="text-sm text-muted-foreground mt-2">New users will appear here after they register and save their settings for the first time.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Subscription Status</TableHead>
              <TableHead>API Key Set</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.userId}>
                <TableCell className="font-medium">{user.userId}</TableCell>
                <TableCell>
                    <Badge variant={user.hasActiveSubscription ? 'default' : 'secondary'} className={user.hasActiveSubscription ? 'bg-accent/80 hover:bg-accent text-accent-foreground' : ''}>
                        {user.hasActiveSubscription ? 'Active Pro' : 'Inactive'}
                    </Badge>
                </TableCell>
                 <TableCell className="flex items-center">
                    {user.binanceApiKey ? <CheckCircle className="h-5 w-5 text-accent" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                 </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
