import { MODULE_ID } from "../../data/moduleId.js";
import { localize, format } from "../../utils/I18n.js";
import { rollButcherYields } from "./butcherYields.js";
import { loadOverlayItemDataByRef } from "../packs/overlays/OverlayItemByRef.js";
import { ItemOutcomeHandler } from "../crafting/outcomes/ItemOutcomeHandler.js";

export async function butcherInventoryItem(actor, item) {
  if (!actor || !item) return { ok: false };
  const yields = item.flags?.[MODULE_ID]?.butcher?.yields;
  if (!Array.isArray(yields) || !yields.length) {
    ui.notifications?.warn(localize("IONRIFT.RESPITE.SHEET.ButcherNoYields"));
    return { ok: false };
  }

  const qty = Number(item.system?.quantity ?? 0);
  if (qty < 1) return { ok: false };

  const rolled = await rollButcherYields(yields);
  if (!rolled.length) {
    ui.notifications?.warn(localize("IONRIFT.RESPITE.SHEET.ButcherEmptyRoll"));
    return { ok: false };
  }

  const { resolveProvisionPoolEntry } = await import(
    "../travel/resolve/TravelProvisionIndex.js"
  );

  const grants = [];
  const allRolls = [];
  const parts = [];

  for (const row of rolled) {
    let data = await loadOverlayItemDataByRef(row.itemRef);
    if (!data?.name) data = await resolveProvisionPoolEntry({ itemRef: row.itemRef });
    if (!data?.name) {
      ui.notifications?.error(format("IONRIFT.RESPITE.SHEET.ButcherMissingTemplate", {
        ref: row.itemRef
      }));
      return { ok: false };
    }
    grants.push({
      name: data.name,
      type: data.type ?? "loot",
      img: data.img,
      system: foundry.utils.duplicate(data.system ?? {}),
      flags: foundry.utils.duplicate(data.flags ?? {}),
      quantity: row.quantity
    });
    for (const r of row.rolls ?? []) if (r) allRolls.push(r);
    parts.push(`${data.name} ×${row.quantity}`);
  }

  await ItemOutcomeHandler.grantItemsToActor(actor, grants);

  if (qty <= 1) await item.delete();
  else await item.update({ "system.quantity": qty - 1 });

  const summary = parts.join(", ");
  await ChatMessage.create({
    content: `<div class="respite-recovery-chat"><p><i class="fas fa-knife-kitchen"></i> ${
      format("IONRIFT.RESPITE.SHEET.ButcherChat", {
        actor: actor.name,
        fungus: item.name,
        summary
      })
    }</p></div>`,
    rolls: allRolls,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  actor.sheet?.render(false);
  return { ok: true, summary };
}
