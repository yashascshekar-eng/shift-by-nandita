// AI helpers. Every function degrades gracefully: with no ANTHROPIC_API_KEY,
// or if the call fails, callers get null and fall back to the food table.
import { z } from 'zod';
import type { MealItem } from './foods';

const ItemSchema = z.object({
  name: z.string().min(1).max(80),
  qty: z.number().positive().max(20).default(1),
  kcal: z.number().min(0).max(3000),
  p: z.number().min(0).max(300),
  c: z.number().min(0).max(500),
  f: z.number().min(0).max(300),
});
const EstimateSchema = z.object({ items: z.array(ItemSchema).max(12), not_food: z.boolean().optional() });

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

async function callClaude(content: unknown[], system: string, maxTokens = 800): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error('Claude error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === 'text')?.text ?? null;
  } catch (e) {
    console.error('Claude call failed', e);
    return null;
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

const MEAL_SYSTEM = `You estimate the nutrition of meals for clients of an Indian nutrition coach in Bengaluru.
Assume home-style South and North Indian portions unless told otherwise (1 katori ≈ 150 ml, 1 chapati ≈ 30 g flour).
Return ONLY JSON: {"items":[{"name":"2 chapati","qty":1,"kcal":210,"p":6,"c":36,"f":6}], "not_food": false}.
"name" is short and human (include the count in the name, keep qty 1). Values are totals for that line.
If the image or text is not food, return {"items":[],"not_food":true}.`;

export type Estimate = { items: MealItem[]; notFood: boolean } | null;

export async function estimateMeal(input: { imageBase64?: string; mimeType?: string; text?: string; correction?: string; previous?: MealItem[] }): Promise<Estimate> {
  const content: unknown[] = [];
  if (input.imageBase64 && input.mimeType) {
    content.push({ type: 'image', source: { type: 'base64', media_type: input.mimeType, data: input.imageBase64 } });
  }
  let prompt = input.text ? `The client wrote: "${input.text.slice(0, 500)}"` : 'Estimate this meal.';
  if (input.correction) {
    prompt = `Previous estimate: ${JSON.stringify(input.previous ?? [])}\nThe client corrected it: "${input.correction.slice(0, 300)}"\nReturn the corrected full estimate.`;
  }
  content.push({ type: 'text', text: prompt });
  const out = await callClaude(content, MEAL_SYSTEM);
  if (!out) return null;
  const parsed = EstimateSchema.safeParse(extractJson(out));
  if (!parsed.success) return null;
  return { items: parsed.data.items, notFood: Boolean(parsed.data.not_food) };
}

const PlanSchema = z.object({
  diet_chart: z.array(z.object({ meal: z.string().max(40), time: z.string().max(10).optional(), items: z.array(z.object({ id: z.string(), qty: z.number().positive().max(2000) })).max(10) })).min(3).max(7),
  workout_plan: z.record(z.array(z.object({ n: z.string(), s: z.union([z.string(), z.number()]), r: z.string() }))),
});
export type PlanDraft = z.infer<typeof PlanSchema>;

/**
 * Draft a diet chart that uses ONLY foods from the catalogue (referenced by short id),
 * plus a weekly workout plan. The caller maps ids back to foods and recomputes macros.
 */
export async function draftPlan(
  client: Record<string, unknown>, kcal: number, protein: number,
  catalogue: { id: string; name: string; serving_qty: number; unit: string; kcal: number; p: number; food_type: string }[],
): Promise<PlanDraft | null> {
  const system = `You draft plans for Nandita, a nutrition and fitness coach in Bengaluru. She reviews and edits every plan before the client sees it.
Build the diet chart ONLY from the catalogue foods given, referenced by their id. qty is in that food's unit (g, ml, piece…).
Hit the daily calories within 5% and the protein target. Use 4–6 meals with Indian meal names and times. Match the client's food preference (veg clients: only veg; egg clients: veg + egg). Respect injuries and notes.
Return ONLY JSON: {"diet_chart":[{"meal":"Breakfast","time":"8:30","items":[{"id":"f3","qty":75}]}],"workout_plan":{"Mon":[{"n":"Goblet squat","s":"3","r":"10-12"}]}}.
Weekday keys are Mon Tue Wed Thu Fri Sat Sun; leave rest days out.`;
  const facts = {
    sex: client.sex, age: client.age, height_cm: client.height_cm, weight_kg: client.weight_kg,
    goal: client.goal, diet: client.diet, activity: client.activity, notes: client.notes,
    daily_kcal: kcal, daily_protein_g: protein,
  };
  const list = catalogue.map((f, i) => `f${i} | ${f.name} | per ${f.serving_qty} ${f.unit}: ${Math.round(f.kcal)} kcal, P ${f.p} g | ${f.food_type}`).join('\n');
  const out = await callClaude([{ type: 'text', text: `Client: ${JSON.stringify(facts)}\n\nCatalogue (id | name | per serving | type):\n${list}` }], system, 2500);
  if (!out) return null;
  const parsed = PlanSchema.safeParse(extractJson(out));
  return parsed.success ? parsed.data : null;
}
