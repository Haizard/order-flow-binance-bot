'use server';

import { revalidatePath } from 'next/cache';
import { deleteProject } from '@/services/projectService';

interface DeleteResult {
    success: boolean;
    message: string;
}

export async function handleDeleteProject(projectId: string): Promise<DeleteResult> {
    
    // In a real app, you would add an authorization check here to ensure
    // only an admin can perform this action.
    
    const result = await deleteProject(projectId);
    
    if (result.success) {
        // Revalidate the admin projects page to update the list.
        revalidatePath('/admin/projects');
    }

    return result;
}
