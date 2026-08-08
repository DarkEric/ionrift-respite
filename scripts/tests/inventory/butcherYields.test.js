import { describe, it, expect } from "vitest";
import {
  normalizeButcherYields,
  evaluateButcherFormula,
  rollButcherYields
} from "../../services/inventory/butcherYields.js";

describe("normalizeButcherYields", () => {
  it("keeps formula strings and coerces quantity to formula", () => {
    expect(normalizeButcherYields([
      { itemRef: "ud_flesh_barrelstalk", formula: "1d6+4" },
      { itemRef: "ud_hide_trillimac", quantity: 1 }
    ])).toEqual([
      { itemRef: "ud_flesh_barrelstalk", formula: "1d6+4" },
      { itemRef: "ud_hide_trillimac", formula: "1" }
    ]);
  });

  it("drops entries without itemRef", () => {
    expect(normalizeButcherYields([{ formula: "1d4" }])).toEqual([]);
  });
});

describe("evaluateButcherFormula", () => {
  it("returns fixed totals without Roll", async () => {
    const { total, roll } = await evaluateButcherFormula("1");
    expect(total).toBe(1);
    expect(roll).toBeNull();
  });

  it("uses Roll for dice formulas", async () => {
    class FakeRoll {
      constructor(formula) { this.formula = formula; this.total = 7; }
      async evaluate() { return this; }
    }
    const { total, roll } = await evaluateButcherFormula("1d6+4", { Roll: FakeRoll });
    expect(total).toBe(7);
    expect(roll.formula).toBe("1d6+4");
  });
});

describe("rollButcherYields", () => {
  it("aggregates quantities per itemRef", async () => {
    class FakeRoll {
      constructor() { this.total = 3; }
      async evaluate() { return this; }
    }
    const rows = await rollButcherYields(
      [
        { itemRef: "a", formula: "1d4" },
        { itemRef: "a", formula: "1" }
      ],
      { Roll: FakeRoll }
    );
    expect(rows).toEqual([
      expect.objectContaining({ itemRef: "a", quantity: 4 })
    ]);
  });
});
