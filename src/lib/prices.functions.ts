import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ crop: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("market_prices")
      .select("*")
      .order("recorded_at", { ascending: true })
      .limit(500);
    if (data.crop) q = q.eq("crop_type", data.crop);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Distinct crops + latest price + 7-day trend
    const { data: all } = await supabase
      .from("market_prices").select("crop_type, price_per_kg, recorded_at")
      .order("recorded_at", { ascending: false }).limit(2000);
    const byCrop: Record<string, { price: number; date: string }[]> = {};
    for (const r of all ?? []) {
      (byCrop[r.crop_type] ??= []).push({ price: Number(r.price_per_kg), date: r.recorded_at });
    }
    const summary = Object.entries(byCrop).map(([crop, rows]) => {
      const latest = rows[0]?.price ?? 0;
      const weekAgo = rows.find((_, i) => i >= 7)?.price ?? latest;
      const change = weekAgo ? ((latest - weekAgo) / weekAgo) * 100 : 0;
      const recommendation =
        change > 5 ? "Sell soon — prices trending up"
        : change < -5 ? "Hold if storage is stable — prices may rebound"
        : "Steady — sell based on storage conditions";
      return { crop, latest, change, recommendation };
    }).sort((a, b) => a.crop.localeCompare(b.crop));

    return { rows: rows ?? [], summary };
  });
