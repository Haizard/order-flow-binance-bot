
import { getProjectById } from '@/services/projectService';
import EditProjectForm from '@/components/admin/edit-project-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface EditProjectPageProps {
  params: {
    id: string;
  };
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const project = await getProjectById(params.id);

  if (!project) {
    return (
      <div className="flex flex-col gap-6 items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Project Not Found</h1>
        <p className="text-muted-foreground">The project you are trying to edit does not exist.</p>
        <Button asChild>
          <Link href="/admin/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/projects">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to projects</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Edit Project: {project.name}</h1>
      </div>
      <EditProjectForm project={project} />
    </div>
  );
}
