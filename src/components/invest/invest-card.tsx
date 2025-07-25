
'use client';

import React, { useState, useTransition } from 'react';
import type { Project } from '@/types/project';
import { handleInvest } from '@/app/(app)/invest/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Rocket, Target, Users, LifeBuoy, CheckCircle, Loader2 } from "lucide-react";

interface InvestCardProps {
    project: Project;
    investorsCount: number;
    userId: string;
    userHasInvested: boolean;
}

export default function InvestCard({ project, investorsCount, userId, userHasInvested }: InvestCardProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    
    const progressPercentage = (investorsCount / project.investorTarget) * 100;
    const isFullyFunded = investorsCount >= project.investorTarget;

    const onInvestClick = () => {
        startTransition(async () => {
            const result = await handleInvest(project.id);
            if (result.success) {
                toast({
                    title: "Investment Successful!",
                    description: result.message,
                    variant: 'default',
                    className: "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700 text-green-800 dark:text-green-300",
                });
            } else {
                toast({
                    title: "Investment Failed",
                    description: result.message,
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <Card className="shadow-xl border-primary/50">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">{project.name}</CardTitle>
                <CardDescription>
                    Help build the next generation of our AI-powered trading platform and secure exclusive lifetime benefits.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="font-semibold text-lg mb-2">The Vision</h3>
                    <p className="text-muted-foreground">
                        {project.vision}
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-muted/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <Target className="h-5 w-5 text-primary" />
                                The Goal
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: project.goal }} />
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <LifeBuoy className="h-5 w-5 text-primary" />
                                The Offer for Backers
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: project.offer }} />
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <h3 className="font-semibold text-lg mb-3">Funding Progress</h3>
                    <div className="space-y-2">
                        <Progress value={progressPercentage} className="w-full h-4" />
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-muted-foreground">
                                <Users className="inline h-4 w-4 mr-1.5" />
                                {investorsCount} of {project.investorTarget} Backers
                            </span>
                            <span className="font-bold text-primary">
                                {isFullyFunded ? 'Project Funded!' : `$${(project.investorTarget - investorsCount) * project.investmentAmount} left to raise`}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/20 p-6 rounded-b-lg">
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <p className="text-2xl font-bold">One-Time Investment: ${project.investmentAmount}</p>
                        <p className="text-muted-foreground text-sm">Limited to the first {project.investorTarget} people.</p>
                    </div>
                    <Button size="lg" onClick={onInvestClick} disabled={isFullyFunded || isPending || userHasInvested}>
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Processing...
                            </>
                        ) : userHasInvested ? (
                            <>
                                <CheckCircle className="mr-2 h-5 w-5" />
                                Already Invested!
                            </>
                        ) : isFullyFunded ? (
                            <>
                                <CheckCircle className="mr-2 h-5 w-5" />
                                Fully Funded!
                            </>
                        ) : (
                            <>
                                <Rocket className="mr-2 h-5 w-5" />
                                Invest Now
                            </>
                        )}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
