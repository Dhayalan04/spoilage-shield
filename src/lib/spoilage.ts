export type SpoilageInputs = {
  temperature: number;
  humidity: number;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
};

export type SpoilageResult = {
  risk: number; // 0..100
  level: "low" | "moderate" | "high" | "critical";
  reasons: string[];
};

/**
 * Simple rule-based spoilage risk score.
 * Combines deviation from thresholds + humidity-driven mold risk + warm+humid synergy.
 */
export function computeSpoilageRisk(i: SpoilageInputs): SpoilageResult {
  const reasons: string[] = [];
  let risk = 0;

  const tempBand = i.maxTemp - i.minTemp || 1;
  const humBand = i.maxHumidity - i.minHumidity || 1;

  if (i.temperature > i.maxTemp) {
    const over = (i.temperature - i.maxTemp) / tempBand;
    risk += Math.min(50, over * 60);
    reasons.push(`Temperature ${i.temperature.toFixed(1)}°C above max ${i.maxTemp}°C`);
  } else if (i.temperature < i.minTemp) {
    risk += 15;
    reasons.push(`Temperature ${i.temperature.toFixed(1)}°C below min ${i.minTemp}°C`);
  }

  if (i.humidity > i.maxHumidity) {
    const over = (i.humidity - i.maxHumidity) / humBand;
    risk += Math.min(50, over * 55);
    reasons.push(`Humidity ${i.humidity.toFixed(0)}% above max ${i.maxHumidity}%`);
  } else if (i.humidity < i.minHumidity) {
    risk += 10;
    reasons.push(`Humidity ${i.humidity.toFixed(0)}% below min ${i.minHumidity}%`);
  }

  // Warm + humid synergy → mold
  if (i.temperature > i.maxTemp - 2 && i.humidity > i.maxHumidity - 5) {
    risk += 15;
    reasons.push("Warm and humid conditions accelerate spoilage");
  }

  risk = Math.max(0, Math.min(100, Math.round(risk)));
  const level: SpoilageResult["level"] =
    risk >= 75 ? "critical" : risk >= 50 ? "high" : risk >= 25 ? "moderate" : "low";

  if (reasons.length === 0) reasons.push("All readings within safe range");

  return { risk, level, reasons };
}

export function spoilageColor(level: SpoilageResult["level"]) {
  switch (level) {
    case "critical": return "text-destructive";
    case "high": return "text-destructive";
    case "moderate": return "text-warning";
    default: return "text-success";
  }
}
