// src/app/(app)/admin/projects/new/page.tsx
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

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
import { Loader2, PlusCircle, ArrowLeft } from "lucide-react";
import { handleCreateProject } from "../actions";
import type { NewProjectInput } from "@/types/project";
import Link from "next/link";

const newProjectFormSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters."),
  vision: z.string().min(10, "Vision statement is required."),
  goal: z.string().min(10, "Goal description is required."),
  offer: z.string().min(10, "Offer description is required."),
  investorTarget: z.coerce.number().int().positive("Investor target must be a positive whole number."),
  investmentAmount: z.coerce.number().positive("Investment amount must be a positive number."),
});

type NewProjectFormValues = z.infer<typeof newProjectFormSchema>;

export default function NewProjectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectFormSchema),
    defaultValues: {
      name: "",
      vision: "",
      goal: "",
      offer: "",
      investorTarget: 10,
      investmentAmount: 150,
    },
  });

  function onSubmit(data: NewProjectFormValues) {
    startTransition(async () => {
      const result = await handleCreateProject(data);
      if (result.success) {
        toast({
          title: "Project Created!",
          description: `Project "${data.name}" has been successfully created.`,
          variant: "default",
          className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
        });
        // The server action will handle the redirect
      } else {
        toast({
          title: "Creation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    });
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
        <h1 className="text-3xl font-bold tracking-tight font-headline">Create New Project</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Fill in the information for the new investment opportunity.</CardDescription>
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
              <PlusCircle className="mr-2 h-5 w-5" />
            )}
            Create Project
          </Button>
        </form>
      </Form>
    </div>
  );
}
