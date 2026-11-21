// Built-in Indian food table (approximate values per serving) and a simple
// text parser. Used for the web app's food picker, and by the WhatsApp bot
// when no AI key is configured or the AI call fails.

export interface Food { key: string; name: string; unit: string; kcal: number; p: number; c: number; f: number; aliases: string[] }

export const FOODS: Food[] = [
  { key: 'idli', name: 'Idli', unit: 'piece', kcal: 60, p: 2, c: 12, f: 0.5, aliases: ['idli', 'idly'] },
  { key: 'dosa', name: 'Plain dosa', unit: 'piece', kcal: 170, p: 4, c: 28, f: 5, aliases: ['dosa', 'dose'] },
  { key: 'masala_dosa', name: 'Masala dosa', unit: 'piece', kcal: 330, p: 7, c: 48, f: 12, aliases: ['masala dosa'] },
  { key: 'ragi', name: 'Ragi mudde', unit: 'ball', kcal: 200, p: 5, c: 42, f: 1, aliases: ['ragi mudde', 'ragi ball', 'mudde'] },
  { key: 'chapati', name: 'Chapati', unit: 'piece', kcal: 105, p: 3, c: 18, f: 3, aliases: ['chapati', 'chapathi', 'roti', 'phulka'] },
  { key: 'rice', name: 'Rice, cooked', unit: 'cup', kcal: 205, p: 4, c: 45, f: 0.4, aliases: ['rice', 'anna'] },
  { key: 'dal', name: 'Dal', unit: 'katori', kcal: 150, p: 9, c: 20, f: 4, aliases: ['dal', 'daal', 'dhal'] },
  { key: 'sambar', name: 'Sambar', unit: 'katori', kcal: 130, p: 6, c: 18, f: 4, aliases: ['sambar', 'saaru', 'rasam'] },
  { key: 'sabzi', name: 'Vegetable sabzi', unit: 'katori', kcal: 120, p: 3, c: 12, f: 7, aliases: ['sabzi', 'sabji', 'palya', 'curry', 'bhindi'] },
  { key: 'poha', name: 'Poha', unit: 'plate', kcal: 250, p: 5, c: 45, f: 6, aliases: ['poha', 'avalakki'] },
  { key: 'upma', name: 'Upma', unit: 'plate', kcal: 250, p: 6, c: 38, f: 8, aliases: ['upma', 'uppittu'] },
  { key: 'curd', name: 'Curd', unit: 'cup', kcal: 150, p: 8, c: 11, f: 8, aliases: ['curd', 'yogurt', 'yoghurt', 'mosaru', 'dahi'] },
  { key: 'buttermilk', name: 'Buttermilk', unit: 'glass', kcal: 40, p: 2, c: 4, f: 1.5, aliases: ['buttermilk', 'majjige', 'chaas'] },
  { key: 'paneer', name: 'Paneer, 100 g', unit: 'serving', kcal: 265, p: 18, c: 4, f: 20, aliases: ['paneer'] },
  { key: 'sprouts', name: 'Sprouts', unit: 'cup', kcal: 100, p: 7, c: 15, f: 1, aliases: ['sprouts'] },
  { key: 'egg', name: 'Egg, whole', unit: 'egg', kcal: 72, p: 6, c: 0.4, f: 5, aliases: ['egg', 'eggs', 'omelette', 'omelet'] },
  { key: 'egg_white', name: 'Egg white', unit: 'egg', kcal: 17, p: 3.6, c: 0.2, f: 0, aliases: ['egg white', 'egg whites'] },
  { key: 'chicken', name: 'Chicken breast, 100 g', unit: 'serving', kcal: 165, p: 31, c: 0, f: 3.6, aliases: ['chicken'] },
  { key: 'fish', name: 'Fish curry', unit: 'katori', kcal: 220, p: 22, c: 6, f: 12, aliases: ['fish'] },
  { key: 'whey', name: 'Whey protein', unit: 'scoop', kcal: 120, p: 24, c: 3, f: 1.5, aliases: ['whey', 'protein shake', 'protein'] },
  { key: 'banana', name: 'Banana', unit: 'piece', kcal: 105, p: 1, c: 27, f: 0.4, aliases: ['banana', 'bale hannu'] },
  { key: 'apple', name: 'Apple', unit: 'piece', kcal: 95, p: 0.5, c: 25, f: 0.3, aliases: ['apple'] },
  { key: 'milk', name: 'Milk', unit: 'glass', kcal: 150, p: 8, c: 12, f: 8, aliases: ['milk'] },
  { key: 'coffee', name: 'Filter coffee', unit: 'cup', kcal: 80, p: 2, c: 9, f: 4, aliases: ['coffee'] },
  { key: 'tea', name: 'Tea with milk', unit: 'cup', kcal: 60, p: 2, c: 8, f: 2, aliases: ['tea', 'chai'] },
  { key: 'peanuts', name: 'Peanuts, 30 g', unit: 'handful', kcal: 170, p: 7, c: 5, f: 14, aliases: ['peanut', 'peanuts', 'groundnut'] },
  { key: 'chana', name: 'Roasted chana, 30 g', unit: 'handful', kcal: 110, p: 6, c: 18, f: 2, aliases: ['chana', 'chickpea'] },
  { key: 'dates', name: 'Dates', unit: 'piece', kcal: 23, p: 0.2, c: 6, f: 0, aliases: ['date', 'dates', 'kharjura'] },
  { key: 'biscuit', name: 'Biscuit', unit: 'piece', kcal: 45, p: 0.5, c: 6.5, f: 2, aliases: ['biscuit', 'biscuits', 'cookie'] },
  { key: 'salad', name: 'Salad', unit: 'bowl', kcal: 40, p: 2, c: 8, f: 0.3, aliases: ['salad', 'cucumber', 'kosambari'] },
];

export interface MealItem { name: string; qty: number; kcal: number; p: number; c: number; f: number }

// Only measure words may sit between a number and the food ("2 cups of curd"), so
// "2 idli and sambar" never gives sambar a quantity of 2.
const UNIT_WORDS = '(?:cups?|katoris?|bowls?|plates?|pieces?|pcs|glass(?:es)?|scoops?|handfuls?|balls?|small|medium|large|big|of)';

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5 };

/** A food from Nandita's catalogue (values are per serving_qty of unit). */
export interface CatalogueFood { name: string; serving_qty: number; unit: string; kcal: number; p: number; c: number; f: number }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const MASS = /^(g|ml)$/;

interface Matcher { alias: string; fromCatalogue: boolean; food: Food | CatalogueFood }

/**
 * Aliases for catalogue foods: the full name, the part before a comma or bracket
 * ("Dal, cooked" → "dal"), each part of "a / b" names, plus the built-in table's
 * spellings when they describe the same food ("Chapati" also matches "roti").
 * An alias shared by several catalogue foods is dropped unless it is one food's
 * exact name, so "paneer" never picks one of three paneer variants at random.
 */
function matchers(catalogue: CatalogueFood[]): Matcher[] {
  // rank: 3 exact name, 2 name before a comma/bracket or a built-in spelling of the same food, 1 one part of "a / b"
  const byAlias = new Map<string, { food: CatalogueFood; rank: number; st?: string }[]>();
  const add = (alias: string, food: CatalogueFood, rank: number, st?: string) => {
    if (alias.length < 3) return;
    const list = byAlias.get(alias) ?? [];
    const prev = list.find((x) => x.food === food);
    if (prev) { if (rank > prev.rank) Object.assign(prev, { rank, st }); }
    else list.push({ food, rank, st });
    byAlias.set(alias, list);
  };
  for (const food of catalogue) {
    const full = norm(food.name);
    const rawHead = food.name.split(/[,(]/)[0];
    const head = norm(rawHead);
    const parts = rawHead.includes('/') ? rawHead.split('/').map(norm).filter(Boolean) : [];
    add(full, food, 3);
    add(head, food, 2);
    // "Paneer, high protein" is usually typed "high protein paneer".
    const tail = food.name.includes(',') ? norm(food.name.split(',').slice(1).join(' ').replace(/\(.*?\)/g, '')) : '';
    if (tail) add(`${tail} ${head}`, food, 3);
    for (const p of parts) add(p, food, 1);
    for (const st of FOODS) {
      const names = [norm(st.name), norm(st.name.split(/[,(]/)[0]), ...st.aliases.map(norm)];
      if ([full, head, ...parts].some((a) => names.includes(a))) for (const a of st.aliases) add(norm(a), food, 2, st.key);
    }
  }
  const out: Matcher[] = [];
  const absorbed = new Set<string>();
  for (const [alias, list] of byAlias) {
    const top = Math.max(...list.map((x) => x.rank));
    const best = list.filter((x) => x.rank === top);
    if (best.length !== 1) continue; // ambiguous: let the built-in table or a longer alias handle it
    out.push({ alias, fromCatalogue: true, food: best[0].food });
    if (best[0].st) absorbed.add(best[0].st);
  }
  for (const f of FOODS) {
    if (absorbed.has(f.key)) continue;
    for (const a of f.aliases) out.push({ alias: norm(a), fromCatalogue: false, food: f });
  }
  // Longer aliases first ("masala dosa" before "dosa"); catalogue wins ties.
  return out.sort((x, y) => y.alias.length - x.alias.length || Number(y.fromCatalogue) - Number(x.fromCatalogue));
}

function catalogueItem(f: CatalogueFood, amount: number | null, servings: number): MealItem {
  const mass = MASS.test(f.unit);
  const qtyInUnit = amount ?? servings * f.serving_qty;
  const factor = qtyInUnit / (f.serving_qty || 1);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return mass
    ? { name: `${f.name} (${Math.round(qtyInUnit)} ${f.unit})`, qty: 1, kcal: Math.round(f.kcal * factor), p: r1(f.p * factor), c: r1(f.c * factor), f: r1(f.f * factor) }
    : { name: f.name, qty: r1(factor), kcal: Math.round(f.kcal * factor), p: r1(f.p * factor), c: r1(f.c * factor), f: r1(f.f * factor) };
}

/**
 * Parse free text like "2 idli, sambar and 1 cup curd" or "150 g paneer" into items.
 * Matches Nandita's catalogue first (with her serving sizes), then the built-in table.
 */
export function parseFoodText(input: string, catalogue: CatalogueFood[] = []): MealItem[] {
  let text = ' ' + input.toLowerCase().replace(/(\d)\s*(g|gm|gms|grams?|ml)\b/g, '$1 $2').replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const found: { idx: number; key: string; item: MealItem }[] = [];
  for (const m of matchers(catalogue)) {
    const re = new RegExp(`(?:\\b(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|half)\\s+(?:(g|gm|gms|grams?|ml)\\s+)?(?:${UNIT_WORDS}\\s+){0,2})?\\b${m.alias.replace(/ /g, '\\s')}s?\\b`);
    const hit = re.exec(text);
    if (!hit) continue;
    const key = m.food.name;
    if (found.some((x) => x.key === key)) continue;
    const raw = hit[1];
    const n = raw ? (WORD_NUM[raw] ?? (parseFloat(raw) || 1)) : 1;
    let item: MealItem;
    if (m.fromCatalogue) {
      const f = m.food as CatalogueFood;
      const amount = hit[2] && MASS.test(f.unit) && raw && !WORD_NUM[raw] ? n : null;
      item = catalogueItem(f, amount, n);
    } else {
      const f = m.food as Food;
      // "200 ml milk" or "150 g paneer" against the built-in table: convert to its serving
      // (the gram size in the name, or 250 ml for a glass / cup, else 100 g).
      const size = Number(/(\d+)\s*(?:g|ml)\b/.exec(f.name)?.[1]) || (/glass|cup/.test(f.unit) ? 250 : 100);
      const q = hit[2] && raw && !WORD_NUM[raw] ? Math.round((n / size) * 100) / 100 : n;
      item = { name: f.name, qty: q, kcal: Math.round(f.kcal * q), p: Math.round(f.p * q * 10) / 10, c: Math.round(f.c * q * 10) / 10, f: Math.round(f.f * q * 10) / 10 };
    }
    found.push({ idx: hit.index, key, item });
    text = text.slice(0, hit.index) + ' '.repeat(hit[0].length) + text.slice(hit.index + hit[0].length); // consume
  }
  return found.sort((a, b) => a.idx - b.idx).map((x) => x.item);
}

export function sumItems(items: MealItem[]) {
  return items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { kcal: 0, p: 0, c: 0, f: 0 });
}

export function describeItems(items: MealItem[]): string {
  return items.map((i) => (i.qty !== 1 ? `${i.qty} × ${i.name}` : i.name)).join(', ');
}
