'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FoodPicker, type NewFood } from '@/components/FoodPicker';
import type { Food } from '@/lib/types';
import { MEAL_SLOTS, SLOT_LABEL, type MealSlot } from '@/lib/nutrition';
import { createCustomFood, logFood, toggleFavourite } from './actions';

export function MealLogger({ foods, favourites, recents, date, defaultSlot }: { foods: Food[]; favourites: string[]; recents: string[]; date: string; defaultSlot: MealSlot }) {
  const router = useRouter();
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  return (
    <div className="card">
      <div className="row between">
        <h3>Log food</h3>
        <div className="seg">{MEAL_SLOTS.map((s) => <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>{SLOT_LABEL[s]}</button>)}</div>
      </div>
      <FoodPicker
        foods={foods}
        favourites={favourites}
        recents={recents}
        addLabel={`Add to ${SLOT_LABEL[slot].toLowerCase()}`}
        onAdd={async (f, qty) => { await logFood(f.id, qty, slot, date); router.refresh(); }}
        onToggleFav={toggleFavourite}
        onCreate={(nf: NewFood) => createCustomFood(nf)}
        customLabel="My foods"
      />
    </div>
  );
}
