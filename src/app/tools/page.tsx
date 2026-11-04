import { Calculators } from './Calculators';

export const metadata = { title: 'Calculators' };

export default function Tools() {
  return (
    <main className="narrow stack">
      <h1 style={{ fontSize: 30 }}>Calculators</h1>
      <Calculators />
      <p className="small muted">Estimates from published formulas. Your coach adjusts them to how your body actually responds.</p>
    </main>
  );
}
