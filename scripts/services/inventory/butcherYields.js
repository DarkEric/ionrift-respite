/**
 * Pure butcher yield helpers (no Foundry documents).
 */

export function normalizeButcherYields(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    const itemRef = row?.itemRef;
    if (!itemRef || typeof itemRef !== "string") continue;
    let formula = row.formula;
    if (formula == null && row.quantity != null) formula = String(row.quantity);
    if (formula == null || formula === "") continue;
    out.push({ itemRef, formula: String(formula) });
  }
  return out;
}

function isFixedFormula(formula) {
  return /^\d+$/.test(String(formula).trim());
}

export async function evaluateButcherFormula(formula, deps = {}) {
  const f = String(formula ?? "").trim();
  if (!f) return { total: 0, roll: null };
  if (isFixedFormula(f)) return { total: Math.max(0, Number(f)), roll: null };

  const RollCls = deps.Roll ?? globalThis.Roll;
  if (!RollCls) throw new Error("Roll class unavailable for butcher formula");
  const roll = await new RollCls(f).evaluate();
  const total = Math.max(0, Math.floor(Number(roll.total) || 0));
  return { total, roll };
}

export async function rollButcherYields(yields, deps = {}) {
  const normalized = normalizeButcherYields(yields);
  const map = new Map();
  for (const y of normalized) {
    const { total, roll } = await evaluateButcherFormula(y.formula, deps);
    if (total <= 0) continue;
    const prev = map.get(y.itemRef);
    if (prev) {
      prev.quantity += total;
      if (roll) prev.rolls.push(roll);
    } else {
      map.set(y.itemRef, { itemRef: y.itemRef, quantity: total, rolls: roll ? [roll] : [] });
    }
  }
  return [...map.values()].map(({ itemRef, quantity, rolls }) => ({
    itemRef,
    quantity,
    roll: rolls[0] ?? null,
    rolls
  }));
}
