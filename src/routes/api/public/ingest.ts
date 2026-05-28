import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  device_token: z.string().min(8).max(128),
  temperature: z.number().min(-50).max(100),
  humidity: z.number().min(0).max(100),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
        }

        // Lookup unit by token
        const { data: unit, error: ue } = await supabaseAdmin
          .from("storage_units")
          .select("*")
          .eq("device_token", parsed.data.device_token)
          .maybeSingle();
        if (ue || !unit) {
          return new Response(JSON.stringify({ error: "Invalid device token" }), { status: 401, headers: { "Content-Type": "application/json", ...CORS } });
        }

        const { error: ire } = await supabaseAdmin.from("sensor_readings").insert({
          storage_unit_id: unit.id,
          temperature: parsed.data.temperature,
          humidity: parsed.data.humidity,
        });
        if (ire) {
          return new Response(JSON.stringify({ error: ire.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
        }

        // Rule-based alerts
        const alerts: { severity: string; alert_type: string; message: string }[] = [];
        if (parsed.data.temperature > Number(unit.max_temp)) {
          alerts.push({ severity: "warning", alert_type: "temperature_high",
            message: `Temperature ${parsed.data.temperature}°C exceeded ${unit.max_temp}°C in ${unit.name}` });
        }
        if (parsed.data.temperature < Number(unit.min_temp)) {
          alerts.push({ severity: "warning", alert_type: "temperature_low",
            message: `Temperature ${parsed.data.temperature}°C below ${unit.min_temp}°C in ${unit.name}` });
        }
        if (parsed.data.humidity > Number(unit.max_humidity)) {
          alerts.push({ severity: "warning", alert_type: "humidity_high",
            message: `Humidity ${parsed.data.humidity}% exceeded ${unit.max_humidity}% in ${unit.name}` });
        }
        if (parsed.data.temperature > Number(unit.max_temp) + 5 || parsed.data.humidity > Number(unit.max_humidity) + 10) {
          alerts.push({ severity: "critical", alert_type: "spoilage_risk",
            message: `Critical spoilage risk in ${unit.name} — immediate action recommended` });
        }
        if (alerts.length) {
          await supabaseAdmin.from("alerts").insert(
            alerts.map((a) => ({ ...a, storage_unit_id: unit.id, user_id: unit.user_id })),
          );
        }

        return new Response(JSON.stringify({ ok: true, alerts: alerts.length }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
