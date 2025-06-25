
import { getFeaturedProject, getInvestmentCount, hasUserInvested, getInvestorsByProject } from "@/services/projectService";
import InvestCard from "@/components/invest/invest-card";
import { Rocket, Clock, CheckCircle, Users } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Investment } from "@/types/project";

// To test client view, change DEMO_USER_ID to "user123"
const DEMO_USER_ID = "admin001";
const ADMIN_USER_ID = "admin001";

export default async function InvestPage() {
    const project = await getFeaturedProject();
    const investorsCount = await getInvestmentCount(project.id);
    const userHasInvested = await hasUserInvested(project.id, DEMO_USER_ID);
    
    const isUserAdmin = DEMO_USER_ID === ADMIN_USER_ID;
    let investorsList: Investment[] = [];
    if (isUserAdmin) {
        investorsList = await getInvestorsByProject(project.id);
    }

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

            {isUserAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-3">
                            <Users className="h-6 w-6 text-primary" />
                            Project Backers (Admin View)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {investorsList.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User ID</TableHead>
                                        <TableHead className="text-right">Investment Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {investorsList.map((investor) => (
                                        <TableRow key={investor.userId}>
                                            <TableCell className="font-medium">{investor.userId}</TableCell>
                                            <TableCell className="text-right">{new Date(investor.timestamp).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">No investors have backed this project yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}

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
