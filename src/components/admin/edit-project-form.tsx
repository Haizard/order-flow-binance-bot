'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { handleUpdateProject } from "@/app/(app)/admin/projects/actions";
import type { Project } from "@/types/project";

const editProjectFormSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters."),
  vision: z.string().min(10, "Vision statement is required."),
  goal: z.string().min(10, "Goal description is required."),
  offer: z.string().min(10, "Offer description is required."),
  investorTarget: z.coerce.number().int().positive("Investor target must be a positive whole number."),
  investmentAmount: z.coerce.number().positive("Investment amount must be a positive number."),
});

type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

interface EditProjectFormProps {
  project: Project;
}

export default function EditProjectForm({ project }: EditProjectFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectFormSchema),
    defaultValues: {
      name: project.name,
      vision: project.vision,
      goal: project.goal,
      offer: project.offer,
      investorTarget: project.investorTarget,
      investmentAmount: project.investmentAmount,
    },
  });

  function onSubmit(data: EditProjectFormValues) {
    startTransition(async () => {
      const result = await handleUpdateProject(project.id, data);
      if (result.success) {
        toast({
          title: "Project Updated!",
          description: `Project "${data.name}" has been successfully updated.`,
          variant: "default",
          className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
        });
        // The server action will handle the redirect
      } else {
        toast({
          title: "Update Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    });
  }

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Update the information for this investment opportunity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Project Phoenix" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vision</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the long-term vision of this project..." {...field} />
                    </FormControl>
                    <FormDescription>A short, compelling summary of what the project aims to achieve.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the goal of the fundraise..." {...field} />
                    </FormControl>
                     <FormDescription>Explain what the funding will be used for.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="offer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer for Backers</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe what backers will receive..." {...field} />
                    </FormControl>
                    <FormDescription>What is the reward for the one-time investment?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid md:grid-cols-2 gap-6">
                 <FormField
                  control={form.control}
                  name="investorTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Investor Target</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10" {...field} />
                      </FormControl>
                      <FormDescription>The number of backers needed to fully fund the project.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="investmentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Investment Amount ($)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="150" {...field} />
                      </FormControl>
                      <FormDescription>The one-time investment amount per backer.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
               </div>
            </CardContent>
          </Card>
          
           <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Save Changes
          </Button>
        </form>
      </Form>
  );
}
