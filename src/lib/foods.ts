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

/**
 * Parse free text like "2 idli, sambar and 1 cup curd" into items.
 * Longer aliases win ("masala dosa" before "dosa", "egg white" before "egg").
 */
export function parseFoodText(input: string): MealItem[] {
  let text = ' ' + input.toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const candidates = FOODS.flatMap((f) => f.aliases.map((a) => ({ f, a }))).sort((x, y) => y.a.length - x.a.length);
  const found: { idx: number; item: MealItem }[] = [];
  for (const { f, a } of candidates) {
    const re = new RegExp(`(?:\\b(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|half)\\s+(?:${UNIT_WORDS}\\s+){0,2})?\\b${a.replace(/ /g, '\\s')}s?\\b`);
    const m = re.exec(text);
    if (!m) continue;
    if (found.some((x) => x.item.name === f.name)) continue;
    const raw = m[1];
    const qty = raw ? (WORD_NUM[raw] ?? (parseFloat(raw) || 1)) : 1;
    found.push({ idx: m.index, item: { name: f.name, qty, kcal: f.kcal * qty, p: f.p * qty, c: f.c * qty, f: f.f * qty } });
    text = text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length); // consume
  }
  return found.sort((a, b) => a.idx - b.idx).map((x) => x.item);
}

export function sumItems(items: MealItem[]) {
  return items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { kcal: 0, p: 0, c: 0, f: 0 });
}

export function describeItems(items: MealItem[]): string {
  return items.map((i) => (i.qty !== 1 ? `${i.qty} × ${i.name}` : i.name)).join(', ');
}
