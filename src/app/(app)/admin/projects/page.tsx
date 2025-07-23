
import { getAllProjects } from '@/services/projectService';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import ProjectsList from '@/components/admin/projects-list';

export default async function AdminProjectsPage() {
    const projects = await getAllProjects();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight font-headline">Manage Projects</h2>
                <Button asChild>
                    <Link href="/admin/projects/new">
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Create Project
                    </Link>
                </Button>
            </div>
            <ProjectsList initialProjects={projects} />
        </div>
    );
}
