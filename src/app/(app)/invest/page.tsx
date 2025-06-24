
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Rocket, Target, Users, LifeBuoy, Clock, CheckCircle } from "lucide-react";

// Placeholder data - in a real app, this would come from a database.
const investorsCount = 3;
const investorsTarget = 10;
const investmentAmount = 150;
const progressPercentage = (investorsCount / investorsTarget) * 100;

export default function InvestPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
          <Rocket className="h-8 w-8 text-primary" />
          Become an Early Backer
        </h1>
      </div>

      <Card className="shadow-xl border-primary/50">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Invest in the Future of Automated Trading</CardTitle>
          <CardDescription>
            Help build the next generation of our AI-powered trading platform and secure exclusive lifetime benefits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-2">The Vision: Project Chimera</h3>
            <p className="text-muted-foreground">
              While Binance Trailblazer is a powerful tool, I envision something far more advanced. Project Chimera will be a multi-strategy, AI-optimized trading system that adapts to market conditions in real-time. It requires significant resources for hosting, enterprise-grade data feeds, and dedicated AI model training. Your investment will directly fund this development.
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
                <p className="text-sm text-muted-foreground">
                  To raise the necessary capital to build and deploy Project Chimera within a one-month timeframe. We're seeking a small group of founding backers who believe in this vision.
                </p>
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
                <p className="text-sm text-muted-foreground">
                  As a thank you, each of our 10 founding backers will receive a <strong className="text-foreground">Lifetime Pro Plan</strong> for the new platform. No subscriptions, ever.
                </p>
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
                  {investorsCount} of {investorsTarget} Backers
                </span>
                <span className="font-bold text-primary">
                  ${(investorsTarget - investorsCount) * investmentAmount} left to raise
                </span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 p-6 rounded-b-lg">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold">One-Time Investment: ${investmentAmount}</p>
              <p className="text-muted-foreground text-sm">Limited to the first {investorsTarget} people.</p>
            </div>
            <Button size="lg" disabled={investorsCount >= investorsTarget}>
              {investorsCount >= investorsTarget ? (
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
              (Note: This is a conceptual feature for demonstration. Clicking 'Invest Now' is not a real transaction.)
            </p>
        </CardContent>
      </Card>

    </div>
  );
}
