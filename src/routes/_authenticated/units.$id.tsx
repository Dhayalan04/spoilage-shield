import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnit, simulateReading } from "@/lib/units.functions";
import { computeSpoilageRisk, spoilageColor } from "@/lib/spoilage";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ThermometerSun, Droplets, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/units/$id")({
  head: () => ({ meta: [{ title: "Storage unit — CropSense" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(unitQuery(params.id)),
  component: UnitDetail,
});

const unitQuery = (id: string) => queryOptions({
  queryKey: ["unit", id],
  queryFn: () => getUnit({ data: { id } }),
});

function UnitDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(unitQuery(id));
  const qc = useQueryClient();
  const simulate = useServerFn(simulateReading);
  const { unit, readings, alerts } = data as any;

  const latest = readings[readings.length - 1];
  const risk = latest ? computeSpoilageRisk({
    temperature: Number(latest.temperature), humidity: Number(latest.humidity),
    minTemp: Number(unit.min_temp), maxTemp: Number(unit.max_temp),
    minHumidity: Number(unit.min_humidity), maxHumidity: Number(unit.max_humidity),
  }) : null;

  const simMut = useMutation({
    mutationFn: () => {
      const t = (Number(unit.min_temp) + Number(unit.max_temp)) / 2 + (Math.random() * 10 - 3);
      const h = (Number(unit.min_humidity) + Number(unit.max_humidity)) / 2 + (Math.random() * 20 - 5);
      return simulate({ data: { unitId: id, temperature: +t.toFixed(1), humidity: +h.toFixed(0) } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unit", id] }); toast.success("Reading saved"); },
  });

  const chartData = readings.map((r: any) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    temp: Number(r.temperature), humidity: Number(r.humidity),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link to="/units" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All units
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">{unit.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unit.crop_type}{unit.location ? ` · ${unit.location}` : ""}</p>
        </div>
        <Button onClick={() => simMut.mutate()} disabled={simMut.isPending}>Simulate reading</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ThermometerSun className="h-4 w-4" /> Temperature</div>
          <div className="mt-2 font-heading text-4xl font-bold">{latest ? `${Number(latest.temperature).toFixed(1)}°C` : "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">Safe: {unit.min_temp}–{unit.max_temp}°C</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Droplets className="h-4 w-4" /> Humidity</div>
          <div className="mt-2 font-heading text-4xl font-bold">{latest ? `${Number(latest.humidity).toFixed(0)}%` : "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">Safe: {unit.min_humidity}–{unit.max_humidity}%</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Spoilage risk</div>
            {risk && <Badge variant="outline" className={spoilageColor(risk.level)}>{risk.level}</Badge>}
          </div>
          <div className="mt-2 font-heading text-4xl font-bold">{risk ? `${risk.risk}%` : "—"}</div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {risk?.reasons.slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 font-heading text-lg font-semibold">Historical conditions</h2>
        {chartData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No readings yet. Click "Simulate reading" or send data from your device.</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="time" stroke="currentColor" fontSize={11} className="text-muted-foreground" />
                <YAxis yAxisId="t" stroke="currentColor" fontSize={11} className="text-muted-foreground" />
                <YAxis yAxisId="h" orientation="right" stroke="currentColor" fontSize={11} className="text-muted-foreground" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Line yAxisId="t" type="monotone" dataKey="temp" name="Temp (°C)" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line yAxisId="h" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-lg font-semibold">Device connection</h2>
          <p className="text-sm text-muted-foreground">Send IoT readings to this endpoint with your device token:</p>
          <button
            onClick={() => { navigator.clipboard.writeText(unit.device_token); toast.success("Token copied"); }}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs hover:bg-muted/70"
          >
            <Copy className="h-3.5 w-3.5" /> {unit.device_token}
          </button>
          <pre className="mt-3 overflow-x-auto rounded-md bg-sidebar p-3 text-[11px] text-sidebar-foreground">
{`POST /api/public/ingest
{ "device_token": "${unit.device_token.slice(0, 8)}…",
  "temperature": 22.4, "humidity": 65 }`}
          </pre>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-lg font-semibold">Recent alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts for this unit.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.slice(0, 8).map((a: any) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${
                    a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-warning" : "bg-muted-foreground"
                  }`} />
                  <div>
                    <div>{a.message}</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
