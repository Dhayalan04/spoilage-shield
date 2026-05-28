import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, ThermometerSun, LineChart, ShieldAlert, Cpu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CropSense — Smart Crop Storage & Price Intelligence" },
      { name: "description", content: "Real-time IoT monitoring, spoilage prediction, and market price intelligence for farmers." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-heading text-lg font-bold text-primary">
            <Leaf className="h-5 w-5" /> CropSense
          </Link>
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#iot" className="hover:text-foreground">IoT setup</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/signup"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-primary-foreground md:py-32">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs">
              <Cpu className="h-3 w-3" /> IoT · ML · Market Intelligence
            </div>
            <h1 className="font-heading text-5xl font-bold leading-tight md:text-6xl">
              Protect every harvest.<br />
              Sell at the perfect moment.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
              CropSense connects to your storage sensors, predicts spoilage before it happens,
              and tracks market prices so you know exactly when to sell.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  Start monitoring <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how"><Button size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                See how it works
              </Button></a>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-primary-foreground/20 pt-8 text-sm">
              <Stat n="24/7" label="Sensor monitoring" />
              <Stat n="<3 min" label="Alert latency" />
              <Stat n="6 crops" label="Tracked markets" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-heading text-3xl font-bold md:text-4xl">Everything you need to keep produce fresh</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">A complete platform combining hardware data, prediction, and market signals.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Feature icon={ThermometerSun} title="Real-time conditions" body="Stream temperature & humidity from ESP32/DHT11 into a live dashboard." />
          <Feature icon={ShieldAlert} title="Spoilage prediction" body="Rule-based risk scoring flags problems before crops are lost." />
          <Feature icon={LineChart} title="Market intelligence" body="Track wholesale prices and get sell/hold recommendations." />
          <Feature icon={Cpu} title="Multi-unit support" body="Manage dozens of storage units with per-unit thresholds." />
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-y border-border/50 bg-muted/30 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          <Step n="1" title="Connect your sensors" body="Pair any ESP32 + DHT11 device using a unique device token. POST readings to our ingestion endpoint." />
          <Step n="2" title="Watch & get alerted" body="Live dashboard shows current conditions, history, and pushes alerts when thresholds break." />
          <Step n="3" title="Sell at the peak" body="Cross-reference spoilage risk with market trends to choose the optimal selling window." />
        </div>
      </section>

      {/* IoT */}
      <section id="iot" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-start gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl font-bold">Send readings from any device</h2>
            <p className="mt-3 text-muted-foreground">
              Each storage unit gets a unique device token. Your ESP32 firmware just POSTs JSON.
              No SDK, no extra config.
            </p>
            <Link to="/signup" className="mt-6 inline-block">
              <Button>Create an account</Button>
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-border bg-sidebar p-5 text-xs text-sidebar-foreground shadow-elevated">
{`POST /api/public/ingest
Content-Type: application/json

{
  "device_token": "<your unit token>",
  "temperature": 24.6,
  "humidity": 68
}`}
          </pre>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} CropSense — Built for farmers.
        </div>
      </footer>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-heading text-3xl font-bold">{n}</div>
      <div className="mt-1 text-primary-foreground/70">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-soft transition hover:shadow-elevated">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary font-heading font-bold text-primary-foreground">{n}</div>
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}
