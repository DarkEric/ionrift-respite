import { MODULE_ID } from "../../../data/moduleId.js";
import { localize } from "../../../utils/I18n.js";
export { MODULE_ID };

/** DnD5e uses "container"; PF2e uses "backpack". */
export const CONTAINER_ITEM_TYPES = new Set(["container", "backpack"]);
export const SPOILED_FOOD_BLOCKED_MESSAGE_KEY = "IONRIFT.RESPITE.SHEET.SpoiledFoodBlocked";
export function getSpoiledFoodBlockedMessage() { return localize(SPOILED_FOOD_BLOCKED_MESSAGE_KEY); }

export const SPOILED_FOOD_TEMPLATE = {
    name: "Spoiled Food",
    type: "consumable",
    img: "icons/commodities/materials/slime-yellow.webp",
    system: {
        description: { value: "Rotten, inedible remains. Might have been something good once." },
        quantity: 1,
        weight: 0.5,
        rarity: "common",
        type: { value: "food" }
    },
    flags: { [MODULE_ID]: { spoiled: true } }
};


export const MEAL_DEFAULTS = {
    waterPerDay: 2,
    foodPerDay: 1,
    dehydrationDC: 15,
    foodGraceDays: null, // null = 3 + CON mod (calculated per character)
    maxWaterPerDay: 4,
    maxFoodPerDay: 3
};
