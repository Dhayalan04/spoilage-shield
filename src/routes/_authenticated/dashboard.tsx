import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnits, listAlerts, simulateReading, acknowledgeAlert } from "@/lib/units.functions";
import { computeSpoilageRisk, spoilageColor } from "@/lib/spoilage";
import { ThermometerSun, Droplets, AlertTriangle, Plus, ArrowRight, CheckCircle2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

const unitsQuery = queryOptions({
  queryKey: ["units"],
  queryFn: () => listUnits(),
});
const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: () => listAlerts(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CropSense" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(unitsQuery),
      context.queryClient.ensureQueryData(alertsQuery),
    ]);
  },
  component: Dashboard,
});

function Dashboard() {
  const { data: unitData } = useSuspenseQuery(unitsQuery);
  const { data: alertData } = useSuspenseQuery(alertsQuery);
  const qc = useQueryClient();
  const simulate = useServerFn(simulateReading);
  const ack = useServerFn(acknowledgeAlert);

  const units = unitData.units;
  const latest = unitData.latest;
  const alerts = alertData.alerts;

  const ackMut = useMutation({
    mutationFn: (id: string) => ack({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Alert acknowledged"); },
  });

  const simMut = useMutation({
    mutationFn: (vars: { unitId: string }) => {
      // Generate a slightly random reading near the unit's safe band
      const u = units.find((x) => x.id === vars.unitId)!;
      const t = (Number(u.min_temp) + Number(u.max_temp)) / 2 + (Math.random() * 8 - 2);
      const h = (Number(u.min_humidity) + Number(u.max_humidity)) / 2 + (Math.random() * 18 - 4);
      return simulate({ data: { unitId: vars.unitId, temperature: +t.toFixed(1), humidity: +h.toFixed(0) } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(res?.alerts ? `Reading saved · ${res.alerts} new alert(s)` : "Reading saved");
    },
  });

  const criticalCount = alerts.filter((a: any) => !a.acknowledged && a.severity === "critical").length;
  const warningCount = alerts.filter((a: any) => !a.acknowledged && a.severity === "warning").length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live overview of your storage units.</p>
        </div>
        <Link to="/units"><Button><Plus className="mr-2 h-4 w-4" /> Add storage unit</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Storage units" value={units.length} icon={Activity} />
        <KpiCard label="Active alerts" value={criticalCount + warningCount} icon={AlertTriangle} accent={criticalCount ? "destructive" : warningCount ? "warning" : undefined} />
        <KpiCard label="Critical" value={criticalCount} icon={AlertTriangle} accent={criticalCount ? "destructive" : undefined} />
        <KpiCard label="Warnings" value={warningCount} icon={AlertTriangle} accent={warningCount ? "warning" : undefined} />
      </div>

      <h2 className="mt-10 mb-3 font-heading text-xl font-semibold">Your storage units</h2>
      {units.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => {
            const r = latest[u.id];
            const risk = r ? computeSpoilageRisk({
              temperature: r.temperature, humidity: r.humidity,
              minTemp: Number(u.min_temp), maxTemp: Number(u.max_temp),
              minHumidity: Number(u.min_humidity), maxHumidity: Number(u.max_humidity),
            }) : null;
            return (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:shadow-elevated">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-lg font-semibold">{u.name}</h3>
                    <p className="text-xs text-muted-foreground">{u.crop_type}{u.location ? ` · ${u.location}` : ""}</p>
                  </div>
                  {risk && <Badge variant="outline" className={spoilageColor(risk.level)}>{risk.level}</Badge>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric icon={ThermometerSun} label="Temp" value={r ? `${r.temperature.toFixed(1)}°C` : "—"} sub={`${u.min_temp}–${u.max_temp}°C`} />
                  <Metric icon={Droplets} label="Humidity" value={r ? `${r.humidity.toFixed(0)}%` : "—"} sub={`${u.min_humidity}–${u.max_humidity}%`} />
                </div>
                {risk && (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Spoilage risk</span><span>{risk.risk}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full transition-all ${
                        risk.level === "critical" || risk.level === "high" ? "bg-destructive"
                        : risk.level === "moderate" ? "bg-warning" : "bg-success"
                      }`} style={{ width: `${risk.risk}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-5 flex gap-2">
                  <Link to="/units/$id" params={{ id: u.id }} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      View details <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" disabled={simMut.isPending} onClick={() => simMut.mutate({ unitId: u.id })}>
                    Simulate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mt-10 mb-3 font-heading text-xl font-semibold">Recent alerts</h2>
      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success" />
          No alerts. All units within safe range.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {alerts.slice(0, 10).map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-3 border-b border-border p-4 last:border-0">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                  a.severity === "critical" ? "bg-destructive"
                  : a.severity === "warning" ? "bg-warning" : "bg-muted-foreground"
                }`} />
                <div>
                  <div className="text-sm font-medium">{a.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.storage_units?.name ?? "Unit"} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              {!a.acknowledged ? (
                <Button size="sm" variant="ghost" onClick={() => ackMut.mutate(a.id)}>Acknowledge</Button>
              ) : (
                <Badge variant="secondary">Acknowledged</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: any; accent?: "destructive" | "warning" }) {
  const tone = accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className={`mt-2 font-heading text-3xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-heading text-xl font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">Safe: {sub}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Plus className="h-5 w-5" />
      </div>
      <h3 className="font-heading text-lg font-semibold">No storage units yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first storage unit to begin monitoring temperature, humidity, and spoilage risk.
      </p>
      <Link to="/units" className="mt-4 inline-block"><Button>Create unit</Button></Link>
    </div>
  );
}
