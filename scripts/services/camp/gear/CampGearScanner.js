import { getPartyActors } from "../../party/partyActors.js";
import { MODULE_ID } from "../../../data/moduleId.js";
import { localize, format } from "../../../utils/I18n.js";
import {
    COMFORT_TIERS,
    boostComfort,
    getHdPenalty,
    getHpFraction,
    getExhaustionDC,
    isComfortEnabled
} from "./ComfortCalculator.js";

/**
 * @param {Item} item
 * @returns {boolean}
 */
export function isActorFirewoodItem(item) {
    if (!item) return false;
    const n = (item.name ?? "").toLowerCase();
    const firewoodType = item.flags?.[MODULE_ID]?.firewoodType;
    if (firewoodType === "kindling" || firewoodType === "firewood") return true;
    return n.includes("firewood") || n === "kindling";
}

/**
 * CampGearScanner
 *
 * Scans party inventory for camp-relevant gear (bedroll, tent, mess kit,
 * firewood, tinderbox) and computes dual-layer comfort:
 *   - Camp Comfort (shared): terrain base + fire level + shelter spells
 *   - Personal Comfort (per-PC): camp comfort + bedroll only (tent is weather / encounter elsewhere)
 *
 * Also provides recovery previews (HP/HD/exhaustion) so the Make Camp
 * phase can show players the mechanical impact of their gear and fire state.
 */

/**
 * @param {Actor} actor
 * @returns {number}
 */
export function countActorFirewood(actor) {
    if (!actor) return 0;
    return (actor.items ?? [])
        .filter(i => isActorFirewoodItem(i))
        .reduce((sum, i) => sum + (i.system?.quantity ?? 1), 0);
}

/**
 * First stack with firewood or kindling and quantity remaining.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function findConsumableFirewoodItem(actor) {
    if (!actor) return null;
    return (actor.items ?? []).find(i =>
        isActorFirewoodItem(i) && (i.system?.quantity ?? 1) > 0
    ) ?? null;
}

/** @param {Actor} actor @returns {boolean} */
export function actorHasTinderbox(actor) {
    if (!actor) return false;
    return (actor.items ?? []).some(i => {
        const n = i.name?.toLowerCase() ?? "";
        return n.includes("tinderbox") || n.includes("flint and steel") || n.includes("flint & steel");
    });
}

export class CampGearScanner {

    static getRules(tier) {
        const labelKey = `IONRIFT.RESPITE.COMFORT.LABEL.${tier}`;
        const localized = localize(labelKey);
        return {
            hpFraction: getHpFraction(tier),
            hdPenalty: getHdPenalty(tier),
            exhaustionDC: getExhaustionDC(tier),
            label: localized !== labelKey ? localized : (tier.charAt(0).toUpperCase() + tier.slice(1))
        };
    }

    /** Firewood spent when the party commits this fire level during Make Camp. */
    static FIREWOOD_COST_BY_LEVEL = Object.freeze({
        embers: 1,
        campfire: 2,
        bonfire: 3
    });

    /** @param {string} level - embers | campfire | bonfire */
    static firewoodCostLabel(level) {
        const n = this.FIREWOOD_COST_BY_LEVEL[level] ?? 0;
        return format("IONRIFT.RESPITE.FIRE.FirewoodCost", { count: n });
    }

    /** @param {number} hdRecovered @param {number} exitHd @param {number} totalHd @param {number} [hdPenalty=0] */
    static _hdRecoveryLabel(hdRecovered, exitHd, totalHd, hdPenalty = 0) {
        const dice = hdRecovered === 1
            ? localize("IONRIFT.RESPITE.RECOVERY.HitDie")
            : localize("IONRIFT.RESPITE.RECOVERY.HitDice");
        const data = { count: hdRecovered, dice, exit: exitHd, total: totalHd };
        if (hdPenalty > 0) {
            return format("IONRIFT.RESPITE.RECOVERY.RecoverHdComfortPenalty", { ...data, penalty: hdPenalty });
        }
        return format("IONRIFT.RESPITE.RECOVERY.RecoverHd", data);
    }

    /** @param {number|null} dc @param {{ fireIsLit?: boolean, hasBedroll?: boolean }} [opts] */
    static _exhaustionLabel(dc, { fireIsLit = true, hasBedroll = true } = {}) {
        if (!dc) return localize("IONRIFT.RESPITE.RECOVERY.NoExhaustionRisk");
        if (!fireIsLit && !hasBedroll) {
            return format("IONRIFT.RESPITE.RECOVERY.ExhaustionNoCampfireNoBedroll", { dc });
        }
        if (!fireIsLit) return format("IONRIFT.RESPITE.RECOVERY.ExhaustionNoCampfire", { dc });
        if (!hasBedroll) return format("IONRIFT.RESPITE.RECOVERY.NoBedrollConSave", { dc });
        return format("IONRIFT.RESPITE.RECOVERY.ExhaustionHarshTerrain", { dc });
    }

    /** @param {{ hpFraction: number, hdPenalty: number, exhaustionDC: number|null }} rules */
    static _comfortTooltip(rules) {
        const parts = [];
        parts.push(rules.hpFraction < 1
            ? format("IONRIFT.RESPITE.RECOVERY.HpPercentRecovery", { pct: Math.round(rules.hpFraction * 100) })
            : localize("IONRIFT.RESPITE.RECOVERY.FullHpRecovery"));
        if (rules.hdPenalty > 0) {
            parts.push(format("IONRIFT.RESPITE.RECOVERY.HdPenaltyShort", { n: rules.hdPenalty }));
        }
        if (rules.exhaustionDC) {
            parts.push(format("IONRIFT.RESPITE.RECOVERY.ConSaveOrExhaustion", { dc: rules.exhaustionDC }));
        } else {
            parts.push(localize("IONRIFT.RESPITE.RECOVERY.NoExhaustionRisk"));
        }
        return parts.join(", ");
    }

    /**
     * Encounter modifier from fire size.
     *
     * DESIGN RULE, DO NOT CHANGE WITHOUT A FAILING TEST:
     * Fire is a BEACON. A campfire attracts wandering monsters; a bonfire more so.
     * These values are NEGATIVE so that, in the RestFlowEngine formula
     *   effectiveDC = baseDC − campMods   (where campMods = shelter + weather + scouting + fire)
     * a negative fire value subtracts a negative, i.e. RAISES effectiveDC.
     * Higher effectiveDC = harder to roll over = more encounters. That is correct.
     *
     * Mnemonic: "fire raises the DC, fire raises the danger."
     * If you think it should be positive (safety angle), you are wrong. See RestFlowEngine.test.js.
     * "fire is a beacon" suite.
     */
    static FIRE_ENCOUNTER_MOD_BY_LEVEL = Object.freeze({
        cold_camp: 2,  // dark camp: stealth bonus, LOWERS effectiveDC (fewer encounters)
        unlit:     0,   // undecided, no modifier
        embers:    0,   // barely visible, no encounter change
        campfire: -1,  // visible glow: +1 encounter DC (harder to avoid encounters)
        bonfire:  -2   // obvious beacon: +2 encounter DC (significantly harder to avoid encounters)
    });

    /**
     * Canvas flame token: footprint, art scale, and light (bright/dim in scene distance units, usually feet).
     * Merged over template actor light when the fire is lit. Tuned so embers read as a small deep-red glow,
     * campfire as classic warm orange, bonfire as broad yellow-white.
     */
    static FIRE_TOKEN_VISUAL_BY_LEVEL = Object.freeze({
        embers: {
            width: 0.82,
            height: 0.82,
            textureScale: 0.86,
            light: {
                bright: 6,
                dim: 16,
                color: "#6e1418",
                alpha: 0.44,
                luminosity: 0.28,
                saturation: 0.12,
                coloration: 1,
                animation: { type: "torch", speed: 2, intensity: 2, reverse: false }
            }
        },
        campfire: {
            width: 0.95,
            height: 0.95,
            textureScale: 0.96,
            light: {
                bright: 10,
                dim: 22,
                color: "#ff9329",
                alpha: 0.40,
                luminosity: 0.44,
                saturation: 0.02,
                coloration: 1,
                animation: { type: "torch", speed: 3, intensity: 4, reverse: false }
            }
        },
        bonfire: {
            width: 1.12,
            height: 1.12,
            textureScale: 1.06,
            light: {
                bright: 15,
                dim: 26,
                color: "#ffb833",
                alpha: 0.44,
                luminosity: 0.50,
                saturation: 0.08,
                coloration: 1,
                animation: { type: "torch", speed: 4, intensity: 6, reverse: false }
            }
        }
    });

    /**
     * Scans a single actor's inventory for camp gear.
     * @param {Actor} actor
     * @returns {Object} Gear presence flags and item details.
     */
    static scanActor(actor) {
        const items = actor.items?.map(i => ({
            name: i.name?.toLowerCase() ?? "",
            quantity: i.system?.quantity ?? 1,
            originalName: i.name
        })) ?? [];

        const hasBedroll = items.some(i => i.name.includes("bedroll"));
        const hasTent = items.some(i => /(?:^|[\s,\-])tent\b/i.test(i.name));
        const hasMessKit = items.some(i =>
            i.name.includes("mess kit") ||
            (i.name.includes("cook") && i.name.includes("utensil"))
        );
        const hasTinderbox = items.some(i =>
            i.name.includes("tinderbox") ||
            i.name.includes("flint and steel") ||
            i.name.includes("flint & steel")
        );

        const firewoodCount = countActorFirewood(actor);

        return {
            actorId: actor.id,
            actorName: actor.name,
            actorImg: actor.img || "icons/svg/mystery-man.svg",
            hasBedroll,
            hasTent,
            hasMessKit,
            hasTinderbox,
            firewoodCount
        };
    }

    /**
     * Scans all party members and computes camp + personal comfort.
     * @param {string} terrainComfort - Base comfort from terrain (e.g. "rough").
     * @param {string} fireLevel - Fire level: "unlit", "embers", "campfire", or "bonfire".
     * @param {string|null} shelterSpell - Active shelter spell name, or null.
     * @param {string} comfortReason - Optional description of terrain comfort source.
     * @param {string} terrainLabel - Display name of the terrain.
     * @param {number} fireEncounterMod - Encounter DC modifier from having a fire.
     * @param {boolean} [safeRestSpot] - When true, skip comfort tiers and encounter fire modifier; fire reads as campfire for previews.
     * @returns {Object} Full camp scan results with comfort breakdown.
     */
    static scan(terrainComfort, fireLevel = "unlit", shelterSpell = null, comfortReason = "", terrainLabel = "", fireEncounterMod = 1, safeRestSpot = false) {
        const actors = getPartyActors();
        const members = actors.map(a => this.scanActor(a));

        if (safeRestSpot) {
            const campComfort = "safe";
            const rules = this.getRules(campComfort);
            const fireLevelEff = "campfire";
            const fireIsLit = true;
            const personalCards = members.map(m => {
                const actor = actors.find(a => a.id === m.actorId);
                const totalHd = actor?.system?.attributes?.hd?.max ?? actor?.system?.details?.level ?? 0;
                const rawHdRecovery = Math.max(1, Math.floor(totalHd / 2));
                const hdRecovered = Math.max(0, rawHdRecovery - rules.hdPenalty + (m.hasBedroll ? 1 : 0));
                const currentHd = actor?.system?.attributes?.hd?.value ?? totalHd;
                const exitHd = Math.min(totalHd, currentHd + hdRecovered);
                const breakdown = [];
                if (m.hasBedroll) {
                    breakdown.push({ label: localize("IONRIFT.RESPITE.RECOVERY.Bedroll"), icon: "fas fa-bed", delta: 1 });
                }
                return {
                    ...m,
                    personalComfort: campComfort,
                    personalComfortLabel: rules.label,
                    personalMatchesCamp: true,
                    gearBreakdown: breakdown,
                    recovery: {
                        hpFull: true,
                        hpLabel: localize("IONRIFT.RESPITE.RECOVERY.RegainAllHp"),
                        hpSeverity: "",
                        hdLabel: this._hdRecoveryLabel(hdRecovered, exitHd, totalHd),
                        hdSeverity: "",
                        hdRecovered,
                        totalHd,
                        exhaustionDC: null,
                        exhaustionSeverity: null,
                        exhaustionLabel: localize("IONRIFT.RESPITE.RECOVERY.NoExhaustionRisk")
                    }
                };
            });
            const fireLighters = members
                .filter(m => m.hasTinderbox)
                .map(m => ({
                    actorId: m.actorId,
                    actorName: m.actorName,
                    method: localize("IONRIFT.RESPITE.RECOVERY.Tinderbox")
                }));
            const firewoodHolders = members
                .filter(m => m.firewoodCount > 0)
                .map(m => ({ actorId: m.actorId, name: m.actorName, count: m.firewoodCount }));
            const totalFirewood = firewoodHolders.reduce((sum, h) => sum + h.count, 0);
            const costEmbers = this.FIREWOOD_COST_BY_LEVEL.embers ?? 0;
            const costCampfire = this.FIREWOOD_COST_BY_LEVEL.campfire ?? 1;
            const costBonfire = this.FIREWOOD_COST_BY_LEVEL.bonfire ?? 2;
            const canTinder = fireLighters.length > 0;
            return {
                campComfort,
                campComfortPreFire: campComfort,
                campComfortLabel: rules.label,
                comfortTooltip: localize("IONRIFT.RESPITE.RECOVERY.FullHpNoExhaustion"),
                campBreakdown: [{ label: terrainLabel || localize("IONRIFT.RESPITE.REST.SafeRestSpot"), value: "safe", delta: 0 }],
                comfortReason,
                terrainLabel,
                fireEncounterMod: 0,
                hasModifiers: false,
                personalCards,
                fireLighters,
                firewoodHolders,
                totalFirewood,
                canLightFire: fireLighters.length > 0,
                fireSelection: {
                    canPickEmbers: true,
                    canPickCampfire: true,
                    canPickBonfire: canTinder && totalFirewood >= costBonfire,
                    costEmbers,
                    costCampfire,
                    costBonfire
                },
                fireIsLit,
                fireLevel: fireLevelEff,
                shelterSpell: null,
                noFirePreview: null
            };
        }

        if (!isComfortEnabled()) {
            const campComfort = "safe";
            const rules = this.getRules(campComfort);
            const personalCards = members.map(m => {
                const actor = actors.find(a => a.id === m.actorId);
                const totalHd = actor?.system?.attributes?.hd?.max ?? actor?.system?.details?.level ?? 0;
                const rawHdRecovery = Math.max(1, Math.floor(totalHd / 2));
                const currentHd = actor?.system?.attributes?.hd?.value ?? totalHd;
                const exitHd = Math.min(totalHd, currentHd + rawHdRecovery);
                return {
                    ...m,
                    personalComfort: campComfort,
                    personalComfortLabel: rules.label,
                    personalMatchesCamp: true,
                    gearBreakdown: [],
                    recovery: {
                        hpFull: true,
                        hpLabel: localize("IONRIFT.RESPITE.RECOVERY.RegainAllHp"),
                        hpSeverity: "",
                        hdLabel: this._hdRecoveryLabel(rawHdRecovery, exitHd, totalHd),
                        hdSeverity: "",
                        hdRecovered: rawHdRecovery,
                        totalHd,
                        exhaustionDC: null,
                        exhaustionSeverity: null,
                        exhaustionLabel: localize("IONRIFT.RESPITE.RECOVERY.NoExhaustionRisk")
                    }
                };
            });
            return {
                campComfort,
                campComfortPreFire: campComfort,
                campComfortLabel: rules.label,
                comfortTooltip: localize("IONRIFT.RESPITE.COMFORT.Disabled"),
                campBreakdown: [{ label: terrainLabel || localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.BaseTerrain"), value: "safe", delta: 0 }],
                comfortReason,
                terrainLabel,
                fireEncounterMod: 0,
                hasModifiers: false,
                personalCards,
                fireLighters: [],
                firewoodHolders: [],
                totalFirewood: 0,
                canLightFire: false,
                fireSelection: {
                    canPickEmbers: false,
                    canPickCampfire: false,
                    canPickBonfire: false,
                    costEmbers: this.FIREWOOD_COST_BY_LEVEL.embers,
                    costCampfire: this.FIREWOOD_COST_BY_LEVEL.campfire,
                    costBonfire: this.FIREWOOD_COST_BY_LEVEL.bonfire
                },
                fireIsLit: false,
                fireLevel: "unlit",
                shelterSpell,
                noFirePreview: null
            };
        }

        let campComfort = COMFORT_TIERS.includes(terrainComfort) ? terrainComfort : "rough";

        const campBreakdown = [
            { label: terrainLabel || localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.BaseTerrain"), value: campComfort, delta: 0 }
        ];

        // Shelter spell overrides to sheltered minimum
        if (shelterSpell) {
            if (campComfort === "hostile" || campComfort === "rough") {
                campBreakdown.push({ label: shelterSpell, value: "sheltered", delta: campComfort === "hostile" ? 2 : 1 });
                campComfort = "sheltered";
            }
        }

        const campComfortPreFire = campComfort;

        // Fire comfort matches resolution engine (FIRE_COMFORT_MOD):
        // unlit: -1 | embers: 0 | campfire: 0 | bonfire: +1
        const FIRE_COMFORT = { unlit: -1, cold_camp: -1, embers: 0, campfire: 0, bonfire: 1 };
        const fireComfortDelta = FIRE_COMFORT[fireLevel] ?? 0;
        const fireIsLit = fireLevel !== "unlit" && fireLevel !== "cold_camp";

        if (fireLevel === "cold_camp") {
            campBreakdown.push({
                label: localize("IONRIFT.RESPITE.FIRE.LEVEL.cold_camp"),
                value: localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.MinusOneComfort"),
                delta: -1
            });
            campComfort = boostComfort(campComfort, -1);
        } else if (fireLevel === "unlit") {
            campBreakdown.push({
                label: localize("IONRIFT.RESPITE.FIRE.LEVEL.no_fire"),
                value: localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.MinusOneComfort"),
                delta: 0
            });
            campComfort = boostComfort(campComfort, -1);
        } else if (fireLevel === "embers") {
            campBreakdown.push({
                label: localize("IONRIFT.RESPITE.FIRE.LEVEL.embers"),
                value: localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.FireActive"),
                delta: 0
            });
        } else if (fireLevel === "campfire") {
            campBreakdown.push({
                label: localize("IONRIFT.RESPITE.FIRE.LEVEL.campfire"),
                value: localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.FireActive"),
                delta: 0
            });
        } else if (fireLevel === "bonfire") {
            campBreakdown.push({
                label: localize("IONRIFT.RESPITE.FIRE.LEVEL.bonfire"),
                value: localize("IONRIFT.RESPITE.COMFORT.BREAKDOWN.PlusOne"),
                delta: 1
            });
            campComfort = boostComfort(campComfort, 1);
        }

        const campComfortLabel = this.getRules(campComfort).label;
        const comfortTooltip = this._comfortTooltip(this.getRules(campComfort));

        const personalCards = members.map(m => {
            let personalComfort = campComfort;
            const breakdown = [];

            if (m.hasBedroll) {
                breakdown.push({ label: localize("IONRIFT.RESPITE.RECOVERY.Bedroll"), icon: "fas fa-bed", delta: 1 });
                personalComfort = boostComfort(personalComfort, 1);
            }
            // Tent: camp-wide weather shield and encounter DC buff. Benefits all party members, not personal comfort.

            const rules = this.getRules(personalComfort);

            // Recovery preview (approximate; final numbers come from RestFlowEngine)
            const actor = actors.find(a => a.id === m.actorId);
            const totalHd = actor?.system?.attributes?.hd?.max ?? actor?.system?.details?.level ?? 0;
            const rawHdRecovery = Math.max(1, Math.floor(totalHd / 2));
            const hdRecovered = Math.max(0, rawHdRecovery - rules.hdPenalty + (m.hasBedroll ? 1 : 0));

            const currentHd = actor?.system?.attributes?.hd?.value ?? totalHd;
            const exitHd = Math.min(totalHd, currentHd + hdRecovered);

            const hpSeverity = rules.hpFraction < 1.0 ? "danger" : "";
            let hdSeverity = "";
            if (hdRecovered === 0) hdSeverity = "danger";
            else if (rules.hdPenalty > 0) hdSeverity = "warning";

            return {
                ...m,
                personalComfort,
                personalComfortLabel: rules.label,
                personalMatchesCamp: personalComfort === campComfort,
                gearBreakdown: breakdown,
                recovery: {
                    hpFull: rules.hpFraction >= 1.0,
                    hpLabel: rules.hpFraction >= 1.0
                        ? localize("IONRIFT.RESPITE.RECOVERY.RegainAllHp")
                        : format("IONRIFT.RESPITE.RECOVERY.RegainHpPercent", { pct: Math.round(rules.hpFraction * 100) }),
                    hpSeverity,
                    hdLabel: this._hdRecoveryLabel(hdRecovered, exitHd, totalHd, rules.hdPenalty),
                    hdSeverity,
                    hdRecovered,
                    totalHd,
                    exhaustionDC: rules.exhaustionDC,
                    exhaustionSeverity: rules.exhaustionDC ? (personalComfort === "hostile" ? "danger" : "warning") : null,
                    exhaustionLabel: this._exhaustionLabel(rules.exhaustionDC, {
                        fireIsLit,
                        hasBedroll: m.hasBedroll
                    })
                }
            };
        });

        const fireLighters = members
            .filter(m => m.hasTinderbox)
            .map(m => ({
                actorId: m.actorId,
                actorName: m.actorName,
                method: localize("IONRIFT.RESPITE.RECOVERY.Tinderbox")
            }));

        const firewoodHolders = members
            .filter(m => m.firewoodCount > 0)
            .map(m => ({ actorId: m.actorId, name: m.actorName, count: m.firewoodCount }));

        const totalFirewood = firewoodHolders.reduce((sum, h) => sum + h.count, 0);

        const costEmbers = this.FIREWOOD_COST_BY_LEVEL.embers ?? 0;
        const costCampfire = this.FIREWOOD_COST_BY_LEVEL.campfire ?? 1;
        const costBonfire = this.FIREWOOD_COST_BY_LEVEL.bonfire ?? 2;
        const canTinder = fireLighters.length > 0;
        const fireSelection = {
            canPickEmbers: canTinder && totalFirewood >= costEmbers,
            canPickCampfire: canTinder && totalFirewood >= costCampfire,
            canPickBonfire: canTinder && totalFirewood >= costBonfire,
            costEmbers,
            costCampfire,
            costBonfire
        };

        // Undo the current fire delta and apply the unlit penalty (-1)
        const noFireComfort = boostComfort(campComfortPreFire, FIRE_COMFORT.unlit);
        const noFireRules = this.getRules(noFireComfort);

        return {
            campComfort,
            campComfortPreFire,
            campComfortLabel,
            comfortTooltip,
            campBreakdown,
            comfortReason,
            terrainLabel,
            fireEncounterMod,
            hasModifiers: campBreakdown.length > 1,
            personalCards,
            fireLighters,
            firewoodHolders,
            totalFirewood,
            canLightFire: fireLighters.length > 0,
            fireSelection,
            fireIsLit,
            fireLevel,
            shelterSpell,

            // "Without fire" comparison data (only relevant if fire IS lit)
            noFirePreview: fireIsLit ? {
                comfort: noFireComfort,
                comfortLabel: noFireRules.label,
                hpLabel: noFireRules.hpFraction >= 1.0
                    ? localize("IONRIFT.RESPITE.RECOVERY.HpStillFull")
                    : format("IONRIFT.RESPITE.RECOVERY.HpPercentRecoveryShort", { pct: Math.round(noFireRules.hpFraction * 100) }),
                hdLabel: noFireRules.hdPenalty > 0
                    ? format("IONRIFT.RESPITE.RECOVERY.HdRecoveryReduced", { penalty: noFireRules.hdPenalty })
                    : localize("IONRIFT.RESPITE.RECOVERY.HdRecoveryUnchanged"),
                exhaustionDC: noFireRules.exhaustionDC,
                exhaustionLabel: noFireRules.exhaustionDC
                    ? format("IONRIFT.RESPITE.RECOVERY.ConSaveOrExhaustion", { dc: noFireRules.exhaustionDC })
                    : localize("IONRIFT.RESPITE.RECOVERY.NoExhaustionRisk")
            } : null
        };
    }
}
