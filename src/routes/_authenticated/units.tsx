import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnits, createUnit, deleteUnit } from "@/lib/units.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowRight, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const unitsQuery = queryOptions({ queryKey: ["units"], queryFn: () => listUnits() });

export const Route = createFileRoute("/_authenticated/units")({
  head: () => ({ meta: [{ title: "Storage Units — CropSense" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(unitsQuery),
  component: UnitsPage,
});

const cropDefaults: Record<string, { min_temp: number; max_temp: number; min_humidity: number; max_humidity: number }> = {
  Wheat:  { min_temp: 5, max_temp: 18, min_humidity: 40, max_humidity: 60 },
  Rice:   { min_temp: 5, max_temp: 18, min_humidity: 45, max_humidity: 65 },
  Maize:  { min_temp: 5, max_temp: 20, min_humidity: 40, max_humidity: 65 },
  Potato: { min_temp: 4, max_temp: 10, min_humidity: 85, max_humidity: 95 },
  Onion:  { min_temp: 0, max_temp: 5,  min_humidity: 65, max_humidity: 75 },
  Tomato: { min_temp: 10, max_temp: 15, min_humidity: 85, max_humidity: 95 },
};

function UnitsPage() {
  const { data } = useSuspenseQuery(unitsQuery);
  const qc = useQueryClient();
  const create = useServerFn(createUnit);
  const remove = useServerFn(deleteUnit);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", location: "", crop_type: "Wheat", capacity_kg: 1000,
    min_temp: 5, max_temp: 18, min_humidity: 40, max_humidity: 60,
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      toast.success("Storage unit created");
      setOpen(false);
      setForm({ ...form, name: "", location: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["units"] }); toast.success("Removed"); },
  });

  const applyCropDefaults = (crop: string) => {
    const d = cropDefaults[crop];
    if (d) setForm((f) => ({ ...f, crop_type: crop, ...d }));
    else setForm((f) => ({ ...f, crop_type: crop }));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold">Storage Units</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage units and connect IoT devices.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New unit</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create storage unit</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Warehouse A" /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Field 3, North Barn" /></div>
              <div>
                <Label>Crop type</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.crop_type} onChange={(e) => applyCropDefaults(e.target.value)}>
                  {Object.keys(cropDefaults).map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div><Label>Capacity (kg)</Label><Input type="number" value={form.capacity_kg} onChange={(e) => setForm({ ...form, capacity_kg: +e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Min temp (°C)</Label><Input type="number" step="0.1" value={form.min_temp} onChange={(e) => setForm({ ...form, min_temp: +e.target.value })} /></div>
                <div><Label>Max temp (°C)</Label><Input type="number" step="0.1" value={form.max_temp} onChange={(e) => setForm({ ...form, max_temp: +e.target.value })} /></div>
                <div><Label>Min humidity (%)</Label><Input type="number" value={form.min_humidity} onChange={(e) => setForm({ ...form, min_humidity: +e.target.value })} /></div>
                <div><Label>Max humidity (%)</Label><Input type="number" value={form.max_humidity} onChange={(e) => setForm({ ...form, max_humidity: +e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {data.units.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No units yet. Create your first one above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Crop</th>
                <th className="px-4 py-3">Safe range</th>
                <th className="px-4 py-3">Device token</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.units.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.location || "—"}</div>
                  </td>
                  <td className="px-4 py-3">{u.crop_type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.min_temp}–{u.max_temp}°C · {u.min_humidity}–{u.max_humidity}%
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { navigator.clipboard.writeText(u.device_token); toast.success("Token copied"); }}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-[11px] hover:bg-muted/70"
                    >
                      <Copy className="h-3 w-3" /> {u.device_token.slice(0, 12)}…
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/units/$id" params={{ id: u.id }}>
                      <Button variant="ghost" size="sm">Open <ArrowRight className="ml-1 h-3 w-3" /></Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => removeMut.mutate(u.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
