
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, BarChartHorizontalBig, Zap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center gap-6 px-4 py-20 text-center sm:py-32 lg:py-40">
          <h1 className="text-4xl font-extrabold tracking-tight font-headline sm:text-5xl md:text-6xl lg:text-7xl">
            Automated Order Flow Trading
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground sm:text-xl md:text-2xl">
            Leverage institutional-grade footprint chart analysis to automate your trading strategies. Make data-driven decisions, 24/7.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">Sign Up for Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </section>

        <section id="features" className="bg-muted py-20 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight font-headline sm:text-4xl">Why Haizard Misape?</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Go beyond simple indicators. Our bot uses real-time order flow data to find high-probability entries and exits.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="text-center shadow-lg">
                <CardHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BarChartHorizontalBig className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-4 font-headline">Footprint Analytics</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Analyze volume, delta, and imbalances at every price level to see the real story behind market movements.
                </CardContent>
              </Card>
              <Card className="text-center shadow-lg">
                <CardHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Zap className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-4 font-headline">Autonomous Trading</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Our bot runs 24/7 on the server, continuously monitoring markets and managing your trades based on your strategy.
                </CardContent>
              </Card>
              <Card className="text-center shadow-lg">
                <CardHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-4 font-headline">Secure & Managed</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Your API keys are used only for trade execution. The strategy is managed by the admin, giving you a hands-off experience.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 text-center sm:px-6 lg:px-8 sm:py-24">
            <h2 className="text-3xl font-bold tracking-tight font-headline sm:text-4xl">Ready to Start?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
                Create an account and connect your API keys in minutes.
            </p>
            <div className="mt-8">
                <Button size="lg" asChild>
                    <Link href="/register">Sign Up Now</Link>
                </Button>
            </div>
        </section>
      </main>

      <footer className="border-t bg-muted">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Haizard Misape. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
