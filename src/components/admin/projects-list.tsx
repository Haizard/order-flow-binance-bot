'use client';

import React, { useState, useTransition } from 'react';
import type { Project } from '@/types/project';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Loader2, Users, Target } from 'lucide-react';
import { handleDeleteProject } from '@/app/(app)/admin/projects/actions';

interface ProjectsListProps {
  initialProjects: Project[];
}

export default function ProjectsList({ initialProjects }: ProjectsListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const onProjectDelete = (projectId: string) => {
    startTransition(async () => {
      const result = await handleDeleteProject(projectId);
      if (result.success) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        toast({
          title: "Project Deleted",
          description: result.message,
        });
      } else {
        toast({
          title: "Deletion Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    });
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">No projects found.</p>
        <p className="text-sm text-muted-foreground mt-2">Click "Create Project" to add a new investment opportunity.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <Card key={project.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>ID: {project.id}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-2">
            <div className="flex items-center text-sm">
                <Target className="h-4 w-4 mr-2 text-primary" />
                <span><strong className="font-medium">Goal:</strong> {project.investorTarget} Backers</span>
            </div>
             <div className="flex items-center text-sm">
                <Users className="h-4 w-4 mr-2 text-primary" />
                <span><strong className="font-medium">Amount:</strong> ${project.investmentAmount} per backer</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 bg-muted/50 p-3">
             <Button variant="outline" size="sm" disabled>Edit</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete the project "{project.name}". This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onProjectDelete(project.id)} className="bg-destructive hover:bg-destructive/90">
                    Yes, delete project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
