
import { getFeaturedProject, getInvestmentCount, hasUserInvested } from "@/services/projectService";
import InvestCard from "@/components/invest/invest-card";
import { Rocket, Clock, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

// Placeholder for current user ID - replace with actual auth system integration
const DEMO_USER_ID = "user123";

export default async function InvestPage() {
    const project = await getFeaturedProject();
    const investorsCount = await getInvestmentCount(project.id);
    const userHasInvested = await hasUserInvested(project.id, DEMO_USER_ID);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
                    <Rocket className="h-8 w-8 text-primary" />
                    Become an Early Backer
                </h1>
            </div>

            <InvestCard 
                project={project} 
                investorsCount={investorsCount} 
                userId={DEMO_USER_ID}
                userHasInvested={userHasInvested}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Project Timeline & Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-3">
                            <Clock className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                            <span><strong className="text-foreground">Month 1:</strong> Development Sprint. Once funding is complete, a one-month intensive development cycle begins to build the core platform.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 mt-0.5 text-accent flex-shrink-0" />
                            <span><strong className="text-foreground">End of Month 1:</strong> Beta Access. Founding backers receive early access to the beta version of Project Chimera.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Rocket className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                            <span><strong className="text-foreground">Post-Beta:</strong> Public Launch. Backers are automatically upgraded to their Lifetime Pro accounts.</span>
                        </li>
                    </ul>
                    <p className="text-xs text-center mt-6 text-muted-foreground">
                        (Note: This is a conceptual feature for demonstration. Clicking 'Invest Now' simulates a database entry but is not a real transaction.)
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
