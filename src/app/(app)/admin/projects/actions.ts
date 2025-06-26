'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteProject, createProject, updateProject } from '@/services/projectService';
import type { NewProjectInput } from '@/types/project';

interface ActionResult {
    success: boolean;
    message: string;
}

export async function handleDeleteProject(projectId: string): Promise<ActionResult> {
    
    // In a real app, you would add an authorization check here to ensure
    // only an admin can perform this action.
    
    const result = await deleteProject(projectId);
    
    if (result.success) {
        // Revalidate the admin projects page to update the list.
        revalidatePath('/admin/projects');
    }

    return result;
}

export async function handleCreateProject(projectData: NewProjectInput): Promise<ActionResult> {
    // In a real app, you would add an authorization check here.
    const result = await createProject(projectData);

    if (result.success) {
        revalidatePath('/admin/projects');
        redirect('/admin/projects');
    }

    return result;
}


export async function handleUpdateProject(projectId: string, projectData: NewProjectInput): Promise<ActionResult> {
    // In a real app, you would add an authorization check here.
    const result = await updateProject(projectId, projectData);

    if (result.success) {
        revalidatePath('/admin/projects');
        revalidatePath(`/admin/projects/edit/${projectId}`);
        redirect('/admin/projects');
    }

    return result;
}
