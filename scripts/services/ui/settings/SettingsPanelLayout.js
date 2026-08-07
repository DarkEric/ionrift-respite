import { getFletchingTierLabel } from "../../crafting/settings/FletchingSettings.js";
import { getTrainingTierLabel } from "../../crafting/settings/TrainingSettings.js";
import { MODULE_ID } from "../../../data/moduleId.js";
import { localize } from "../../../utils/I18n.js";

const COMPLEXITY_KEYS = [
    "enableComfort",
    "enableCampfireMinigame",
    "enableProfessions",
    "trainingXpTier",
    "fletchingYieldTier",
    "enableEncounters",
    "enableCopySpell",
    "enablePrayMeditate",
    "enableScouting",
    "enableForaging",
    "enableHunting",
    "useTravel",
    "trackFood",
    "partialSustenance",
    "armorDoffRule"
];

const PLAYER_KEYS = [
    "interceptRests",
    "lockAttuneOutsideRest",
    "lockPlayerQuantity"
];

const PROFILE_KEYS = [...COMPLEXITY_KEYS, ...PLAYER_KEYS];

const KEY_LABELS = {
    enableComfort: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableComfortLabel",
    enableCampfireMinigame: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableCampfireMinigameLabel",
    enableProfessions: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableProfessionsLabel",
    trainingXpTier: "IONRIFT.RESPITE.SETTINGS.PANEL.TrainingXpTierLabel",
    fletchingYieldTier: "IONRIFT.RESPITE.SETTINGS.PANEL.FletchingYieldTierLabel",
    enableEncounters: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableEncountersLabel",
    enableCopySpell: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableCopySpellLabel",
    enablePrayMeditate: "IONRIFT.RESPITE.SETTINGS.PANEL.EnablePrayMeditateLabel",
    enableScouting: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableScoutingLabel",
    enableForaging: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableForagingLabel",
    enableHunting: "IONRIFT.RESPITE.SETTINGS.PANEL.EnableHuntingLabel",
    useTravel: "IONRIFT.RESPITE.SETTINGS.PANEL.UseTravelLabel",
    trackFood: "IONRIFT.RESPITE.SETTINGS.PANEL.TrackFoodLabel",
    partialSustenance: "IONRIFT.RESPITE.SETTINGS.PANEL.PartialSustenanceLabel",
    armorDoffRule: "IONRIFT.RESPITE.SETTINGS.PANEL.ArmorDoffRuleLabel",
    interceptRests: "IONRIFT.RESPITE.SETTINGS.PANEL.InterceptRestsLabel",
    lockAttuneOutsideRest: "IONRIFT.RESPITE.SETTINGS.PANEL.LockAttuneOutsideRestLabel",
    lockPlayerQuantity: "IONRIFT.RESPITE.SETTINGS.PANEL.LockPlayerQuantityLabel"
};

const PROFILES = [
    {
        id: "simple",
        label: "IONRIFT.RESPITE.SETTINGS.PANEL.ProfileSimpleTitle",
        icon: "fas fa-feather",
        desc: "IONRIFT.RESPITE.SETTINGS.PANEL.ProfileSimpleDesc",
        values: {
            enableComfort: false,
            enableCampfireMinigame: false,
            enableProfessions: false,
            trainingXpTier: 0,
            fletchingYieldTier: 0,
            enableEncounters: false,
            enableCopySpell: false,
            enablePrayMeditate: false,
            enableScouting: false,
            enableForaging: true,
            enableHunting: true,
            useTravel: false,
            trackFood: false,
            partialSustenance: false,
            armorDoffRule: false,
            interceptRests: true,
            lockAttuneOutsideRest: false,
            lockPlayerQuantity: false
        }
    },
    {
        id: "standard",
        label: "IONRIFT.RESPITE.SETTINGS.PANEL.ProfileStandardTitle",
        icon: "fas fa-campground",
        desc: "IONRIFT.RESPITE.SETTINGS.PANEL.ProfileStandardDesc",
        values: {
            enableComfort: false,
            enableCampfireMinigame: true,
            enableProfessions: true,
            trainingXpTier: 0,
            fletchingYieldTier: 1,
            enableEncounters: true,
            enableCopySpell: true,
            enablePrayMeditate: false,
            enableScouting: false,
            enableForaging: true,
            enableHunting: true,
            useTravel: true,
            trackFood: false,
            partialSustenance: false,
            armorDoffRule: true,
            interceptRests: true,
            lockAttuneOutsideRest: true,
            lockPlayerQuantity: false
        }
    },
    {
        id: "survival",
        label: "IONRIFT.RESPITE.SETTINGS.PANEL.ProfileSurvivalTitle",
        icon: "fas fa-mountain-sun",
        desc: "IONRIFT.RESPITE.SETTINGS.PANEL.ProfileSurvivalDesc",
        values: {
            enableComfort: true,
            enableCampfireMinigame: true,
            enableProfessions: true,
            trainingXpTier: 0,
            fletchingYieldTier: 1,
            enableEncounters: true,
            enableCopySpell: true,
            enablePrayMeditate: false,
            enableScouting: true,
            enableForaging: true,
            enableHunting: true,
            useTravel: true,
            trackFood: true,
            partialSustenance: true,
            armorDoffRule: true,
            interceptRests: true,
            lockAttuneOutsideRest: true,
            lockPlayerQuantity: true
        }
    }
];

const GROUPS = [
    { title: "IONRIFT.RESPITE.SETTINGS.PANEL.GroupStartHere", icon: "fas fa-flag", keys: ["restInterfaceMode", "eventBrowser"] },
    { title: "IONRIFT.RESPITE.SETTINGS.PANEL.GroupRulesAndActivities", icon: "fas fa-scroll", keys: ["recoveryConfig", "activityConfig", "dietConfigMenu"] },
    { title: "IONRIFT.RESPITE.SETTINGS.PANEL.GroupPlayers", icon: "fas fa-users", keys: ["playerRestrictions"] },
    { title: "IONRIFT.RESPITE.SETTINGS.PANEL.GroupDisplay", icon: "fas fa-eye", keys: ["ambientAfkHud"] },
    { title: "IONRIFT.RESPITE.SETTINGS.PANEL.GroupTools", icon: "fas fa-wrench", keys: ["clearRestState"] }
];

/**
 * @param {string} key
 * @param {*} value
 * @returns {{ text: string, cssClass: string }}
 */
function formatProfileCell(key, value) {
    if (key === "trainingXpTier") {
        const tier = Number(value) || 0;
        const text = getTrainingTierLabel(tier);
        return { text, cssClass: tier > 0 ? "on" : "off" };
    }
    if (key === "fletchingYieldTier") {
        const tier = Number(value) || 0;
        const text = getFletchingTierLabel(tier);
        return { text, cssClass: tier > 0 ? "on" : "off" };
    }
    return {
        text: value
            ? localize("IONRIFT.RESPITE.SETTINGS.PANEL.On")
            : localize("IONRIFT.RESPITE.SETTINGS.PANEL.Off"),
        cssClass: value ? "on" : "off"
    };
}

export function registerRespiteSettingsPanel() {
    const MCP = game.ionrift?.library?.ModuleConfigProfiles;
    if (!MCP) return;

    MCP.register({
        moduleId: MODULE_ID,
        moduleLabel: localize("IONRIFT.RESPITE.SETTINGS.PANEL.ModuleLabel"),
        anchorKey: "eventBrowser",
        quickSetup: {
            title: localize("IONRIFT.RESPITE.SETTINGS.PANEL.QuickSetupTitle"),
            subtitle: localize("IONRIFT.RESPITE.SETTINGS.PANEL.QuickSetupSubtitle"),
            profiles: PROFILES.map(p => ({
                ...p,
                label: localize(p.label),
                desc: localize(p.desc)
            })),
            profileKeys: PROFILE_KEYS,
            keyLabels: Object.fromEntries(
                Object.entries(KEY_LABELS).map(([k, v]) => [k, localize(v)])
            ),
            formatCell: formatProfileCell,
            confirmNote: localize("IONRIFT.RESPITE.SETTINGS.PANEL.ConfirmNote"),
            confirmRowGroups: [{
                beforeKey: PLAYER_KEYS[0],
                label: localize("IONRIFT.RESPITE.SETTINGS.PANEL.PlayerRules")
            }],
            guideTooltip: localize("IONRIFT.RESPITE.SETTINGS.PANEL.GuideTooltip"),
            onGuide: () => game.ionrift?.respite?.openPlayerGuide?.()
        },
        groups: GROUPS.map(g => ({ ...g, title: localize(g.title) }))
    });
}
