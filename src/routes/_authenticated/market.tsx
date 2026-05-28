import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPrices } from "@/lib/prices.functions";
import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const pricesQuery = queryOptions({ queryKey: ["prices"], queryFn: () => listPrices({ data: {} }) });

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({ meta: [{ title: "Market Prices — CropSense" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pricesQuery),
  component: MarketPage,
});

function MarketPage() {
  const { data } = useSuspenseQuery(pricesQuery);
  const summary = data.summary;
  const [selected, setSelected] = useState<string>(summary[0]?.crop ?? "");

  const series = data.rows
    .filter((r: any) => r.crop_type === selected)
    .map((r: any) => ({
      date: new Date(r.recorded_at).toLocaleDateString([], { month: "short", day: "numeric" }),
      price: Number(r.price_per_kg),
    }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-heading text-3xl font-bold">Market Prices</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track wholesale crop prices and get sell/hold recommendations.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {summary.map((s) => {
          const isUp = s.change > 1, isDown = s.change < -1;
          return (
            <button key={s.crop} onClick={() => setSelected(s.crop)}
              className={`rounded-2xl border bg-card p-4 text-left shadow-soft transition hover:shadow-elevated ${
                selected === s.crop ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}>
              <div className="text-xs text-muted-foreground">{s.crop}</div>
              <div className="mt-1 font-heading text-2xl font-bold">${s.latest.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/kg</span></div>
              <div className={`mt-1 flex items-center gap-1 text-xs ${isUp ? "text-success" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {s.change > 0 ? "+" : ""}{s.change.toFixed(1)}% / 7d
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-heading text-xl font-semibold">{selected} · 30-day price trend</h2>
              <p className="mt-1 text-sm text-muted-foreground">{summary.find((s) => s.crop === selected)?.recommendation}</p>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary">USD per kg</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="date" stroke="currentColor" fontSize={11} className="text-muted-foreground" />
                <YAxis stroke="currentColor" fontSize={11} className="text-muted-foreground" domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="price" stroke="var(--chart-2)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-gradient-card p-5">
        <h3 className="font-heading text-lg font-semibold">Selling strategy</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Combine the price trend with your storage spoilage risk on the dashboard. Rule of thumb:
        </p>
        <ul className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <li className="rounded-xl border border-border bg-card p-3"><b className="text-success">Sell now</b> · Spoilage risk ≥ moderate AND prices flat or rising.</li>
          <li className="rounded-xl border border-border bg-card p-3"><b className="text-warning">Sell soon</b> · Risk low but prices trending up — lock in gains.</li>
          <li className="rounded-xl border border-border bg-card p-3"><b className="text-primary">Hold</b> · Risk low and prices recovering — wait for peak.</li>
        </ul>
      </div>
    </div>
  );
}
