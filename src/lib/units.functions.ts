import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: units, error } = await supabase
      .from("storage_units")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Fetch latest reading per unit
    const ids = (units ?? []).map((u) => u.id);
    let latest: Record<string, { temperature: number; humidity: number; recorded_at: string }> = {};
    if (ids.length) {
      const { data: r } = await supabase
        .from("sensor_readings")
        .select("storage_unit_id, temperature, humidity, recorded_at")
        .in("storage_unit_id", ids)
        .order("recorded_at", { ascending: false })
        .limit(500);
      for (const row of r ?? []) {
        if (!latest[row.storage_unit_id]) {
          latest[row.storage_unit_id] = {
            temperature: Number(row.temperature),
            humidity: Number(row.humidity),
            recorded_at: row.recorded_at,
          };
        }
      }
    }
    return { units: units ?? [], latest };
  });

export const getUnit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: unit, error } = await supabase
      .from("storage_units").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: readings } = await supabase
      .from("sensor_readings")
      .select("temperature, humidity, recorded_at")
      .eq("storage_unit_id", data.id)
      .order("recorded_at", { ascending: false })
      .limit(200);
    const { data: alerts } = await supabase
      .from("alerts").select("*").eq("storage_unit_id", data.id)
      .order("created_at", { ascending: false }).limit(20);
    return {
      unit,
      readings: (readings ?? []).reverse(),
      alerts: alerts ?? [],
    };
  });

export const createUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().min(1).max(120),
      location: z.string().max(200).optional(),
      crop_type: z.string().min(1).max(80),
      capacity_kg: z.number().min(0).max(1_000_000).optional(),
      min_temp: z.number().min(-50).max(60),
      max_temp: z.number().min(-50).max(60),
      min_humidity: z.number().min(0).max(100),
      max_humidity: z.number().min(0).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("storage_units").insert({ ...data, user_id: userId }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("storage_units").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alerts").select("*, storage_units(name)").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return { alerts: data ?? [] };
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alerts").update({ acknowledged: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Simulate a sensor reading from the dashboard (handy for demo / no hardware). */
export const simulateReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      unitId: z.string().uuid(),
      temperature: z.number().min(-50).max(80),
      humidity: z.number().min(0).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: unit } = await supabase
      .from("storage_units").select("*").eq("id", data.unitId).single();
    if (!unit) throw new Error("Unit not found");
    await supabase.from("sensor_readings").insert({
      storage_unit_id: data.unitId,
      temperature: data.temperature,
      humidity: data.humidity,
    });
    // Inline rule-based alert
    const alerts: { severity: string; alert_type: string; message: string }[] = [];
    if (data.temperature > Number(unit.max_temp)) {
      alerts.push({ severity: "warning", alert_type: "temperature_high",
        message: `Temperature ${data.temperature}°C above safe max ${unit.max_temp}°C` });
    }
    if (data.humidity > Number(unit.max_humidity)) {
      alerts.push({ severity: "warning", alert_type: "humidity_high",
        message: `Humidity ${data.humidity}% above safe max ${unit.max_humidity}%` });
    }
    if (data.temperature > Number(unit.max_temp) + 5 || data.humidity > Number(unit.max_humidity) + 10) {
      alerts.push({ severity: "critical", alert_type: "spoilage_risk",
        message: `Critical spoilage risk in ${unit.name} — act now` });
    }
    if (alerts.length) {
      await supabase.from("alerts").insert(
        alerts.map((a) => ({ ...a, storage_unit_id: data.unitId, user_id: userId })),
      );
    }
    return { ok: true, alerts: alerts.length };
  });
