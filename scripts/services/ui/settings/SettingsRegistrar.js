import { EventBrowserApp } from "../../../apps/events/EventBrowserApp.js";
import { ActivityConfigApp } from "../../../apps/crafting/ActivityConfigApp.js";
import { RecoveryConfigApp } from "../../../apps/rest/RecoveryConfigApp.js";
import { isComfortEnabled } from "../../camp/gear/ComfortCalculator.js";
import { PlayerRestrictionsApp } from "../../../apps/rest/PlayerRestrictionsApp.js";
import { RecipeEditorApp } from "../../../apps/crafting/RecipeEditorApp.js";
import { applyCustomRecipesToLiveEngines } from "../../crafting/recipes/RecipeCatalog.js";
import { migrateFletchingYieldTier } from "../../crafting/settings/FletchingSettings.js";
import { migrateTrainingXpTier } from "../../crafting/settings/TrainingSettings.js";
import { migrateUseTravel } from "../../travel/settings/TravelSettings.js";
import { registerRespiteSettingsPanel } from "./SettingsPanelLayout.js";
import { MODULE_ID } from "../../../data/moduleId.js";
import { localize } from "../../../utils/I18n.js";

/**
 * Registers all module settings, menus, and item enrichment entries.
 * Must be called during the init hook, after `game.ionrift.respite` is constructed.
 *
 * @param {object} opts
 * @param {typeof import("../../../apps/meal/DietConfigApp.js").DietConfigApp} opts.DietConfigApp
 * @param {function} opts.onAmbientAfkChange - Callback when ambientAfkHud setting changes.
 */
export function registerAllSettings({ DietConfigApp, onAmbientAfkChange }) {

    game.settings.registerMenu(MODULE_ID, "eventBrowser", {
        name: "IONRIFT.RESPITE.SETTINGS.eventBrowserName",
        label: "IONRIFT.RESPITE.SETTINGS.eventBrowserLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.eventBrowserHint",
        icon: "fas fa-book-open",
        type: EventBrowserApp,
        restricted: true
    });

    // Menu removed: roster UI now lives in ionrift-library (game.ionrift.library.party).
    // Setting kept so the library migration hook can seed from existing Respite data.
    game.settings.register(MODULE_ID, "partyRoster", {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    game.settings.registerMenu(MODULE_ID, "dietConfigMenu", {
        name: "IONRIFT.RESPITE.SETTINGS.dietConfigMenuName",
        label: "IONRIFT.RESPITE.SETTINGS.dietConfigMenuLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.dietConfigMenuHint",
        icon: "fas fa-utensils",
        type: DietConfigApp,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "activityConfig", {
        name: "IONRIFT.RESPITE.SETTINGS.activityConfigName",
        label: "IONRIFT.RESPITE.SETTINGS.activityConfigLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.activityConfigHint",
        icon: "fas fa-campground",
        type: ActivityConfigApp,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "recipeEditor", {
        name: "IONRIFT.RESPITE.SETTINGS.recipeEditorName",
        label: "IONRIFT.RESPITE.SETTINGS.recipeEditorLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.recipeEditorHint",
        icon: "fas fa-mortar-pestle",
        type: RecipeEditorApp,
        restricted: true
    });

    game.settings.register(MODULE_ID, "customRecipes", {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        restricted: true,
        onChange: () => {
            applyCustomRecipesToLiveEngines({ render: true });
        }
    });

    game.settings.registerMenu(MODULE_ID, "recoveryConfig", {
        name: "IONRIFT.RESPITE.SETTINGS.recoveryConfigName",
        label: "IONRIFT.RESPITE.SETTINGS.recoveryConfigLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.recoveryConfigHint",
        icon: "fas fa-heart-pulse",
        type: RecoveryConfigApp,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "playerRestrictions", {
        name: "IONRIFT.RESPITE.SETTINGS.playerRestrictionsName",
        label: "IONRIFT.RESPITE.SETTINGS.playerRestrictionsLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.playerRestrictionsHint",
        icon: "fas fa-user-lock",
        type: PlayerRestrictionsApp,
        restricted: true
    });

    game.settings.register(MODULE_ID, "restInterfaceMode", {
        name: "IONRIFT.RESPITE.SETTINGS.restInterfaceModeName",
        hint: "IONRIFT.RESPITE.SETTINGS.restInterfaceModeHint",
        scope: "world",
        config: true,
        type: String,
        default: "theater",
        choices: {
            theater: "IONRIFT.RESPITE.SETTINGS.restInterfaceModeChoices.theater",
            stations: "IONRIFT.RESPITE.SETTINGS.restInterfaceModeChoices.stations"
        },
        restricted: true
    });

    game.settings.register(MODULE_ID, "interceptRests", {
        name: "IONRIFT.RESPITE.SETTINGS.interceptRestsName",
        hint: "IONRIFT.RESPITE.SETTINGS.interceptRestsHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "armorDoffRule", {
        name: "IONRIFT.RESPITE.SETTINGS.armorDoffRuleName",
        hint: "IONRIFT.RESPITE.SETTINGS.armorDoffRuleHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableComfort", {
        name: "IONRIFT.RESPITE.SETTINGS.enableComfortName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableComfortHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => registerItemEnrichments()
    });

    game.settings.register(MODULE_ID, "enableCampfireMinigame", {
        name: "IONRIFT.RESPITE.SETTINGS.enableCampfireMinigameName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableCampfireMinigameHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableWorkbenchIdentify", {
        name: "IONRIFT.RESPITE.SETTINGS.enableWorkbenchIdentifyName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableWorkbenchIdentifyHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "spellRecoveryMaxLevel", {
        name: "IONRIFT.RESPITE.SETTINGS.spellRecoveryMaxLevelName",
        hint: "IONRIFT.RESPITE.SETTINGS.spellRecoveryMaxLevelHint",
        scope: "world",
        config: false,
        type: Number,
        default: 5,
        range: { min: 1, max: 9, step: 1 },
        restricted: true
    });

    game.settings.register(MODULE_ID, "songOfRestTiming", {
        name: "IONRIFT.RESPITE.SETTINGS.songOfRestTimingName",
        hint: "IONRIFT.RESPITE.SETTINGS.songOfRestTimingHint",
        scope: "world",
        config: false,
        type: String,
        default: "endOfRest",
        choices: {
            endOfRest: "IONRIFT.RESPITE.SETTINGS.songOfRestTimingChoices.endOfRest",
            withFirstHitDie: "IONRIFT.RESPITE.SETTINGS.songOfRestTimingChoices.withFirstHitDie",
        },
        restricted: true,
    });

    game.settings.register(MODULE_ID, "maxValueHitDice", {
        name: "IONRIFT.RESPITE.SETTINGS.maxValueHitDiceName",
        hint: "IONRIFT.RESPITE.SETTINGS.maxValueHitDiceHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
    });

    game.settings.register(MODULE_ID, "maxWaterPerDayCap", {
        name: "IONRIFT.RESPITE.SETTINGS.maxWaterPerDayCapName",
        hint: "IONRIFT.RESPITE.SETTINGS.maxWaterPerDayCapHint",
        scope: "world",
        config: false,
        type: Number,
        default: 4,
        restricted: true
    });

    game.settings.register(MODULE_ID, "maxFoodPerDayCap", {
        name: "IONRIFT.RESPITE.SETTINGS.maxFoodPerDayCapName",
        hint: "IONRIFT.RESPITE.SETTINGS.maxFoodPerDayCapHint",
        scope: "world",
        config: false,
        type: Number,
        default: 3,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableTraining", {
        name: "IONRIFT.RESPITE.SETTINGS.enableTrainingName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableTrainingHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "trainingXpTier", {
        name: "IONRIFT.RESPITE.SETTINGS.trainingXpTierName",
        hint: "IONRIFT.RESPITE.SETTINGS.trainingXpTierHint",
        scope: "world",
        config: false,
        type: Number,
        default: 0,
        restricted: true
    });

    game.settings.register(MODULE_ID, "trainingXpTierMigrated", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "enableProfessions", {
        name: "IONRIFT.RESPITE.SETTINGS.enableProfessionsName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableProfessionsHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableBrewingAlcohol", {
        name: "IONRIFT.RESPITE.SETTINGS.enableBrewingAlcoholName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableBrewingAlcoholHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true,
        onChange: () => {
            const live = foundry.applications.instances.get("ionrift-respite-setup");
            if (live?.render) live.render();
        }
    });

    game.settings.register(MODULE_ID, "chefTreatCookingOnly", {
        name: "IONRIFT.RESPITE.SETTINGS.chefTreatCookingOnlyName",
        hint: "IONRIFT.RESPITE.SETTINGS.chefTreatCookingOnlyHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => {
            const live = foundry.applications.instances.get("ionrift-respite-setup");
            applyCustomRecipesToLiveEngines({ render: true });
            if (live?.render) live.render();
        }
    });

    game.settings.register(MODULE_ID, "enableFletching", {
        name: "IONRIFT.RESPITE.SETTINGS.enableFletchingName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableFletchingHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "fletchingYieldTier", {
        name: "IONRIFT.RESPITE.SETTINGS.fletchingYieldTierName",
        hint: "IONRIFT.RESPITE.SETTINGS.fletchingYieldTierHint",
        scope: "world",
        config: false,
        type: Number,
        default: 1,
        restricted: true
    });

    game.settings.register(MODULE_ID, "fletchingYieldTierMigrated", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "enableEncounters", {
        name: "IONRIFT.RESPITE.SETTINGS.enableEncountersName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableEncountersHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableCopySpell", {
        name: "IONRIFT.RESPITE.SETTINGS.enableCopySpellName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableCopySpellHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enablePrayMeditate", {
        name: "IONRIFT.RESPITE.SETTINGS.enablePrayMeditateName",
        hint: "IONRIFT.RESPITE.SETTINGS.enablePrayMeditateHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableScouting", {
        name: "IONRIFT.RESPITE.SETTINGS.enableScoutingName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableScoutingHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableForaging", {
        name: "IONRIFT.RESPITE.SETTINGS.enableForagingName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableForagingHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "enableHunting", {
        name: "IONRIFT.RESPITE.SETTINGS.enableHuntingName",
        hint: "IONRIFT.RESPITE.SETTINGS.enableHuntingHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "campFuelFindChance", {
        name: "IONRIFT.RESPITE.SETTINGS.campFuelFindChanceName",
        hint: "IONRIFT.RESPITE.SETTINGS.campFuelFindChanceHint",
        scope: "world",
        config: false,
        type: Number,
        default: 5,
        restricted: true,
        onChange: () => {
            import("../../travel/forage/ForageTableSync.js").then(({ ForageTableSync }) => {
                ForageTableSync.scheduleSync();
            });
        }
    });

    game.settings.register(MODULE_ID, "homebrewProvisionOnly", {
        name: "IONRIFT.RESPITE.SETTINGS.homebrewProvisionOnlyName",
        hint: "IONRIFT.RESPITE.SETTINGS.homebrewProvisionOnlyHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true,
        onChange: () => {
            const live = foundry.applications.instances.get("ionrift-respite-setup");
            applyCustomRecipesToLiveEngines({ render: true });
            if (live?._travel?.getTravelResolver) {
                import("../../travel/resolve/TravelProvisionIndex.js").then(async ({ applyTravelProvisionBatches }) => {
                    await applyTravelProvisionBatches(live._travel.getTravelResolver());
                    if (live.render) await live.render();
                });
            }
            import("../../travel/forage/ForageTableSync.js").then(({ ForageTableSync }) => {
                ForageTableSync.scheduleSync();
            });
        }
    });

    game.settings.register(MODULE_ID, "useTravel", {
        name: "IONRIFT.RESPITE.SETTINGS.useTravelName",
        hint: "IONRIFT.RESPITE.SETTINGS.useTravelHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "useTravelMigrated", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    game.settings.register(MODULE_ID, "useTravelPhaseSemanticsMigrated", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    // Surfaced in the Food & Diet dialog (DietConfigApp), not the native panel.
    // Default off so a fresh world matches the Standard Quick Setup profile;
    // the Survival profile turns meal tracking on.
    game.settings.register(MODULE_ID, "trackFood", {
        name: "IONRIFT.RESPITE.SETTINGS.trackFoodName",
        hint: "IONRIFT.RESPITE.SETTINGS.trackFoodHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    // Default off so a fresh world matches the Standard Quick Setup profile;
    // the Survival profile turns this leniency on alongside meal tracking.
    game.settings.register(MODULE_ID, "partialSustenance", {
        name: "IONRIFT.RESPITE.SETTINGS.partialSustenanceName",
        hint: "IONRIFT.RESPITE.SETTINGS.partialSustenanceHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    // Surfaced in the Food & Diet dialog (DietConfigApp), not the native panel.
    game.settings.register(MODULE_ID, "spoilageNameSuffix", {
        name: "IONRIFT.RESPITE.SETTINGS.spoilageNameSuffixName",
        hint: "IONRIFT.RESPITE.SETTINGS.spoilageNameSuffixHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    game.settings.register(MODULE_ID, "lockPlayerQuantity", {
        name: "IONRIFT.RESPITE.SETTINGS.lockPlayerQuantityName",
        hint: "IONRIFT.RESPITE.SETTINGS.lockPlayerQuantityHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    game.settings.register(MODULE_ID, "lockAttuneOutsideRest", {
        name: "IONRIFT.RESPITE.SETTINGS.lockAttuneOutsideRestName",
        hint: "IONRIFT.RESPITE.SETTINGS.lockAttuneOutsideRestHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    /** Remembered from Rest Setup: long rest uses safe rest spot (no encounter risk). */
    game.settings.register(MODULE_ID, "safeRestSpot", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "campfireTokenName", {
        name: "IONRIFT.RESPITE.SETTINGS.campfireTokenNameName",
        hint: "IONRIFT.RESPITE.SETTINGS.campfireTokenNameHint",
        scope: "world",
        config: false,
        type: String,
        default: "Campfire",
        restricted: true
    });

    game.settings.register(MODULE_ID, "torchTokenName", {
        name: "IONRIFT.RESPITE.SETTINGS.torchTokenNameName",
        hint: "IONRIFT.RESPITE.SETTINGS.torchTokenNameHint",
        scope: "world",
        config: false,
        type: String,
        default: "Perimeter Torch",
        restricted: true
    });

    game.settings.register(MODULE_ID, "torchAutoLink", {
        name: "IONRIFT.RESPITE.SETTINGS.torchAutoLinkName",
        hint: "IONRIFT.RESPITE.SETTINGS.torchAutoLinkHint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });

    game.settings.register(MODULE_ID, "customFoodNames", {
        name: "IONRIFT.RESPITE.SETTINGS.customFoodNamesName",
        hint: "IONRIFT.RESPITE.SETTINGS.customFoodNamesHint",
        scope: "world",
        config: false,
        type: String,
        default: "",
        restricted: true
    });

    game.settings.register(MODULE_ID, "customWaterNames", {
        name: "IONRIFT.RESPITE.SETTINGS.customWaterNamesName",
        hint: "IONRIFT.RESPITE.SETTINGS.customWaterNamesHint",
        scope: "world",
        config: false,
        type: String,
        default: "",
        restricted: true
    });

    game.settings.register(MODULE_ID, "restRecoveryDetected", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "lastRestDate", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "lastTerrain", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "lastWeather", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "activeRest", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "activeShortRest", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "enabledPacks", {
        scope: "world",
        config: false,
        type: Object,
        default: { base: true }
    });

    game.settings.register(MODULE_ID, "eventPoolSelection", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "eventPoolInitialized", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "eventPoolNudgeSuppressed", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "eventPoolNudgeSnoozedUntil", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "importedPacks", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "artPackDisabled", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "artPackCache", {
        scope: "world",
        config: false,
        type: Object,
        default: { active: false, path: null, terrains: [] }
    });

    game.settings.register(MODULE_ID, "artNudgeSnoozedUntil", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "artNudgeSuppressed", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    // PF2e early-support advisory (one-time)
    game.settings.register(MODULE_ID, "pf2eAdvisoryShown", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    const SettingsLayout = game.ionrift?.library?.SettingsLayout;
    SettingsLayout?.registerFooter(MODULE_ID, {
        wiki: "https://github.com/ionrift-gm/ionrift-respite/wiki"
    });

    game.settings.register(MODULE_ID, "ambientAfkHud", {
        name: "IONRIFT.RESPITE.SETTINGS.ambientAfkHudName",
        hint: "IONRIFT.RESPITE.SETTINGS.ambientAfkHudHint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: onAmbientAfkChange,
        restricted: true
    });

    game.settings.register(MODULE_ID, "afkPanelLayout", {
        name: "IONRIFT.RESPITE.SETTINGS.afkPanelLayoutName",
        scope: "client",
        config: false,
        type: Object,
        default: { locked: true, left: 12, top: 120 }
    });

    game.settings.register(MODULE_ID, "debug", {
        name: "IONRIFT.RESPITE.SETTINGS.debugName",
        hint: "IONRIFT.RESPITE.SETTINGS.debugHint",
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "clearRestState", {
        name: "IONRIFT.RESPITE.SETTINGS.clearRestStateName",
        label: "IONRIFT.RESPITE.SETTINGS.clearRestStateLabel",
        hint: "IONRIFT.RESPITE.SETTINGS.clearRestStateHint",
        icon: "fas fa-broom",
        type: class ClearRestStateApp extends FormApplication {
            async _updateObject() {
                await game.ionrift.respite.resetFlowState();
            }
            async render() {
                const proceed = await Dialog.confirm({
                    title: localize("IONRIFT.RESPITE.SETTINGS.clearRestStateTitle"),
                    content: `<p>${localize("IONRIFT.RESPITE.SETTINGS.clearRestStateConfirm")}</p>`,
                    yes: () => true,
                    no: () => false,
                    defaultYes: false
                });
                if (proceed) await this._updateObject();
            }
        },
        restricted: true
    });

    registerRespiteSettingsPanel();
}

Hooks.once("ready", () => {
    migrateTrainingXpTier();
    migrateFletchingYieldTier();
    migrateUseTravel();
});

/**
 * Registers Respite-specific item enrichments with the shared library engine.
 * Called during init, after the library is available.
 */
export function registerItemEnrichments() {
    const comfortOn = isComfortEnabled();
    const L = (key) => localize(key);
    const tag = {
        hd: L("IONRIFT.RESPITE.ENRICHMENT.TAG.HdRecovery"),
        comfortOff: L("IONRIFT.RESPITE.ENRICHMENT.TAG.ComfortOff"),
        shelter: L("IONRIFT.RESPITE.ENRICHMENT.TAG.Shelter"),
        weather: L("IONRIFT.RESPITE.ENRICHMENT.TAG.WeatherProtection"),
        fullWeather: L("IONRIFT.RESPITE.ENRICHMENT.TAG.FullWeatherProtection"),
        exhaustion: L("IONRIFT.RESPITE.ENRICHMENT.TAG.ExhaustionAdvantage"),
        cooking: L("IONRIFT.RESPITE.ENRICHMENT.TAG.CookingProfession"),
        meal: L("IONRIFT.RESPITE.ENRICHMENT.TAG.MealPhase"),
        dehydration: L("IONRIFT.RESPITE.ENRICHMENT.TAG.Dehydration"),
        herbalism: L("IONRIFT.RESPITE.ENRICHMENT.TAG.HerbalismProfession"),
        tend: L("IONRIFT.RESPITE.ENRICHMENT.TAG.TendWounds"),
        alchemy: L("IONRIFT.RESPITE.ENRICHMENT.TAG.AlchemyProfession"),
        tinkering: L("IONRIFT.RESPITE.ENRICHMENT.TAG.TinkeringProfession"),
        campfire: L("IONRIFT.RESPITE.ENRICHMENT.TAG.CampfireRequired"),
        perish1: L("IONRIFT.RESPITE.ENRICHMENT.TAG.Perishable1"),
        perish3: L("IONRIFT.RESPITE.ENRICHMENT.TAG.Perishable3"),
        cookIng: L("IONRIFT.RESPITE.ENRICHMENT.TAG.CookingIngredient"),
        premium: L("IONRIFT.RESPITE.ENRICHMENT.TAG.PremiumIngredient"),
        edible: L("IONRIFT.RESPITE.ENRICHMENT.TAG.EdibleRaw"),
        herbIng: L("IONRIFT.RESPITE.ENRICHMENT.TAG.HerbalismIngredient"),
        shelf: L("IONRIFT.RESPITE.ENRICHMENT.TAG.ShelfStable")
    };
    const tentHtml = L("IONRIFT.RESPITE.ENRICHMENT.tent");
    const rationsHtml = L("IONRIFT.RESPITE.ENRICHMENT.rations");
    game.ionrift?.library?.enrichment?.registerBatch({

        "bedroll": {
            html: comfortOn ? L("IONRIFT.RESPITE.ENRICHMENT.bedroll.on") : L("IONRIFT.RESPITE.ENRICHMENT.bedroll.off"),
            tags: comfortOn ? [tag.hd] : [tag.comfortOff]
        },

        "two-person tent": {
            html: tentHtml,
            tags: [tag.shelter, tag.weather]
        },
        "tent, two-person": {
            html: tentHtml,
            tags: [tag.shelter, tag.weather]
        },
        "pavilion": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.pavilion"),
            tags: [tag.shelter, tag.fullWeather]
        },
        "tent": {
            html: tentHtml,
            tags: [tag.shelter, tag.weather]
        },

        "mess kit": {
            html: comfortOn ? L("IONRIFT.RESPITE.ENRICHMENT.messKit.on") : L("IONRIFT.RESPITE.ENRICHMENT.messKit.off"),
            tags: comfortOn ? [tag.exhaustion] : [tag.comfortOff]
        },

        "cook's utensils": {
            html: comfortOn ? L("IONRIFT.RESPITE.ENRICHMENT.cooksUtensils.on") : L("IONRIFT.RESPITE.ENRICHMENT.cooksUtensils.off"),
            tags: comfortOn ? [tag.exhaustion, tag.cooking] : [tag.cooking, tag.comfortOff]
        },

        "rations": {
            html: rationsHtml,
            tags: [tag.meal]
        },
        "rations (1 day)": {
            html: rationsHtml,
            tags: [tag.meal]
        },

        "waterskin": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.waterskin"),
            tags: [tag.meal, tag.dehydration]
        },

        "herbalism kit": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.herbalismKit"),
            tags: [tag.herbalism]
        },

        "healer's kit": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.healersKit"),
            tags: [tag.tend]
        },

        "alchemist's supplies": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.alchemistSupplies"),
            tags: [tag.alchemy]
        },

        "tinker's tools": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.tinkersTools"),
            tags: [tag.tinkering]
        },

        "tinderbox": {
            html: comfortOn ? L("IONRIFT.RESPITE.ENRICHMENT.tinderbox.on") : L("IONRIFT.RESPITE.ENRICHMENT.tinderbox.off"),
            tags: comfortOn ? [tag.campfire] : [tag.comfortOff]
        },

        "fresh meat": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.freshMeat"),
            tags: [tag.perish1, tag.cookIng]
        },
        "fresh fish": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.fish"),
            tags: [tag.perish1, tag.cookIng]
        },
        "choice cut": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.choiceCut"),
            tags: [tag.perish1, tag.premium]
        },
        "wild berries": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.berries"),
            tags: [tag.perish3, tag.edible, tag.cookIng]
        },
        "edible berries": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.fruit"),
            tags: [tag.perish3, tag.edible, tag.cookIng]
        },
        "edible mushrooms": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.mushrooms"),
            tags: [tag.perish3, tag.cookIng]
        },
        "wild herbs": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.herbs"),
            tags: [tag.perish3, tag.cookIng, tag.herbIng]
        },
        "healing herbs": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.medicinalHerbs"),
            tags: [tag.perish3, tag.herbIng]
        },
        "spiced jerky": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.jerky"),
            tags: [tag.shelf, tag.meal]
        },
        "smoked fish": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.curedFish"),
            tags: [tag.shelf, tag.meal]
        },
        "bird eggs": {
            html: L("IONRIFT.RESPITE.ENRICHMENT.birdEggs"),
            tags: [tag.perish1, tag.cookIng]
        }
    });
}

/**
 * All setting keys registered by this module.
 * Useful for structural tests that verify every expected key is present.
 */
export const SETTING_KEYS = [
    "partyRoster",
    "restInterfaceMode",
    "interceptRests",
    "armorDoffRule",
    "enableComfort",
    "enableCampfireMinigame",
    "enableWorkbenchIdentify",
    "spellRecoveryMaxLevel",
    "songOfRestTiming",
    "maxValueHitDice",
    "enableTraining",
    "trainingXpTier",
    "trainingXpTierMigrated",
    "enableProfessions",
    "enableBrewingAlcohol",
    "chefTreatCookingOnly",
    "enableFletching",
    "fletchingYieldTier",
    "fletchingYieldTierMigrated",
    "enableEncounters",
    "enableCopySpell",
    "enablePrayMeditate",
    "enableScouting",
    "enableForaging",
    "enableHunting",
    "campFuelFindChance",
    "homebrewProvisionOnly",
    "useTravel",
    "useTravelPhaseSemanticsMigrated",
    "trackFood",
    "partialSustenance",
    "spoilageNameSuffix",
    "lockPlayerQuantity",
    "lockAttuneOutsideRest",
    "safeRestSpot",
    "campfireTokenName",
    "torchTokenName",
    "torchAutoLink",
    "customFoodNames",
    "customWaterNames",
    "restRecoveryDetected",
    "lastRestDate",
    "lastTerrain",
    "lastWeather",
    "activeRest",
    "activeShortRest",
    "enabledPacks",
    "eventPoolSelection",
    "eventPoolInitialized",
    "eventPoolNudgeSuppressed",
    "eventPoolNudgeSnoozedUntil",
    "importedPacks",
    "artPackDisabled",
    "artPackCache",
    "artNudgeSnoozedUntil",
    "artNudgeSuppressed",
    "pf2eAdvisoryShown",
    "ambientAfkHud",
    "afkPanelLayout",
    "debug"
];

/**
 * All menu keys registered by this module.
 */
export const MENU_KEYS = [
    "dietConfigMenu",
    "clearRestState"
];

/**
 * All enrichment item names registered.
 */
export const ENRICHMENT_KEYS = [
    "bedroll",
    "two-person tent",
    "tent, two-person",
    "pavilion",
    "tent",
    "mess kit",
    "cook's utensils",
    "rations",
    "rations (1 day)",
    "waterskin",
    "herbalism kit",
    "healer's kit",
    "alchemist's supplies",
    "tinker's tools",
    "tinderbox",
    "fresh meat",
    "fresh fish",
    "choice cut",
    "wild berries",
    "edible berries",
    "edible mushrooms",
    "wild herbs",
    "healing herbs",
    "spiced jerky",
    "smoked fish",
    "bird eggs"
];
