export function localize(key) {
  const lib = globalThis.game?.ionrift?.library;
  if (lib?.localize) return lib.localize(key);
  if (globalThis.game?.i18n?.localize) return game.i18n.localize(key);
  return key;
}

export function format(key, data = {}) {
  const lib = globalThis.game?.ionrift?.library;
  if (lib?.format) return lib.format(key, data);
  if (globalThis.game?.i18n?.format) return game.i18n.format(key, data);
  return key;
}

/**
 * Localize a key when present; otherwise keep the English fallback from data JSON.
 * @param {string|null|undefined} key
 * @param {string} [fallback]
 * @returns {string}
 */
export function localizeData(key, fallback = "") {
  if (!key) return fallback ?? "";
  const out = localize(key);
  if (!out || out === key) return fallback || key;
  return out;
}

/**
 * Resolve UI fields on a data record via *Key properties (QM-style labelKey pattern).
 * Mutates and returns the same object for Map/cache callers.
 * @param {object} record
 * @param {Record<string, string>} fieldMap - displayField → keyField (e.g. { name: "nameKey" })
 * @returns {object}
 */
export function applyDataKeys(record, fieldMap) {
  if (!record || typeof record !== "object") return record;
  for (const [field, keyField] of Object.entries(fieldMap)) {
    const key = record[keyField];
    if (!key) continue;
    record[field] = localizeData(key, record[field] ?? "");
  }
  return record;
}

/** @param {object} activity */
export function localizeActivityRecord(activity) {
  applyDataKeys(activity, { name: "nameKey", description: "descriptionKey" });
  if (activity?.combatModifiers) {
    applyDataKeys(activity.combatModifiers, { description: "descriptionKey" });
  }
  if (activity?.followUp) {
    applyDataKeys(activity.followUp, { label: "labelKey" });
    for (const opt of (activity.followUp.options ?? [])) {
      applyDataKeys(opt, { label: "labelKey" });
    }
  }
  const outcomes = activity?.outcomes;
  if (outcomes && typeof outcomes === "object") {
    for (const tier of Object.values(outcomes)) {
      if (!tier || typeof tier !== "object") continue;
      applyDataKeys(tier, { narrative: "narrativeKey" });
      for (const effect of (tier.effects ?? [])) {
        applyDataKeys(effect, { description: "descriptionKey" });
      }
    }
  }
  return activity;
}

/** @param {object} event */
export function localizeEventRecord(event) {
  applyDataKeys(event, {
    name: "nameKey",
    description: "descriptionKey",
    gmGuidance: "gmGuidanceKey",
    gmPrompt: "gmPromptKey",
    checkContext: "checkContextKey",
    readAloud: "readAloudKey"
  });
  const mech = event?.mechanical;
  if (mech && typeof mech === "object") {
    applyDataKeys(mech, { prompt: "promptKey" });
    for (const tier of ["onTriumph", "onSuccess", "onMixed", "onFailure"]) {
      if (mech[tier] && typeof mech[tier] === "object") {
        applyDataKeys(mech[tier], { narrative: "narrativeKey", description: "descriptionKey" });
      }
    }
    for (const opt of (mech.options ?? [])) {
      applyDataKeys(opt, { label: "labelKey", description: "descriptionKey" });
    }
  }
  return event;
}

/** @param {object} entry - condition_registry condition */
export function localizeConditionRecord(entry) {
  return applyDataKeys(entry, { label: "labelKey", description: "descriptionKey" });
}

/** @param {object} entry - durationMap value */
export function localizeDurationRecord(entry) {
  return applyDataKeys(entry, { label: "labelKey" });
}
