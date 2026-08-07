import { isGearDeployed } from "../services/camp/props/CompoundCampPlacer.js";
import { localize, format } from "../utils/I18n.js";
import { HD_PENALTY, boostComfort, isComfortEnabled, getComfortDcMod, COMFORT_RANK, RANK_TO_KEY } from "../services/camp/gear/ComfortCalculator.js";
import { isSimpleStationsMode } from "../services/rest/flow/RestProfileSettings.js";
import { getFletchingYieldHint, isFletchingEnabled } from "../services/crafting/settings/FletchingSettings.js";
import { getTrainingXpValues, getTrainingXpReduction, isTrainingEnabled } from "../services/crafting/settings/TrainingSettings.js";
import { isPrayMeditateEnabled } from "../services/rest/flow/ActivityResolver.js";
import { MODULE_ID } from "./moduleId.js";

/**
 * Weather master table. Each entry defines comfort penalty, encounter DC modifier,
 * and tent interaction. `tentReduces` means tent lowers penalty by 1 (partial help).
 */
export const WEATHER_TABLE = {
    clear: { labelKey: "IONRIFT.RESPITE.WEATHER.clear.Label", hintKey: "IONRIFT.RESPITE.WEATHER.clear.Hint",                                       comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    overcast: { labelKey: "IONRIFT.RESPITE.WEATHER.overcast.Label", hintKey: "IONRIFT.RESPITE.WEATHER.overcast.Hint",                              comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    fog: { labelKey: "IONRIFT.RESPITE.WEATHER.fog.Label", hintKey: "IONRIFT.RESPITE.WEATHER.fog.Hint",  comfortPenalty: 0, encounterDC: 2, tentCancels: true,  tentReduces: false },
    rain: { labelKey: "IONRIFT.RESPITE.WEATHER.rain.Label", hintKey: "IONRIFT.RESPITE.WEATHER.rain.Hint",                             comfortPenalty: 1, encounterDC: 0, tentCancels: true,  tentReduces: false },
    heavy_rain: { labelKey: "IONRIFT.RESPITE.WEATHER.heavy_rain.Label", hintKey: "IONRIFT.RESPITE.WEATHER.heavy_rain.Hint",                               comfortPenalty: 1, encounterDC: 1, tentCancels: true,  tentReduces: false },
    thunderstorm: { labelKey: "IONRIFT.RESPITE.WEATHER.thunderstorm.Label", hintKey: "IONRIFT.RESPITE.WEATHER.thunderstorm.Hint",            comfortPenalty: 2, encounterDC: 2, tentCancels: false, tentReduces: true },
    snow: { labelKey: "IONRIFT.RESPITE.WEATHER.snow.Label", hintKey: "IONRIFT.RESPITE.WEATHER.snow.Hint",                             comfortPenalty: 1, encounterDC: 0, tentCancels: true,  tentReduces: false },
    blizzard: { labelKey: "IONRIFT.RESPITE.WEATHER.blizzard.Label", hintKey: "IONRIFT.RESPITE.WEATHER.blizzard.Hint",            comfortPenalty: 2, encounterDC: 1, tentCancels: false, tentReduces: true },
    extreme_cold: { labelKey: "IONRIFT.RESPITE.WEATHER.extreme_cold.Label", hintKey: "IONRIFT.RESPITE.WEATHER.extreme_cold.Hint",             comfortPenalty: 1, encounterDC: 0, tentCancels: false, tentReduces: true },
    extreme_heat: { labelKey: "IONRIFT.RESPITE.WEATHER.extreme_heat.Label", hintKey: "IONRIFT.RESPITE.WEATHER.extreme_heat.Hint",        comfortPenalty: 1, encounterDC: 0, tentCancels: false, tentReduces: false },
    sandstorm: { labelKey: "IONRIFT.RESPITE.WEATHER.sandstorm.Label", hintKey: "IONRIFT.RESPITE.WEATHER.sandstorm.Hint",                 comfortPenalty: 2, encounterDC: 2, tentCancels: false, tentReduces: true },
    hail: { labelKey: "IONRIFT.RESPITE.WEATHER.hail.Label", hintKey: "IONRIFT.RESPITE.WEATHER.hail.Hint",                             comfortPenalty: 1, encounterDC: 0, tentCancels: true,  tentReduces: false },
    volcanic_ash: { labelKey: "IONRIFT.RESPITE.WEATHER.volcanic_ash.Label", hintKey: "IONRIFT.RESPITE.WEATHER.volcanic_ash.Hint",                        comfortPenalty: 1, encounterDC: 1, tentCancels: false, tentReduces: true },
    fungal_spores: { labelKey: "IONRIFT.RESPITE.WEATHER.fungal_spores.Label", hintKey: "IONRIFT.RESPITE.WEATHER.fungal_spores.Hint",                         comfortPenalty: 1, encounterDC: 0, tentCancels: false, tentReduces: true },
    faerzress: { labelKey: "IONRIFT.RESPITE.WEATHER.faerzress.Label", hintKey: "IONRIFT.RESPITE.WEATHER.faerzress.Hint",          comfortPenalty: 0, encounterDC: 0, tentCancels: false, tentReduces: false },
    // Tavern atmosphere (flavor only, zero mechanical effect)
    tavern_rain: { labelKey: "IONRIFT.RESPITE.WEATHER.tavern_rain.Label", hintKey: "IONRIFT.RESPITE.WEATHER.tavern_rain.Hint",              comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    tavern_storm: { labelKey: "IONRIFT.RESPITE.WEATHER.tavern_storm.Label", hintKey: "IONRIFT.RESPITE.WEATHER.tavern_storm.Hint",                 comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    // Tavern grades (flavor only, zero mechanical effect)
    tavern_flophouse: { labelKey: "IONRIFT.RESPITE.WEATHER.tavern_flophouse.Label", hintKey: "IONRIFT.RESPITE.WEATHER.tavern_flophouse.Hint",               comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    tavern_modest: { labelKey: "IONRIFT.RESPITE.WEATHER.tavern_modest.Label", hintKey: "IONRIFT.RESPITE.WEATHER.tavern_modest.Hint",                comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    tavern_fine: { labelKey: "IONRIFT.RESPITE.WEATHER.tavern_fine.Label", hintKey: "IONRIFT.RESPITE.WEATHER.tavern_fine.Hint",              comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    tavern_luxury: { labelKey: "IONRIFT.RESPITE.WEATHER.tavern_luxury.Label", hintKey: "IONRIFT.RESPITE.WEATHER.tavern_luxury.Hint",                   comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    // Underground atmosphere (flavor)
    dungeon_normal: { labelKey: "IONRIFT.RESPITE.WEATHER.dungeon_normal.Label", hintKey: "IONRIFT.RESPITE.WEATHER.dungeon_normal.Hint",                                   comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false },
    dungeon_damp: { labelKey: "IONRIFT.RESPITE.WEATHER.dungeon_damp.Label", hintKey: "IONRIFT.RESPITE.WEATHER.dungeon_damp.Hint",                comfortPenalty: 0, encounterDC: 0, tentCancels: true,  tentReduces: false }
};

/** Resolve weather display strings at render time. */
export function resolveWeather(key) {
    const w = WEATHER_TABLE[key] ?? WEATHER_TABLE.clear;
    return {
        ...w,
        label: localize(w.labelKey ?? "IONRIFT.RESPITE.WEATHER.clear.Label"),
        hint: localize(w.hintKey ?? "IONRIFT.RESPITE.WEATHER.clear.Hint")
    };
}

/** DnD5e skill abbreviation -> readable name */
const SKILL_NAME_KEYS = {
    acr: "IONRIFT.RESPITE.SKILL.acr", ani: "IONRIFT.RESPITE.SKILL.ani", arc: "IONRIFT.RESPITE.SKILL.arc", ath: "IONRIFT.RESPITE.SKILL.ath",
    dec: "IONRIFT.RESPITE.SKILL.dec", his: "IONRIFT.RESPITE.SKILL.his", ins: "IONRIFT.RESPITE.SKILL.ins", itm: "IONRIFT.RESPITE.SKILL.itm",
    inv: "IONRIFT.RESPITE.SKILL.inv", med: "IONRIFT.RESPITE.SKILL.med", nat: "IONRIFT.RESPITE.SKILL.nat", prc: "IONRIFT.RESPITE.SKILL.prc",
    prf: "IONRIFT.RESPITE.SKILL.prf", per: "IONRIFT.RESPITE.SKILL.per", rel: "IONRIFT.RESPITE.SKILL.rel", sle: "IONRIFT.RESPITE.SKILL.sle",
    ste: "IONRIFT.RESPITE.SKILL.ste", sur: "IONRIFT.RESPITE.SKILL.sur"
};

/** Localized skill names (resolve at access time). */
export const SKILL_NAMES = new Proxy(SKILL_NAME_KEYS, {
    get(target, prop) {
        if (prop === Symbol.iterator) {
            return function* () { for (const k of Object.keys(target)) yield [k, localize(target[k])]; };
        }
        if (typeof prop !== "string") return Reflect.get(target, prop);
        if (prop in target) return localize(target[prop]);
        return undefined;
    },
    ownKeys(target) { return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, prop) {
        if (prop in target) return { configurable: true, enumerable: true, value: localize(target[prop]) };
        return undefined;
    }
});

export { COMFORT_RANK, RANK_TO_KEY };

/** Activity icon mapping */
export const ACTIVITY_ICONS = {
    act_keep_watch: "fas fa-eye", act_rest_fully: "fas fa-bed",
    act_scout: "fas fa-binoculars", act_tell_tales: "fas fa-theater-masks",
    act_tend_wounds: "fas fa-hand-holding-medical", act_pray: "fas fa-pray",
    act_cook: "fas fa-utensils", act_tailor: "fas fa-cut",
    act_craft: "fas fa-tools", act_fletch: "fas fa-crosshairs",
    act_defenses: "fas fa-shield-alt", act_train: "fas fa-dumbbell",
    act_identify: "fas fa-search", act_scribe: "fas fa-scroll",
    act_other: "fas fa-comments"
};

/** @returns {boolean} TotM Identify tab and workbench identify station UI. */
export function isWorkbenchIdentifyUiEnabled() {
    try {
        return !!game.settings.get(MODULE_ID, "enableWorkbenchIdentify");
    } catch {
        return true;
    }
}

/** Focus identify and potion tasting at the workbench station (always available). */
export function isWorkbenchExamineUiEnabled() {
    return true;
}

/**
 * Static fallback hints surfaced on the activity card and the detail-panel advisory pill.
 * Keep these complementary to the activity description and to the lavender check label.
 * Do not restate the skill or DC; the check label already shows them.
 * Do not restate "no check required"; the neutral chip below the detail already says it.
 */
const ACTIVITY_HINTS_STATIC = {
    act_tell_tales: "IONRIFT.RESPITE.ADVISORY.TellTales",
    act_cook: "IONRIFT.RESPITE.ADVISORY.Cook",
    act_tailor: "IONRIFT.RESPITE.ADVISORY.Tailor",
    act_craft: "IONRIFT.RESPITE.ADVISORY.Craft"
};

/**
 * Generate a contextual advisory for an activity card.
 * Advisory text is player-visible. Never include encounter DC or GM-only data.
 *
 * Return shape: { text, urgent, nonViable?, cardOnly? }
 *
 *   cardOnly: true when the advisory is a static mechanical summary that
 *   simply mirrors the success-outcome chevron. The card list shows it as a
 *   useful at-a-glance hint, but the detail panel suppresses it so the blue
 *   pill does not visually compete with the green outcome chevron immediately
 *   below. Use cardOnly only when the text adds nothing the outcome chevron
 *   does not already say.
 *
 * @param {string} activityId - The activity ID
 * @param {Actor5e} actor - The actor considering this activity
 * @param {object} partyState - Pre-computed party state from buildPartyState()
 * @returns {{text: string, urgent: boolean, nonViable?: boolean, cardOnly?: boolean}}
 */
export function getActivityAdvisory(activityId, actor, partyState) {
    const hp = actor.system?.attributes?.hp ?? {};
    const hpPct = hp.max ? Math.round((hp.value / hp.max) * 100) : 100;
    const hd = actor.system?.attributes?.hd ?? {};
    const hdAvail = typeof hd.value === "number" ? hd.value : (hd.available ?? 0);
    const hdMax = hd.max ?? actor.system?.details?.level ?? 1;
    const hdDeficit = hdMax - hdAvail;

    switch (activityId) {
        case "act_keep_watch": {
            const watchers = partyState.watcherCount ?? 0;
            if (!partyState.hasWatcher)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.NoWatcher"), urgent: true };
            if (watchers >= 2)
                return { text: format("IONRIFT.RESPITE.ADVISORY.WatchersAssigned", { count: watchers }), urgent: false };
            return { text: localize("IONRIFT.RESPITE.ADVISORY.KeepWatchBenefits"), urgent: false, cardOnly: true };
        }
        case "act_tend_wounds": {
            const injured = partyState.injuredMembers.filter(m => m.id !== actor.id);
            const hasKit = actor.items?.some(i =>
                i.name?.toLowerCase().includes("healer") && i.name?.toLowerCase().includes("kit")
                && ((i.system?.uses?.value ?? i.system?.quantity ?? 0) > 0)
            );
            const hasFeat = actor.items?.some(i => i.type === "feat" && i.name?.toLowerCase() === "healer");
            const gearNote = hasFeat && hasKit ? localize("IONRIFT.RESPITE.ADVISORY.GearFeatKit")
                : hasKit ? localize("IONRIFT.RESPITE.ADVISORY.GearKit")
                : "";
            if (!injured.length)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.NoOneInjured"), urgent: false, nonViable: true };
            const worst = injured[0];
            return { text: format("IONRIFT.RESPITE.ADVISORY.InjuredAtHp", { name: worst.name, hp: worst.hpPct, gear: gearNote }), urgent: worst.hpPct < 50 };
        }
        case "act_defenses": {
            if (partyState.hasDefenses)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.DefensesTaken"), urgent: false };
            return { text: localize("IONRIFT.RESPITE.ADVISORY.DefensesBenefits"), urgent: false, cardOnly: true };
        }
        case "act_scout": {
            if (partyState.hasScout)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.ScoutTaken"), urgent: false };
            return { text: localize("IONRIFT.RESPITE.ADVISORY.ScoutBenefits"), urgent: false, cardOnly: true };
        }
        case "act_rest_fully": {
            const comfortTier = partyState.comfort ?? "sheltered";
            const isHostile = comfortTier === "hostile";
            const isRough = comfortTier === "rough";
            const isSafe = comfortTier === "safe";
            const adapter = game.ionrift?.respite?.adapter;
            const exhaustion = adapter ? adapter.getExhaustion(actor) : (actor.system?.attributes?.exhaustion ?? 0);

            const basePenalty = HD_PENALTY[comfortTier] ?? 0;
            const boostedPenalty = HD_PENALTY[boostComfort(comfortTier, 1)] ?? 0;
            const rawHdRecovery = Math.max(1, Math.floor(hdMax / 2));
            const hdWithout = Math.max(0, rawHdRecovery - basePenalty);
            const hdWith = Math.max(0, rawHdRecovery - boostedPenalty) + 1;
            const effectiveGain = Math.max(0, Math.min(hdWith, hdDeficit) - Math.min(hdWithout, hdDeficit));

            // Safe rest spot: Rest Fully's main value is the extra -1 exhaustion
            if (isSafe) {
                if (exhaustion >= 2)
                    return { text: format("IONRIFT.RESPITE.ADVISORY.SafeExhaustionMulti", { count: exhaustion }), urgent: true };
                if (exhaustion === 1)
                    return { text: localize("IONRIFT.RESPITE.ADVISORY.SafeExhaustionOne"), urgent: false };
                if (hdDeficit >= 1 && effectiveGain > 0)
                    return { text: format("IONRIFT.RESPITE.ADVISORY.MissingHdExtra", { deficit: hdDeficit, gain: effectiveGain }), urgent: false };
                return { text: localize("IONRIFT.RESPITE.ADVISORY.FullRecoveryNoBenefit"), urgent: false, nonViable: true };
            }
            if (isHostile) {
                if (hdDeficit >= 1)
                    return { text: format("IONRIFT.RESPITE.ADVISORY.HostileExtraHd", { gain: effectiveGain || 1 }), urgent: true };
                if (hpPct < 100)
                    return { text: localize("IONRIFT.RESPITE.ADVISORY.HostileFullHp"), urgent: true };
                return { text: localize("IONRIFT.RESPITE.ADVISORY.AllFullNoBenefit"), urgent: false, nonViable: true };
            }
            if (isRough) {
                if (effectiveGain > 0) {
                    const exNote = exhaustion >= 1 ? localize("IONRIFT.RESPITE.ADVISORY.ExNoteClearsDc") : "";
                    return { text: format("IONRIFT.RESPITE.ADVISORY.RoughExtraHd", { gain: effectiveGain, exNote }), urgent: true };
                }
                if (exhaustion >= 1)
                    return { text: format("IONRIFT.RESPITE.ADVISORY.RoughClearsDc", { count: exhaustion }), urgent: true };
                if (hdDeficit >= 1)
                    return { text: localize("IONRIFT.RESPITE.ADVISORY.RecoveryCoversHd"), urgent: false, nonViable: true };
                return { text: localize("IONRIFT.RESPITE.ADVISORY.NoRecoveryBenefit"), urgent: false, nonViable: true };
            }
            if (effectiveGain > 0)
                return { text: format("IONRIFT.RESPITE.ADVISORY.MissingHdExtra", { deficit: hdDeficit, gain: effectiveGain }), urgent: false };
            if (hdDeficit >= 1)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.RecoveryCoversHd"), urgent: false, nonViable: true };
            return { text: localize("IONRIFT.RESPITE.ADVISORY.AllFullNoBenefit"), urgent: false, nonViable: true };
        }
        case "act_pray": {
            if (!isPrayMeditateEnabled())
                return { text: localize("IONRIFT.RESPITE.ADVISORY.PrayOff"), urgent: false, nonViable: true };
            const prof = actor.system?.attributes?.prof ?? 2;
            return { text: format("IONRIFT.RESPITE.ADVISORY.PrayTempHp", { prof }), urgent: false };
        }
        case "act_fletch": {
            if (!isFletchingEnabled())
                return { text: localize("IONRIFT.RESPITE.ADVISORY.FletchOff"), urgent: false, nonViable: true };
            const ammo = _countAmmo(actor);
            const prof = actor.system?.attributes?.prof ?? 2;
            const yieldHint = getFletchingYieldHint(undefined, prof);
            if (ammo !== null && ammo < 10)
                return { text: format("IONRIFT.RESPITE.ADVISORY.LowAmmo", { ammo, yieldHint }), urgent: true };
            return { text: format("IONRIFT.RESPITE.ADVISORY.CraftAmmo", { yieldHint }), urgent: false };
        }
        case "act_train": {
            if (!isTrainingEnabled())
                return { text: localize("IONRIFT.RESPITE.ADVISORY.TrainOff"), urgent: false, nonViable: true };
            const level = actor.system?.details?.level ?? 1;
            if (level > 5)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.TrainAbove5"), urgent: false, nonViable: true };
            const xpValues = getTrainingXpValues();
            const passXp = xpValues?.passXp ?? 10;
            const failXp = xpValues?.failXp ?? 3;
            const xp = actor.system?.details?.xp ?? {};
            const gap = (xp.max && xp.value !== null && xp.value !== undefined) ? (xp.max - xp.value) : null;
            const streak = actor.getFlag?.("ionrift-respite", "trainingStreak") ?? 0;
            const baseXP = 3 * passXp;
            const effectiveFailXP = 3 * failXp;
            const reduction = getTrainingXpReduction(streak);
            const effectiveXP = Math.max(baseXP - reduction, 0);
            const effectiveFailTotal = Math.max(effectiveFailXP - reduction, 0);
            if (effectiveXP <= 0)
                return { text: localize("IONRIFT.RESPITE.ADVISORY.TrainNoXp"), urgent: false, nonViable: true };
            if (gap !== null && gap > 0 && gap <= effectiveXP)
                return { text: format("IONRIFT.RESPITE.ADVISORY.TrainLevelGap", { gap }), urgent: true };
            if (streak >= 1)
                return { text: format("IONRIFT.RESPITE.ADVISORY.TrainStreak", { streak, xp: effectiveXP, failXp: effectiveFailTotal }), urgent: false };
            if (gap !== null && gap > 0)
                return { text: format("IONRIFT.RESPITE.ADVISORY.TrainGapSets", { gap, xp: effectiveXP, failXp: effectiveFailTotal }), urgent: false };
            return { text: format("IONRIFT.RESPITE.ADVISORY.TrainSets", { xp: effectiveXP, failXp: effectiveFailTotal }), urgent: false };
        }
        case "act_scribe":
            return { text: localize("IONRIFT.RESPITE.ADVISORY.ScribeCost"), urgent: false };
        default:
            return { text: ACTIVITY_HINTS_STATIC[activityId] ? localize(ACTIVITY_HINTS_STATIC[activityId]) : null, urgent: false };
    }
}

/**
 * Pre-compute party state for advisory generation.
 * Call once per render, pass to each getActivityAdvisory call.
 * @param {Actor5e[]} partyActors - All actors in the rest
 * @param {Map} pendingSelections - Map of actorId ,  activityId
 * @param {number} encounterDC - Current effective encounter DC
 * @returns {object}
 */
export function buildPartyState(partyActors, pendingSelections, encounterDC, comfort) {
    const picks = [...(pendingSelections?.values() ?? [])];
    const watcherCount = picks.filter(id => id === "act_keep_watch").length;
    const hasWatcher = watcherCount > 0;
    const hasScout = picks.includes("act_scout");
    const hasDefenses = picks.includes("act_defenses");
    const partySize = partyActors.length;

    const injuredMembers = partyActors
        .map(a => {
            const hp = a.system?.attributes?.hp ?? {};
            const pct = hp.max ? Math.round((hp.value / hp.max) * 100) : 100;
            return { id: a.id, name: a.name, hpPct: pct };
        })
        .filter(m => m.hpPct < 100)
        .sort((a, b) => a.hpPct - b.hpPct);

    return {
        hasWatcher, watcherCount, hasScout, hasDefenses,
        partySize,
        injuredMembers,
        encounterDC: encounterDC ?? 14,
        comfort: comfort ?? "sheltered"
    };
}

/** Count ammunition (arrows, bolts, darts) in an actor's inventory */
function _countAmmo(actor) {
    const AMMO_NAMES = /arrow|bolt|dart|sling bullet/i;
    let total = 0;
    let found = false;
    for (const item of actor.items ?? []) {
        if (item.type === "consumable" && item.system?.type?.value === "ammo" &&
            AMMO_NAMES.test(item.name)) {
            total += item.system?.quantity ?? 0;
            found = true;
        }
    }
    return found ? total : null;
}

/**
 * Camp station definitions. Each station groups activities by the campsite
 * furniture they are performed at. Order determines display order.
 * `furnitureKey` ties back to CompoundCampPlacer token flags.
 */
export const CAMP_STATIONS = [
    {
        id: "workbench",
        labelKey: "IONRIFT.RESPITE.STATION.workbench.Label",
        icon: "fas fa-tools",
        furnitureKey: "table",
        taglineKey: "IONRIFT.RESPITE.STATION.workbench.Tagline",
        activities: ["act_identify", "act_scribe"]
    },
    {
        id: "weapon_rack",
        labelKey: "IONRIFT.RESPITE.STATION.weapon_rack.Label",
        icon: "fas fa-shield-alt",
        furnitureKey: "weaponRack",
        taglineKey: "IONRIFT.RESPITE.STATION.weapon_rack.Tagline",
        activities: ["act_fletch", "act_defenses", "act_keep_watch", "act_other"],
        terrainHide: ["tavern"]
    },
    {
        id: "medical_bed",
        labelKey: "IONRIFT.RESPITE.STATION.medical_bed.Label",
        icon: "fas fa-hand-holding-medical",
        furnitureKey: "medicalBed",
        taglineKey: "IONRIFT.RESPITE.STATION.medical_bed.Tagline",
        activities: ["act_tend_wounds", "act_rest_fully"]
    },
    {
        id: "bedroll",
        labelKey: "IONRIFT.RESPITE.STATION.bedroll.Label",
        icon: "fas fa-bed",
        furnitureKey: null,
        taglineKey: "IONRIFT.RESPITE.STATION.bedroll.Tagline",
        activities: ["act_rest_fully", "act_pray", "act_train", "act_tell_tales", "act_craft", "act_other"],
        terrainLabelKey: { tavern: "IONRIFT.RESPITE.STATION.bedroll.TavernLabel" }
    },
    {
        id: "campfire",
        labelKey: "IONRIFT.RESPITE.STATION.campfire.Label",
        icon: "fas fa-fire",
        furnitureKey: "campfire",
        taglineKey: "IONRIFT.RESPITE.STATION.campfire.Tagline",
        activities: [],
        terrainHide: ["tavern"]
    },
    {
        id: "cooking_station",
        labelKey: "IONRIFT.RESPITE.STATION.cooking_station.Label",
        icon: "fas fa-utensils",
        furnitureKey: "cookingArea",
        taglineKey: "IONRIFT.RESPITE.STATION.cooking_station.Tagline",
        activities: ["act_cook", "act_brew"],
        terrainLabelKey: { tavern: "IONRIFT.RESPITE.STATION.cooking_station.TavernLabel" }
    }
];

/**
 * Returns CAMP_STATIONS filtered and adjusted for a given terrain.
 * Hidden stations are removed; activities from hidden stations that should
 * migrate are folded into fallback stations (e.g. Keep Watch ,  bedroll in taverns).
 * Labels are overridden per terrainLabel where defined.
 * @param {string} terrainTag
 * @param {boolean} [safeRestSpot] - Hides medical bed and relabels weapon rack for safe rest flow
 * @param {{ simpleStations?: boolean }} [options]
 * @returns {Object[]}
 */
export function getStationsForTerrain(terrainTag, safeRestSpot = false, options = {}) {
    const simpleStations = options.simpleStations ?? isSimpleStationsMode();
    const isTavern = terrainTag === "tavern";
    const hidden = new Set();
    /** Activities orphaned by hidden stations that should migrate to bedroll. */
    const MIGRATING_ACTIVITIES = isTavern
        ? new Set([])
        : new Set(["act_keep_watch", "act_other"]);
    const orphanedActivities = [];

    // First pass: collect hidden station ids and their migrating activities.
    for (const station of CAMP_STATIONS) {
        if (station.terrainHide?.includes(terrainTag)) {
            hidden.add(station.id);
            for (const actId of station.activities ?? []) {
                if (MIGRATING_ACTIVITIES.has(actId)) orphanedActivities.push(actId);
            }
        }
    }

    // Second pass: build adjusted station list.
    const result = [];
    for (const station of CAMP_STATIONS) {
        if (hidden.has(station.id)) continue;
        if (isTavern && station.id === "cooking_station") continue;
        if ((safeRestSpot || isTavern) && station.id === "medical_bed") continue;
        let label = localize(station.terrainLabelKey?.[terrainTag] ?? station.labelKey ?? station.label ?? "");
        let activities = [...(station.activities ?? [])];
        let tagline = localize(station.taglineKey ?? station.tagline ?? "");
        if (isTavern && station.id === "bedroll") {
            activities = activities.filter(id => id !== "act_rest_fully");
        }
        if (safeRestSpot && station.id === "weapon_rack") {
            label = localize("IONRIFT.RESPITE.STATION.weapon_rack.SupplyTable");
            tagline = localize("IONRIFT.RESPITE.STATION.weapon_rack.SupplyTagline");
            activities = ["act_fletch", "act_other"];
        }
        const extra = station.id === "bedroll" ? orphanedActivities : [];
        const mergedActivities = extra.length
            ? [...activities, ...extra.filter(id => !activities.includes(id))]
            : activities;
        result.push({ ...station, label, activities: mergedActivities, tagline });
    }

    if (!simpleStations) return result;

    return result
        .filter(s => ["workbench", "bedroll"].includes(s.id))
        .map(s => {
            if (s.id === "bedroll") {
                return {
                    ...s,
                    label: localize("IONRIFT.RESPITE.STATION.bedroll.SimpleLabel"),
                    furnitureKey: "sharedBedroll",
                    tagline: localize("IONRIFT.RESPITE.STATION.bedroll.SimpleTagline"),
                    activities: ["act_other"]
                };
            }
            if (s.id === "workbench") {
                return {
                    ...s,
                    tagline: localize("IONRIFT.RESPITE.STATION.workbench.TaglineSimple"),
                    activities: (s.activities ?? []).filter(id => id !== "act_scribe")
                };
            }
            return s;
        });
}

/**
 * Activity ids a character can pick from visible TotM station sections (excludes
 * campfire and Identify-tab-only activities).
 * @param {string} terrainTag
 * @param {boolean} safeRestSpot
 * @param {Set<string>|Iterable<string>} availableIds
 * @param {{ simpleStations?: boolean }} [options]
 * @returns {Set<string>}
 */
export function getStationOfferedActivityIds(terrainTag, safeRestSpot, availableIds, options = {}) {
    const available = availableIds instanceof Set ? availableIds : new Set(availableIds);
    const stations = getStationsForTerrain(terrainTag, safeRestSpot, options);
    const skipStations = new Set(["campfire"]);
    const identifyTabIds = new Set(["act_identify"]);
    const offered = new Set();
    for (const station of stations) {
        if (skipStations.has(station.id)) continue;
        for (const id of station.activities ?? []) {
            if (identifyTabIds.has(id)) continue;
            if (available.has(id)) offered.add(id);
        }
    }
    return offered;
}

/**
 * One canvas station id for a chosen activity (used for overlay portraits).
 * When an activity appears on both bedroll and campfire, picks from deployed bedroll gear;
 * otherwise the first matching station in {@link CAMP_STATIONS} order.
 * @param {string} activityId
 * @param {string|null} [actorId]
 * @returns {string}
 */
export function inferCanvasStationForActivity(activityId, actorId = null) {
    if (!activityId) return "campfire";
    if (activityId === "act_other" && isSimpleStationsMode()) return "bedroll";
    const hits = CAMP_STATIONS.filter(s => (s.activities ?? []).includes(activityId));
    if (!hits.length) return "campfire";
    if (hits.length === 1) return hits[0].id;
    const hasBed = hits.some(h => h.id === "bedroll");
    const hasFire = hits.some(h => h.id === "campfire");
    if (hasBed && hasFire && actorId) {
        return isGearDeployed(actorId, "bedroll") ? "bedroll" : "campfire";
    }
    return hits[0].id;
}

/** Maximum distance (grid squares) a player token may be from a station to interact with it. */
export const STATION_RANGE_SQUARES = 3;

/** Max assignment portraits on an activity card before showing a +N overflow badge. */
export const ACTIVITY_PORTRAIT_DISPLAY_CAP = 3;

/**
 * Attach portrait bubbles and overflow count to an activity list item.
 * @param {object} item
 * @param {object[]} assigned
 */
export function applyActivityPortraitAssignments(item, assigned) {
    const cap = ACTIVITY_PORTRAIT_DISPLAY_CAP;
    item.assignedPortraits = assigned.slice(0, cap);
    item.assignedOverflow = Math.max(0, assigned.length - cap);
    item.hasAssignments = assigned.length > 0;
}

/** Shelter spell definitions. Used in setup phase for shelter detection. */
export const SHELTER_SPELLS = [
    { id: "tiny_hut", nameKey: "IONRIFT.RESPITE.SHELTER.tiny_hut.Name", altNames: ["leomund's tiny hut", "tiny hut", "cozy cabin"], icon: "fas fa-igloo", comfortFloor: "sheltered", encounterMod: 5, restTypes: ["long"], blocksFire: true,
        hintKey: "IONRIFT.RESPITE.SHELTER.tiny_hut.Hint" },
    { id: "rope_trick", nameKey: "IONRIFT.RESPITE.SHELTER.rope_trick.Name", altNames: ["rope trick"], icon: "fas fa-hat-wizard", comfortFloor: null, encounterMod: 5, restTypes: ["short"], blocksFire: true,
        hintKey: "IONRIFT.RESPITE.SHELTER.rope_trick.Hint" },
    { id: "magnificent_mansion", nameKey: "IONRIFT.RESPITE.SHELTER.magnificent_mansion.Name", altNames: ["magnificent mansion", "mordenkainen's magnificent mansion", "mordenkainen", "resplendent mansion"], icon: "fas fa-chess-rook", comfortFloor: "safe", encounterMod: 99, restTypes: ["long"], blocksFire: true,
        hintKey: "IONRIFT.RESPITE.SHELTER.magnificent_mansion.Hint" }
];

/** Localized shelter spell fields for UI. */
export function resolveShelterSpell(spell) {
    if (!spell) return spell;
    const name = localize(spell.nameKey ?? spell.name ?? "");
    return { ...spell, name, hint: localize(spell.hintKey ?? spell.hint ?? ""), label: name };
}

/** Comfort tier tooltips for the camp status bar */
export function getComfortTip(tier) {
    if (!isComfortEnabled()) return localize("IONRIFT.RESPITE.COMFORT.Disabled");
    const key = `IONRIFT.RESPITE.COMFORT.${tier}`;
    const localized = localize(key);
    return localized !== key ? localized : localize("IONRIFT.RESPITE.COMFORT.sheltered");
}

/** Identify tab: Detect Magic toolbar label. */
export const DETECT_MAGIC_BTN_LABEL_PLAYER = "IONRIFT.RESPITE.DETECT.Label";
export const DETECT_MAGIC_BTN_LABEL_GM = "IONRIFT.RESPITE.DETECT.Label";
/** Shown when a scan is already active; clicking again dismisses it. */
export const DETECT_MAGIC_BTN_LABEL_DISMISS = "IONRIFT.RESPITE.DETECT.Dismiss";
export const DETECT_MAGIC_BTN_TITLE_GM = "IONRIFT.RESPITE.DETECT.TitleGm";
export const DETECT_MAGIC_BTN_TITLE_PLAYER = "IONRIFT.RESPITE.DETECT.TitlePlayer";
export const DETECT_MAGIC_BTN_TITLE_NONE = "IONRIFT.RESPITE.DETECT.TitleNone";

/**
 * Build per-activity portrait assignment map.
 * Shared between StationActivityDialog (spatial) and TotM card grid.
 * @param {Map<string,string>} characterChoices - actorId -> activityId
 * @param {Map<string,object>} earlyResults - actorId -> { result, narrative }
 * @param {Set<string>|null} [filterActivityIds] - If provided, only include these activity IDs
 * @returns {Object<string, Array<{actorId, actorName, portraitImg, status}>>}
 */
export function buildActivityAssignments(characterChoices, earlyResults, filterActivityIds = null) {
    const assignments = {};
    if (!characterChoices?.size) return assignments;
    for (const [charId, actId] of characterChoices) {
        if (filterActivityIds && !filterActivityIds.has(actId)) continue;
        const actor = game.actors.get(charId);
        if (!actor) continue;
        let status = "pending";
        const earlyResult = earlyResults?.get(charId);
        if (earlyResult) {
            if (earlyResult.result === "success" || earlyResult.result === "exceptional") status = "success";
            else if (earlyResult.result === "failure" || earlyResult.result === "failure_complication") status = "fail";
        }
        if (!assignments[actId]) assignments[actId] = [];
        assignments[actId].push({
            actorId: charId,
            actorName: actor.name,
            portraitImg: actor.img ?? actor.prototypeToken?.texture?.src ?? "icons/svg/mystery-man.svg",
            status
        });
    }
    return assignments;
}

/**
 * Fold portrait assignments for activities not visible on this client's cards
 * onto act_other so party picks (e.g. scribe, cook) stay visible to everyone.
 *
 * @param {Object<string, object[]>} assignments
 * @param {Set<string>|Iterable<string>} visibleActivityIds
 * @param {string} [fallbackActivityId='act_other']
 */
export function foldOrphanedAssignmentsOntoOther(assignments, visibleActivityIds, fallbackActivityId = "act_other") {
    const visible = visibleActivityIds instanceof Set ? visibleActivityIds : new Set(visibleActivityIds);
    const folded = [];
    for (const [actId, assigned] of Object.entries(assignments)) {
        if (actId === fallbackActivityId || visible.has(actId)) continue;
        if (assigned?.length) folded.push(...assigned);
    }
    if (!folded.length) return;
    const target = assignments[fallbackActivityId] ??= [];
    const seen = new Set(target.map(entry => entry.actorId));
    for (const entry of folded) {
        if (seen.has(entry.actorId)) continue;
        target.push(entry);
        seen.add(entry.actorId);
    }
}

/**
 * Follow-up input descriptor for an activity (shared by TotM inline panels).
 * @param {string|null} [currentValue] - Existing answer for pre-selection
 * @returns {object|null}
 */
export function buildFollowUpDataForActivity(activityId, activity, actor, currentValue = null) {
    if (!activity?.followUp) return null;

    const fu = activity.followUp;
    const result = {
        type: fu.type,
        label: fu.label,
        currentValue
    };

    if (fu.type === "partyMember") {
        const partyActors = (() => {
            try { return game.actors.filter(a => a.hasPlayerOwner && a.type === "character" && a.id !== actor?.id); }
            catch { return []; }
        })();
        result.options = partyActors.sort((a, b) => {
            const aRatio = (a.system?.attributes?.hp?.value ?? 0) / (a.system?.attributes?.hp?.max ?? 1);
            const bRatio = (b.system?.attributes?.hp?.value ?? 0) / (b.system?.attributes?.hp?.max ?? 1);
            return aRatio - bRatio;
        }).map(a => {
            const hp = a.system?.attributes?.hp;
            const hpText = hp ? ` (${hp.value}/${hp.max} HP)` : "";
            return { value: a.id, label: `${a.name}${hpText}`, isSelected: a.id === currentValue };
        });

    } else if (fu.type === "radio" || fu.type === "select") {
        const selectedVal = currentValue || fu.default || fu.options?.[0]?.value;

        if (activityId === "act_scribe") {
            const currentGold = actor?.system?.currency?.gp ?? 0;
            result.goldInfo = `${actor?.name ?? "Character"} has ${currentGold}gp`;
            result.options = (fu.options ?? []).map(opt => {
                const cost = parseInt(opt.value, 10) * 50;
                return {
                    ...opt,
                    label: currentGold >= cost ? opt.label : `${opt.label} (can't afford)`,
                    isSelected: opt.value === selectedVal,
                    isDisabled: currentGold < cost
                };
            });
        } else {
            result.options = (fu.options ?? []).map(opt => ({ ...opt, isSelected: opt.value === selectedVal }));
        }

        if (result.options?.length && !result.options.some(o => o.isSelected)) {
            result.options[0].isSelected = true;
        }

    } else if (fu.type === "actorItem" && fu.filter === "attuneable") {
        const attuneItems = (actor?.items ?? []).filter(i => {
            const att = i.system?.attunement;
            return (att === "required" || att === 1) && !i.system?.attuned;
        });
        result.options = attuneItems.map(i => ({
            value: i.id,
            label: i.name,
            isSelected: i.id === currentValue
        }));
        const attunement = actor?.system?.attributes?.attunement;
        if (attunement) {
            const current = attunement.value ?? 0;
            const max = attunement.max ?? 3;
            result.slotInfo = current >= max
                ? format("IONRIFT.RESPITE.FOLLOWUP.AtCapacity", { current, max })
                : format("IONRIFT.RESPITE.FOLLOWUP.Slots", { current, max });
        }
    }

    return result;
}

/**
 * Build a short check label string for a given activity (e.g. "Arcana check, DC 15").
 * Mirrors the check label logic in StationActivityDialog._buildDetailContext().
 *
 * @param {object} activity - Activity schema from ActivityResolver
 * @param {Actor5e} actor
 * @param {string} [comfort] - Comfort tier key
 * @param {string|null} [followUpValue] - Current follow-up value (used for copySpell DC)
 * @returns {string|null}
 */
export function buildCheckLabelForActivity(activity, actor, comfort = "sheltered", followUpValue = null) {
    if (!activity?.check) return null;

    const comfortMod = getComfortDcMod(comfort);

    let baseDc = activity.check.dc ?? 12;
    if (activity.check.dynamicDc === "copySpell") {
        const spellLevel = Math.min(9, Math.max(1, parseInt(followUpValue || activity.followUp?.default || "1", 10) || 1));
        baseDc = 10 + spellLevel;
    }

    const rcAdapter = game.ionrift?.respite?.adapter;
    let checkKind = "";
    if (activity.check.skill) {
        let chosenSkill = activity.check.skill;
        if (activity.check.altSkill && actor) {
            const primary = rcAdapter ? rcAdapter.getSkillTotal(actor, rcAdapter.normalizeSkillKey(activity.check.skill)) : (actor.system?.skills?.[activity.check.skill]?.total ?? 0);
            const alt = rcAdapter ? rcAdapter.getSkillTotal(actor, rcAdapter.normalizeSkillKey(activity.check.altSkill)) : (actor.system?.skills?.[activity.check.altSkill]?.total ?? 0);
            if (alt > primary) chosenSkill = activity.check.altSkill;
        }
        checkKind = chosenSkill.charAt(0).toUpperCase() + chosenSkill.slice(1);
    } else if (activity.check.ability) {
        let abilityKey = activity.check.ability;
        if (abilityKey === "best" && actor) {
            let bestKey = "str"; let bestMod = -99;
            const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"];
            for (const key of abilityKeys) {
                const mod = rcAdapter ? rcAdapter.getAbilityMod(actor, key) : (actor.system?.abilities?.[key]?.mod ?? 0);
                if (mod > bestMod) { bestMod = mod; bestKey = key; }
            }
            abilityKey = bestKey;
        }
        checkKind = abilityKey.toUpperCase();
    }

    if (activity.check.dynamicDc === "copySpell") {
        return `${checkKind} check, DC ${baseDc}`;
    }
    if (comfortMod > 0) {
        return `${checkKind} check, DC ${baseDc + comfortMod} (${baseDc} base +${comfortMod} terrain)`;
    }
    return `${checkKind} check, DC ${baseDc}`;
}
