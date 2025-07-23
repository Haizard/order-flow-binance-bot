
import { getAllUserSettings } from '@/services/settingsService';
import { UsersList } from '@/components/admin/users-list';

export default async function AdminUsersPage() {
    const allUserSettings = await getAllUserSettings();

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold tracking-tight font-headline">Manage Users</h2>
            <UsersList users={allUserSettings} />
        </div>
    );
}
