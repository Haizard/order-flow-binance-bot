import { redirect } from 'next/navigation';
import { getAllUserSettings } from '@/services/settingsService';
import { UsersList } from '@/components/admin/users-list';

// Hardcoded user IDs for demo purposes
const DEMO_USER_ID = "admin001";
const ADMIN_USER_ID = "admin001";

export default async function AdminUsersPage() {
    const isUserAdmin = DEMO_USER_ID === ADMIN_USER_ID;

    // Basic authorization check
    if (!isUserAdmin) {
        redirect('/dashboard');
    }
    
    const allUserSettings = await getAllUserSettings();

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold tracking-tight font-headline">Manage Users</h2>
            <UsersList users={allUserSettings} />
        </div>
    );
}
