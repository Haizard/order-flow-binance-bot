
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import React from "react";

const verifyFormSchema = z.object({
  code: z.string().min(6, "Verification code must be 6 characters.").max(6, "Verification code must be 6 characters."),
});

type VerifyFormValues = z.infer<typeof verifyFormSchema>;

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const email = searchParams.get('email');

  const form = useForm<VerifyFormValues>({
    resolver: zodResolver(verifyFormSchema),
    defaultValues: {
      code: "",
    },
  });

  function onSubmit(data: VerifyFormValues) {
    // Simulate API call to verify the code
    console.log("Verifying code:", data.code, "for email:", email);
    
    // On success:
    toast({ 
        title: "Account Verified!", 
        description: "Your account has been successfully verified. Please log in.",
        variant: "default",
        className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
    });
    router.push('/login');
    
    // On failure, you would show an error message
    // form.setError("code", { type: "manual", message: "Invalid verification code." });
  }

  if (!email) {
    return (
        <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold font-headline">Invalid Page Access</CardTitle>
                <CardDescription>
                    No email was provided for verification. Please start from the registration page.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild className="w-full">
                    <Link href="/register">Go to Registration</Link>
                </Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold font-headline">Check Your Email</CardTitle>
        <CardDescription>
          We&apos;ve sent a six-digit verification code to <span className="font-medium text-foreground">{email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <Input placeholder="123456" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the code from your email.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" size="lg">
               <MailCheck className="mr-2 h-5 w-5" /> Verify Account
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Didn&apos;t receive a code?{" "}
          <Button variant="link" className="p-0 h-auto font-medium text-primary">
            Resend code
          </Button>
        </p>
      </CardContent>
    </Card>
  );
}
