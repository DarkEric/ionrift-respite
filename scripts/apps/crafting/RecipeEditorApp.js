/**
 * RecipeEditorApp
 * GM-only editor for custom profession recipes (world setting JSON).
 */

import {
    CUSTOM_RECIPE_MAX_PER_PROFESSION,
    applyCustomRecipesToLiveEngines,
    applyProfessionToolToRecipe,
    describeRecipeSaveOverwrite,
    getHomebrewProfessionOptions,
    getProfessionToolRequired,
    HOMEBREW_PROFESSION_DISPLAY,
    sanitizeCustomRecipes,
    TOOL_PROFICIENCY_LABELS,
    validateCustomRecipe
} from "../../services/crafting/recipes/RecipeCatalog.js";
import {
    applyMealBuffPresetToFlags,
    buildSatiatesList,
    commitMealEffectFieldsFromForm,
    defaultFoodTagForProfession,
    defaultSatiatesForProfession,
    formatMealBuffPreview,
    formatMealBuffPresetTitle,
    FOOD_TAG_OPTIONS,
    getMealBuffPreset,
    getMealBuffPresetAttribution,
    getMealBuffPresetsForProfession,
    matchMealBuffPresetId,
    syncResourceTypeFromMealFlags
} from "../../services/meal/buffs/MealBuffPresets.js";
import { MealBuffPickerDialog } from "../meal/MealBuffPickerDialog.js";
import { localize, format } from "../../utils/I18n.js";
import {
    buildRecipeMissingOutputIndex,
    formatSyncError,
    openCustomOutputCompendiumItem,
    resolveRecipeOutputNameOnSave,
    syncRecipeOutputsToCompendium
} from "../../services/crafting/recipes/RecipeOutputCompendium.js";
import { PROVISIONS_CUSTOM_PACK_ID } from "../../services/meal/provisions/ProvisionsCustomPack.js";
import { SKILL_NAME_KEYS } from "../../data/RestConstants.js";
import { MODULE_ID } from "../../data/moduleId.js";

const MEAL_EFFECT_PROFESSIONS = new Set(["cooking", "brewing"]);

/** Skills plus ability checks — i18n keys only; resolve with localize() at render time. */
const RECIPE_CHECK_KEYS = {
    ...SKILL_NAME_KEYS,
    str: "IONRIFT.RESPITE.ABILITY.str",
    dex: "IONRIFT.RESPITE.ABILITY.dex",
    con: "IONRIFT.RESPITE.ABILITY.con",
    int: "IONRIFT.RESPITE.ABILITY.int",
    wis: "IONRIFT.RESPITE.ABILITY.wis",
    cha: "IONRIFT.RESPITE.ABILITY.cha"
};

const PROFESSION_ICONS = Object.fromEntries(
    Object.entries(HOMEBREW_PROFESSION_DISPLAY).map(([id, meta]) => [id, meta.icon])
);

export class RecipeEditorApp extends foundry.applications.api.ApplicationV2 {

    #professionId = "cooking";
    #selectedIndex = 0;
    #draft = null;
    #flashSavedIndex = null;
    /** @type {Set<number>} Ingredient row indices with Alternates open. */
    #ingredientAdvancedOpen = new Set();

    static DEFAULT_OPTIONS = {
        id: "respite-recipe-editor",
        window: {
            title: localize("IONRIFT.RESPITE.APP.CustomRecipesTitle"),
            icon: "fas fa-mortar-pestle",
            resizable: true
        },
        position: { width: 720, height: 680 },
        classes: ["ionrift-window", "glass-ui", "ionrift-respite-app"]
    };

    /** @override */
    async _prepareContext() {
        const homebrewProfessionOptions = await getHomebrewProfessionOptions();
        if (!homebrewProfessionOptions.some(option => option.id === this.#professionId)) {
            this.#professionId = homebrewProfessionOptions[0]?.id ?? "cooking";
        }
        const stored = game.settings.get(MODULE_ID, "customRecipes") ?? {};
        const recipes = stored[this.#professionId] ?? [];
        const selected = this.#selectedIndex >= 0 ? recipes[this.#selectedIndex] ?? null : null;
        const isNewDraft = this.#selectedIndex < 0 || !selected;
        const pack = game.packs.get(PROVISIONS_CUSTOM_PACK_ID);
        const missingOutputIndices = await buildRecipeMissingOutputIndex(pack, recipes);

        return {
            professionId: this.#professionId,
            professionIcon: PROFESSION_ICONS[this.#professionId] ?? "fas fa-hammer",
            professionOptions: homebrewProfessionOptions.map(option => ({
                id: option.id,
                label: option.label,
                packSource: option.packSource,
                selected: option.id === this.#professionId
            })),
            recipes,
            selectedIndex: this.#selectedIndex,
            selected,
            isNewDraft,
            draft: this.#draft ?? selected ?? this._blankRecipe(),
            maxRecipes: CUSTOM_RECIPE_MAX_PER_PROFESSION,
            missingOutputIndices,
            selectedOutputMissing: !isNewDraft && missingOutputIndices.has(this.#selectedIndex)
        };
    }

    /** @override */
    async _renderHTML(context) {
        const el = document.createElement("div");
        el.classList.add("respite-recipe-editor");
        el.innerHTML = this._buildMarkup(context);
        this._wireEvents(el);
        return el;
    }

    /** @override */
    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    _esc(value) {
        return foundry.utils.escapeHTML(String(value ?? ""));
    }

    _stripHtmlForTextarea(html) {
        if (!html) return "";
        return String(html)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>\s*<p>/gi, "\n\n")
            .replace(/<[^>]+>/g, "")
            .trim();
    }

    _wrapDescription(text) {
        const trimmed = String(text ?? "").trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("<")) return trimmed;
        return `<p>${trimmed}</p>`;
    }

    _professionLabel(professionId) {
        const key = HOMEBREW_PROFESSION_DISPLAY[professionId]?.label;
        return key ? localize(key) : professionId;
    }

    _toolLabel(toolKey) {
        if (!toolKey) return null;
        const key = TOOL_PROFICIENCY_LABELS[toolKey];
        return key ? localize(key) : toolKey;
    }

    _outputFolderLabel(professionId) {
        const key = `IONRIFT.RESPITE.RECIPE.OutputFolder.${professionId}`;
        const label = localize(key);
        if (label && label !== key) return label;
        return localize("IONRIFT.RESPITE.RECIPE.OutputFolder.cooking");
    }

    _buildSkillOptions(selectedKey) {
        const keys = Object.keys(RECIPE_CHECK_KEYS).sort((a, b) =>
            localize(RECIPE_CHECK_KEYS[a]).localeCompare(localize(RECIPE_CHECK_KEYS[b]), game.i18n?.lang)
        );
        let html = "";
        if (selectedKey && !RECIPE_CHECK_KEYS[selectedKey]) {
            html += `<option value="${this._esc(selectedKey)}" selected>${this._esc(selectedKey)}</option>`;
        }
        for (const key of keys) {
            const selected = key === selectedKey ? " selected" : "";
            const label = localize(RECIPE_CHECK_KEYS[key]);
            html += `<option value="${this._esc(key)}"${selected}>${this._esc(label)}</option>`;
        }
        return html;
    }

    _isMealProfession(professionId) {
        return MEAL_EFFECT_PROFESSIONS.has(professionId);
    }

    _hasOutputBuffEffects(professionId) {
        if (MEAL_EFFECT_PROFESSIONS.has(professionId)) return true;
        const presets = getMealBuffPresetsForProfession(professionId);
        return presets.handlers.length > 0 || presets.overlay.length > 0;
    }

    _mealFieldPrefix(tier) {
        return tier === "ambitious" ? "ambMeal" : "meal";
    }

    _mealBuffSummaryText(presetId, rf) {
        if (presetId === "custom") {
            const preview = formatMealBuffPreview(rf?.buff);
            if (preview) {
                const parts = [preview.label];
                if (preview.formula) parts.push(preview.formula);
                if (preview.duration) parts.push(preview.duration);
                return parts.join(" · ");
            }
            return rf?.wellFed
                ? localize("IONRIFT.RESPITE.RECIPE.CustomWellFedJson")
                : localize("IONRIFT.RESPITE.RECIPE.NoBuff");
        }
        const preset = getMealBuffPreset(presetId);
        return formatMealBuffPresetTitle(preset);
    }

    _mealBuffAttributionMarkup(presetId) {
        const attribution = getMealBuffPresetAttribution(presetId);
        if (!attribution) return "";
        const title = format("IONRIFT.RESPITE.RECIPE.PresetFrom", { pack: attribution.packLabel });
        return `<span class="recipe-editor-buff-pack-badge" title="${this._esc(title)}">${this._esc(attribution.packLabel)}</span>`;
    }

    _openBuffPicker(el, tier) {
        const prefix = this._mealFieldPrefix(tier);
        const presetId = el.querySelector(`[name="${prefix}BuffPresetId"]`)?.value ?? "none";
        const dialog = new MealBuffPickerDialog({
            professionId: this.#professionId,
            tier,
            selectedPresetId: presetId,
            onSelect: selectedId => {
                const draft = this._readFormDraft(el);
                const flagsKey = tier === "ambitious" ? "ambitiousOutputFlags" : "outputFlags";
                if (!draft[flagsKey]) draft[flagsKey] = foundry.utils.deepClone(this._defaultOutputFlags());
                const rf = draft[flagsKey][MODULE_ID] ?? {};
                draft[flagsKey][MODULE_ID] = rf;
                applyMealBuffPresetToFlags(rf, selectedId);

                const section = el.querySelector(`[data-meal-tier="${tier}"]`);
                this._syncMealTierDom(section, rf, selectedId);
                this.#draft = draft;
            }
        });
        dialog.render(true);
    }

    _syncMealTierDom(section, rf, presetId) {
        if (!section) return;
        const tier = section.dataset.mealTier;
        const prefix = this._mealFieldPrefix(tier);
        const satiates = Array.isArray(rf?.satiates) ? rf.satiates : defaultSatiatesForProfession(this.#professionId);
        const foodTag = rf?.foodTag ?? defaultFoodTagForProfession(this.#professionId);
        const spoilsVal = rf?.spoilsAfter ?? "";

        const partyMeal = section.querySelector(`[name="${prefix}PartyMeal"]`);
        if (partyMeal) partyMeal.checked = rf?.partyMeal === true;

        const satiatesFood = section.querySelector(`[name="${prefix}SatiatesFood"]`);
        if (satiatesFood) satiatesFood.checked = satiates.includes("food");

        const satiatesWater = section.querySelector(`[name="${prefix}SatiatesWater"]`);
        if (satiatesWater) satiatesWater.checked = satiates.includes("water");

        const foodTagSelect = section.querySelector(`[name="${prefix}FoodTag"]`);
        if (foodTagSelect) foodTagSelect.value = foodTag;

        const spoilsInput = section.querySelector(`[name="${prefix}SpoilsAfter"]`);
        if (spoilsInput) spoilsInput.value = spoilsVal === null || spoilsVal === undefined ? "" : String(spoilsVal);

        const hidden = section.querySelector(`[name="${prefix}BuffPresetId"]`);
        if (hidden) hidden.value = presetId;

        const summaryEl = section.querySelector(".recipe-editor-buff-summary-text");
        if (summaryEl) summaryEl.textContent = this._mealBuffSummaryText(presetId, rf);

        const badgeEl = section.querySelector(".recipe-editor-buff-pack-attribution");
        if (badgeEl) {
            badgeEl.innerHTML = this._mealBuffAttributionMarkup(presetId);
        }
    }

    _buildMealEffectsMarkup(tier, rf, professionId) {
        const prefix = this._mealFieldPrefix(tier);
        const presetId = matchMealBuffPresetId(rf);
        const showMealFields = this._isMealProfession(professionId);
        const satiates = Array.isArray(rf?.satiates)
            ? rf.satiates
            : defaultSatiatesForProfession(professionId);
        const foodTag = rf?.foodTag ?? defaultFoodTagForProfession(professionId);
        const spoilsVal = rf?.spoilsAfter ?? "";
        const spoilsAttr = spoilsVal === null || spoilsVal === undefined ? "" : String(spoilsVal);
        const partyMeal = rf?.partyMeal === true;
        const satiatesFood = satiates.includes("food");
        const satiatesWater = satiates.includes("water");
        const summary = this._mealBuffSummaryText(presetId, rf);
        const tierLabel = tier === "ambitious"
            ? (showMealFields
                ? localize("IONRIFT.RESPITE.RECIPE.AmbitiousMealEffects")
                : localize("IONRIFT.RESPITE.RECIPE.AmbitiousOutputEffects"))
            : (showMealFields
                ? localize("IONRIFT.RESPITE.RECIPE.MealEffects")
                : localize("IONRIFT.RESPITE.RECIPE.OutputEffects"));
        const tierHint = tier === "ambitious"
            ? localize("IONRIFT.RESPITE.RECIPE.AmbitiousTierHint")
            : (showMealFields
                ? localize("IONRIFT.RESPITE.RECIPE.MealTierHint")
                : localize("IONRIFT.RESPITE.RECIPE.OutputTierHint"));

        const foodTagOptions = FOOD_TAG_OPTIONS.map(opt => {
            const selected = opt.id === foodTag ? " selected" : "";
            const tagKey = `IONRIFT.RESPITE.RECIPE.FoodTag.${opt.id}`;
            const tagLabel = localize(tagKey);
            const label = tagLabel !== tagKey ? tagLabel : opt.label;
            return `<option value="${this._esc(opt.id)}"${selected}>${this._esc(label)}</option>`;
        }).join("");

        const attributionMarkup = this._mealBuffAttributionMarkup(presetId);
        const mealFieldsMarkup = showMealFields ? `
            <div class="recipe-editor-meal-toggles">
                <label class="recipe-editor-check">
                    <input type="checkbox" name="${prefix}PartyMeal" ${partyMeal ? "checked" : ""} />
                    <span>${this._esc(localize("IONRIFT.RESPITE.RECIPE.PartyMeal"))}</span>
                </label>
                <label class="recipe-editor-check">
                    <input type="checkbox" name="${prefix}SatiatesFood" ${satiatesFood ? "checked" : ""} />
                    <span>${this._esc(localize("IONRIFT.RESPITE.RECIPE.SatiatesFood"))}</span>
                </label>
                <label class="recipe-editor-check">
                    <input type="checkbox" name="${prefix}SatiatesWater" ${satiatesWater ? "checked" : ""} />
                    <span>${this._esc(localize("IONRIFT.RESPITE.RECIPE.SatiatesWater"))}</span>
                </label>
            </div>
            <div class="recipe-editor-fields recipe-editor-fields--double">
                <div class="recipe-editor-field">
                    <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.FoodTag"))}</label>
                    <select class="recipe-editor-select" name="${prefix}FoodTag">${foodTagOptions}</select>
                </div>
                <div class="recipe-editor-field">
                    <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.SpoilsAfter"))}</label>
                    <input type="number" class="recipe-editor-input" name="${prefix}SpoilsAfter"
                        min="1" placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.SpoilsNever"))}" value="${this._esc(spoilsAttr)}" />
                </div>
            </div>` : "";

        return `
        <div class="recipe-editor-section recipe-editor-section--meal" data-meal-tier="${tier}">
            <div class="recipe-editor-section-title">${this._esc(tierLabel)}</div>
            <p class="recipe-editor-hint">${this._esc(tierHint)}</p>
            ${mealFieldsMarkup}
            <div class="recipe-editor-buff-row">
                <div class="recipe-editor-buff-summary">
                    <span class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.Buff"))}</span>
                    <div class="recipe-editor-buff-summary-line">
                        <span class="recipe-editor-buff-summary-text">${this._esc(summary)}</span>
                        <span class="recipe-editor-buff-pack-attribution">${attributionMarkup}</span>
                    </div>
                </div>
                <input type="hidden" name="${prefix}BuffPresetId" value="${this._esc(presetId)}" />
                <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                    data-action="openBuffPicker" data-tier="${tier}">
                    <i class="fas fa-star"></i> ${this._esc(localize("IONRIFT.RESPITE.APP.ChooseBuffTitle"))}
                </button>
            </div>
        </div>`;
    }

    _buildMarkup(context) {
        const draft = context.draft;
        const skillVal = draft.skill ?? "sur";
        const outputName = draft.output?.name ?? "";
        const outputQty = draft.output?.quantity ?? 1;
        const outputImg = draft.output?.img ?? "icons/consumables/food/bowl-stew-brown.webp";
        const outputDesc = draft.output?.description ?? "";
        const outputCompendiumId = draft.output?.compendiumId ?? "";
        const outputFolderLabel = this._outputFolderLabel(context.professionId);
        const hasAmbitious = Boolean(draft.ambitiousOutput);
        const ambName = draft.ambitiousOutput?.name ?? "";
        const ambQty = draft.ambitiousOutput?.quantity ?? 1;
        const ambImg = draft.ambitiousOutput?.img ?? outputImg;
        const ambDesc = draft.ambitiousOutput?.description ?? "";
        const ambCompendiumId = draft.ambitiousOutput?.compendiumId ?? "";
        const profLabel = this._professionLabel(context.professionId);
        const toolLabel = this._toolLabel(getProfessionToolRequired(context.professionId));

        const tRemoveIngredient = localize("IONRIFT.RESPITE.RECIPE.RemoveIngredient");
        const tRemoveAlternate = localize("IONRIFT.RESPITE.RECIPE.RemoveAlternate");
        const tQuantity = localize("IONRIFT.RESPITE.RECIPE.Quantity");
        const tChooseImage = localize("IONRIFT.RESPITE.RECIPE.ChooseImage");
        const tOpenCompendium = localize("IONRIFT.RESPITE.RECIPE.OpenCompendiumItem");
        const tItemDescription = localize("IONRIFT.RESPITE.RECIPE.ItemDescription");

        let recipeListHtml = "";
        if (context.recipes.length) {
            for (let i = 0; i < context.recipes.length; i++) {
                const r = context.recipes[i];
                const active = i === context.selectedIndex && !context.isNewDraft ? " active" : "";
                const flash = i === this.#flashSavedIndex ? " recipe-editor-list-item--saved-flash" : "";
                const listOutputImg = r.output?.img
                    ?? "icons/consumables/food/bowl-stew-brown.webp";
                const missingOutput = context.missingOutputIndices?.has(i);
                const missingBadge = missingOutput
                    ? `<span class="recipe-editor-list-warn" title="${this._esc(localize("IONRIFT.RESPITE.RECIPE.OutputMissingTitle"))}"><i class="fas fa-unlink" aria-hidden="true"></i></span>`
                    : "";
                recipeListHtml += `
                <button type="button" class="recipe-editor-list-item${active}${flash}"
                    data-action="selectRecipe" data-index="${i}">
                    <img class="recipe-editor-list-icon" src="${this._esc(listOutputImg)}" alt="" />
                    <span class="recipe-editor-list-name">${this._esc(r.name)}</span>
                    ${missingBadge}
                    <span class="recipe-editor-list-meta">${this._esc(format("IONRIFT.RESPITE.RECIPE.DcMeta", { dc: r.dc }))}</span>
                </button>`;
            }
        } else {
            recipeListHtml = `
                <p class="recipe-editor-empty">
                    <i class="fas fa-mortar-pestle"></i>
                    ${this._esc(localize("IONRIFT.RESPITE.RECIPE.EmptyList"))}
                </p>`;
        }

        let ingredientsHtml = "";
        const ingredients = (draft.ingredients?.length ? draft.ingredients : [{ name: "", quantity: 1 }]);
        const canRemoveIngredient = ingredients.length > 1;
        for (let i = 0; i < ingredients.length; i++) {
            const ing = ingredients[i];
            const alts = Array.isArray(ing.alternates)
                ? ing.alternates.map(a => String(a ?? "").trim()).filter(Boolean)
                : [];
            const advancedOpen = this.#ingredientAdvancedOpen.has(i) || alts.length > 0;
            if (advancedOpen) this.#ingredientAdvancedOpen.add(i);
            const removeBtn = canRemoveIngredient ? `
                <button type="button" class="recipe-editor-ingredient-remove" data-action="removeIngredient"
                    data-ing-index="${i}" title="${this._esc(tRemoveIngredient)}" aria-label="${this._esc(tRemoveIngredient)}">
                    <i class="fas fa-times"></i>
                </button>` : "";
            let altRowsHtml = "";
            const altList = alts.length ? alts : (advancedOpen ? [""] : []);
            for (let altIdx = 0; altIdx < altList.length; altIdx++) {
                altRowsHtml += `
                <div class="recipe-editor-ingredient-alt-row">
                    <input type="text" class="recipe-editor-input" name="ingAlt"
                        value="${this._esc(altList[altIdx])}" placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.PlaceholderAlternate"))}" />
                    <button type="button" class="recipe-editor-ingredient-remove" data-action="removeAlternate"
                        data-ing-index="${i}" data-alt-index="${altIdx}"
                        title="${this._esc(tRemoveAlternate)}" aria-label="${this._esc(tRemoveAlternate)}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`;
            }
            ingredientsHtml += `
            <div class="recipe-editor-ingredient-block" data-ing-index="${i}">
                <div class="recipe-editor-ingredient-row">
                    <input type="text" class="recipe-editor-input" name="ingName"
                        value="${this._esc(ing.name)}" placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.PlaceholderIngredient"))}" />
                    <input type="number" class="recipe-editor-input recipe-editor-input--qty" name="ingQty"
                        min="1" value="${ing.quantity ?? 1}" aria-label="${this._esc(tQuantity)}" />
                    ${removeBtn}
                </div>
                <details class="recipe-editor-ingredient-advanced" data-ing-index="${i}"${advancedOpen ? " open" : ""}>
                    <summary class="recipe-editor-ingredient-advanced-toggle">
                        <i class="fas fa-exchange-alt" aria-hidden="true"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.Alternates"))}
                        ${alts.length ? `<span class="recipe-editor-ingredient-alt-count">${alts.length}</span>` : ""}
                    </summary>
                    <div class="recipe-editor-ingredient-advanced-body">
                        <p class="recipe-editor-hint">${this._esc(localize("IONRIFT.RESPITE.RECIPE.AlternatesHint"))}</p>
                        <div class="recipe-editor-ingredient-alts">${altRowsHtml}</div>
                        <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                            data-action="addAlternate" data-ing-index="${i}">
                            <i class="fas fa-plus"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.AddAlternate"))}
                        </button>
                    </div>
                </details>
            </div>`;
        }

        const professionOptions = context.professionOptions.map(o => {
            const selected = o.selected ? " selected" : "";
            return `<option value="${this._esc(o.id)}"${selected}>${this._esc(o.label)}</option>`;
        }).join("");

        const deleteDisabled = context.selected && !context.isNewDraft ? "" : " disabled";
        const newRecipeActive = context.isNewDraft ? " active" : "";
        const showOutputBuffEffects = this._hasOutputBuffEffects(context.professionId);
        const stdRf = draft.outputFlags?.[MODULE_ID] ?? {};
        const ambRf = draft.ambitiousOutputFlags?.[MODULE_ID]
            ?? foundry.utils.deepClone(stdRf);

        const cookingNote = context.professionId === "cooking"
            ? ` ${localize("IONRIFT.RESPITE.RECIPE.LeadCookingNote")}`
            : "";

        return `
        <p class="recipe-editor-lead">
            ${format("IONRIFT.RESPITE.RECIPE.Lead", { folder: this._esc(outputFolderLabel) })}${cookingNote}
        </p>
        <div class="recipe-editor-filter">
            <label class="recipe-editor-filter-label">
                <i class="${context.professionIcon}"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.Profession"))}
            </label>
            <select class="recipe-editor-select" data-action="changeProfession">${professionOptions}</select>
            <span class="recipe-editor-count">${context.recipes.length}/${context.maxRecipes}</span>
        </div>
        <div class="recipe-editor-layout">
            <aside class="recipe-editor-list" aria-label="${this._esc(localize("IONRIFT.RESPITE.RECIPE.ListAria"))}">
                <div class="recipe-editor-list-heading">${this._esc(format("IONRIFT.RESPITE.RECIPE.ProfessionRecipes", { profession: profLabel }))}</div>
                ${recipeListHtml}
                <button type="button" class="recipe-editor-list-new${newRecipeActive}" data-action="newRecipe">
                    <i class="fas fa-plus"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.NewRecipe"))}
                </button>
            </aside>
            <section class="recipe-editor-detail">
                ${context.isNewDraft ? `
                <p class="recipe-editor-draft-note">
                    <i class="fas fa-pen" aria-hidden="true"></i>
                    ${this._esc(localize("IONRIFT.RESPITE.RECIPE.DraftNote"))}
                </p>` : ""}
                <div class="recipe-editor-section">
                    <div class="recipe-editor-section-title">${this._esc(localize("IONRIFT.RESPITE.RECIPE.Recipe"))}</div>
                    <div class="recipe-editor-fields recipe-editor-fields--triple">
                        <div class="recipe-editor-field">
                            <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.Name"))}</label>
                            <input type="text" class="recipe-editor-input" name="name"
                                value="${this._esc(draft.name)}" placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.NamePlaceholder"))}" />
                        </div>
                        <div class="recipe-editor-field">
                            <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.UI.DC"))}</label>
                            <input type="number" class="recipe-editor-input" name="dc"
                                min="1" value="${draft.dc ?? 12}" />
                        </div>
                        <div class="recipe-editor-field">
                            <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.Skill"))}</label>
                            <select class="recipe-editor-select" name="skill"
                                aria-label="${this._esc(localize("IONRIFT.RESPITE.RECIPE.SkillCheckAria"))}">${this._buildSkillOptions(skillVal)}</select>
                        </div>
                    </div>
                    ${toolLabel ? `
                    <div class="recipe-editor-fields recipe-editor-fields--double">
                        <div class="recipe-editor-field">
                            <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.ToolProficiency"))}</label>
                            <div class="recipe-editor-locked-value" title="${this._esc(localize("IONRIFT.RESPITE.RECIPE.ToolSetByProfession"))}">
                                <i class="fas fa-lock" aria-hidden="true"></i>
                                <span>${this._esc(toolLabel)}</span>
                            </div>
                        </div>
                    </div>` : ""}
                </div>
                <div class="recipe-editor-section">
                    <div class="recipe-editor-section-title">${this._esc(localize("IONRIFT.RESPITE.RECIPE.Ingredients"))}</div>
                    <p class="recipe-editor-hint">${this._esc(localize("IONRIFT.RESPITE.RECIPE.IngredientHint"))}</p>
                    <div class="recipe-editor-ingredients">${ingredientsHtml}</div>
                    <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost" data-action="addIngredient">
                        <i class="fas fa-plus"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.AddIngredient"))}
                    </button>
                </div>
                ${context.selectedOutputMissing ? `
                <p class="recipe-editor-sync-warn">
                    <i class="fas fa-unlink" aria-hidden="true"></i>
                    ${this._esc(format("IONRIFT.RESPITE.RECIPE.CompendiumOutputMissing", { folder: outputFolderLabel }))}
                </p>` : ""}
                <div class="recipe-editor-section">
                    <div class="recipe-editor-section-title">${this._esc(localize("IONRIFT.RESPITE.RECIPE.StandardOutput"))}</div>
                    <p class="recipe-editor-hint">${this._esc(format("IONRIFT.RESPITE.RECIPE.StandardOutputHint", { folder: outputFolderLabel }))}</p>
                    <div class="recipe-editor-img-row">
                        <img class="recipe-editor-img-preview" src="${this._esc(outputImg)}" alt="" />
                        <input type="hidden" name="outputImg" value="${this._esc(outputImg)}" />
                        <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                            data-action="pickOutputImg">
                            <i class="fas fa-image"></i> ${this._esc(tChooseImage)}
                        </button>
                        ${outputCompendiumId ? `
                        <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                            data-action="openStdOutput" data-compendium-id="${this._esc(outputCompendiumId)}">
                            <i class="fas fa-book"></i> ${this._esc(tOpenCompendium)}
                        </button>` : ""}
                    </div>
                    <div class="recipe-editor-fields recipe-editor-fields--double">
                        <div class="recipe-editor-field">
                            <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.ItemName"))}</label>
                            <input type="text" class="recipe-editor-input" name="outputName"
                                value="${this._esc(outputName)}" placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.OutputNamePlaceholder"))}" />
                        </div>
                        <div class="recipe-editor-field">
                            <label class="recipe-editor-label">${this._esc(tQuantity)}</label>
                            <input type="number" class="recipe-editor-input" name="outputQty"
                                min="1" value="${outputQty}" />
                        </div>
                    </div>
                    <div class="recipe-editor-field recipe-editor-field--full">
                        <label class="recipe-editor-label">${this._esc(tItemDescription)}</label>
                        <textarea class="recipe-editor-textarea" name="outputDesc" rows="2"
                            placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.ItemDescriptionPlaceholder"))}">${this._esc(this._stripHtmlForTextarea(outputDesc))}</textarea>
                    </div>
                    ${showOutputBuffEffects ? this._buildMealEffectsMarkup("standard", stdRf, context.professionId) : ""}
                </div>
                <div class="recipe-editor-section">
                    <label class="recipe-editor-ambitious-toggle">
                        <input type="checkbox" name="enableAmbitious" ${hasAmbitious ? "checked" : ""} />
                        <span class="recipe-editor-ambitious-copy">
                            <span class="recipe-editor-ambitious-title">${this._esc(localize("IONRIFT.RESPITE.RECIPE.AmbitiousOutput"))}</span>
                            <span class="recipe-editor-hint">${this._esc(localize("IONRIFT.RESPITE.RECIPE.AmbitiousHint"))}</span>
                        </span>
                    </label>
                    <div class="recipe-editor-ambitious-fields${hasAmbitious ? "" : " is-hidden"}">
                        <div class="recipe-editor-img-row">
                            <img class="recipe-editor-img-preview recipe-editor-img-preview--amb" src="${this._esc(ambImg)}" alt="" />
                            <input type="hidden" name="ambOutputImg" value="${this._esc(ambImg)}" />
                            <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                                data-action="pickAmbOutputImg">
                                <i class="fas fa-image"></i> ${this._esc(tChooseImage)}
                            </button>
                            ${ambCompendiumId ? `
                            <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                                data-action="openAmbOutput" data-compendium-id="${this._esc(ambCompendiumId)}">
                                <i class="fas fa-book"></i> ${this._esc(tOpenCompendium)}
                            </button>` : ""}
                        </div>
                        <div class="recipe-editor-fields recipe-editor-fields--double">
                            <div class="recipe-editor-field">
                                <label class="recipe-editor-label">${this._esc(localize("IONRIFT.RESPITE.RECIPE.UpgradedItemName"))}</label>
                                <input type="text" class="recipe-editor-input" name="ambOutputName"
                                    value="${this._esc(ambName)}" placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.UpgradedNamePlaceholder"))}" />
                            </div>
                            <div class="recipe-editor-field">
                                <label class="recipe-editor-label">${this._esc(tQuantity)}</label>
                                <input type="number" class="recipe-editor-input" name="ambOutputQty"
                                    min="1" value="${ambQty}" />
                            </div>
                        </div>
                        <div class="recipe-editor-field recipe-editor-field--full">
                            <label class="recipe-editor-label">${this._esc(tItemDescription)}</label>
                            <textarea class="recipe-editor-textarea" name="ambOutputDesc" rows="2"
                                placeholder="${this._esc(localize("IONRIFT.RESPITE.RECIPE.ItemDescriptionPlaceholderAmb"))}">${this._esc(this._stripHtmlForTextarea(ambDesc))}</textarea>
                        </div>
                        ${showOutputBuffEffects ? this._buildMealEffectsMarkup("ambitious", ambRf, context.professionId) : ""}
                    </div>
                </div>
            </section>
        </div>
        <footer class="recipe-editor-footer">
            <div class="recipe-editor-footer-left">
                <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                    data-action="exportJson"><i class="fas fa-download"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.Export"))}</button>
                <button type="button" class="recipe-editor-btn recipe-editor-btn--ghost"
                    data-action="importJson"><i class="fas fa-upload"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.Import"))}</button>
                <button type="button" class="recipe-editor-btn recipe-editor-btn--danger"
                    data-action="deleteRecipe"${deleteDisabled}>
                    <i class="fas fa-trash"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.Delete"))}
                </button>
            </div>
            <button type="button" class="recipe-editor-btn recipe-editor-btn--primary" data-action="saveRecipe">
                <i class="fas fa-save"></i> ${this._esc(localize("IONRIFT.RESPITE.RECIPE.SaveRecipe"))}
            </button>
        </footer>`;
    }

    static _recipeEditorHookRegistered = false;

    _wireEvents(el) {
        if (!RecipeEditorApp._recipeEditorHookRegistered) {
            RecipeEditorApp._recipeEditorHookRegistered = true;
            const refreshOpenEditors = () => {
                for (const app of Object.values(ui.windows ?? {})) {
                    if (app instanceof RecipeEditorApp && app.rendered) app.render(false);
                }
            };
            Hooks.on("ionrift.mealBuffPresetsChanged", refreshOpenEditors);
            Hooks.on("ionrift.overlayContentChanged", async payload => {
                if (payload?.moduleId !== MODULE_ID) return;
                const { OverlayProfessionLoader } = await import("../../services/packs/overlays/OverlayProfessionLoader.js");
                OverlayProfessionLoader.invalidate();
                refreshOpenEditors();
            });
        }

        el.querySelector("[data-action=\"changeProfession\"]")?.addEventListener("change", ev => {
            this.#professionId = ev.target.value;
            this.#selectedIndex = 0;
            this.#draft = null;
            this.#ingredientAdvancedOpen = new Set();
            this.render();
        });

        el.querySelectorAll("[data-action=\"selectRecipe\"]").forEach(btn => {
            btn.addEventListener("click", () => {
                this.#selectedIndex = Number(btn.dataset.index);
                this.#draft = null;
                this.#ingredientAdvancedOpen = new Set();
                this.render();
            });
        });

        el.querySelector("[data-action=\"newRecipe\"]")?.addEventListener("click", () => {
            this.#draft = this._blankRecipe();
            this.#selectedIndex = -1;
            this.#ingredientAdvancedOpen = new Set();
            this.render();
        });

        const recipeNameInput = el.querySelector("[name=\"name\"]");
        const outputNameInput = el.querySelector("[name=\"outputName\"]");
        recipeNameInput?.addEventListener("input", () => {
            if (!outputNameInput) return;
            const baseline = this.#draft
                ?? game.settings.get(MODULE_ID, "customRecipes")?.[this.#professionId]?.[this.#selectedIndex]
                ?? null;
            const nextOutput = resolveRecipeOutputNameOnSave(
                baseline?.name,
                baseline?.output?.name,
                recipeNameInput.value,
                outputNameInput.value
            );
            if (nextOutput !== outputNameInput.value) {
                outputNameInput.value = nextOutput;
            }
        });

        el.querySelector("[data-action=\"addIngredient\"]")?.addEventListener("click", () => {
            const draft = this._readFormDraft(el);
            draft.ingredients.push({ name: "", quantity: 1 });
            this.#draft = draft;
            this.render();
        });

        el.querySelectorAll("[data-action=\"removeIngredient\"]").forEach(btn => {
            btn.addEventListener("click", () => {
                const draft = this._readFormDraft(el);
                if (draft.ingredients.length <= 1) return;
                const idx = Number(btn.dataset.ingIndex);
                if (idx >= 0 && idx < draft.ingredients.length) {
                    draft.ingredients.splice(idx, 1);
                }
                this.#ingredientAdvancedOpen = new Set(
                    [...this.#ingredientAdvancedOpen]
                        .filter(i => i !== idx)
                        .map(i => (i > idx ? i - 1 : i))
                );
                this.#draft = draft;
                this.render();
            });
        });

        el.querySelectorAll(".recipe-editor-ingredient-advanced").forEach(details => {
            details.addEventListener("toggle", () => {
                const idx = Number(details.dataset.ingIndex);
                if (Number.isNaN(idx)) return;
                if (details.open) this.#ingredientAdvancedOpen.add(idx);
                else this.#ingredientAdvancedOpen.delete(idx);
            });
        });

        el.querySelectorAll("[data-action=\"addAlternate\"]").forEach(btn => {
            btn.addEventListener("click", () => {
                const draft = this._readFormDraft(el);
                const idx = Number(btn.dataset.ingIndex);
                const ing = draft.ingredients[idx];
                if (!ing) return;
                if (!Array.isArray(ing.alternates)) ing.alternates = [];
                ing.alternates.push("");
                this.#ingredientAdvancedOpen.add(idx);
                this.#draft = draft;
                this.render();
            });
        });

        el.querySelectorAll("[data-action=\"removeAlternate\"]").forEach(btn => {
            btn.addEventListener("click", () => {
                const draft = this._readFormDraft(el);
                const idx = Number(btn.dataset.ingIndex);
                const altIdx = Number(btn.dataset.altIndex);
                const ing = draft.ingredients[idx];
                if (!ing || !Array.isArray(ing.alternates)) return;
                if (altIdx >= 0 && altIdx < ing.alternates.length) {
                    ing.alternates.splice(altIdx, 1);
                }
                if (!ing.alternates.length) delete ing.alternates;
                this.#ingredientAdvancedOpen.add(idx);
                this.#draft = draft;
                this.render();
            });
        });

        el.querySelectorAll("[data-action=\"openBuffPicker\"]").forEach(btn => {
            btn.addEventListener("click", () => {
                this._openBuffPicker(el, btn.dataset.tier);
            });
        });

        el.querySelector("[name=\"enableAmbitious\"]")?.addEventListener("change", ev => {
            const fields = el.querySelector(".recipe-editor-ambitious-fields");
            if (fields) fields.classList.toggle("is-hidden", !ev.target.checked);
        });

        el.querySelector("[data-action=\"pickOutputImg\"]")?.addEventListener("click", () => {
            this._pickImage(el, "outputImg", ".recipe-editor-img-preview:not(.recipe-editor-img-preview--amb)");
        });

        el.querySelector("[data-action=\"pickAmbOutputImg\"]")?.addEventListener("click", () => {
            this._pickImage(el, "ambOutputImg", ".recipe-editor-img-preview--amb");
        });

        el.querySelector("[data-action=\"openStdOutput\"]")?.addEventListener("click", ev => {
            const id = ev.currentTarget?.dataset?.compendiumId;
            if (id) openCustomOutputCompendiumItem(id);
        });

        el.querySelector("[data-action=\"openAmbOutput\"]")?.addEventListener("click", ev => {
            const id = ev.currentTarget?.dataset?.compendiumId;
            if (id) openCustomOutputCompendiumItem(id);
        });

        el.querySelector("[data-action=\"saveRecipe\"]")?.addEventListener("click", () => this._saveRecipe(el));
        el.querySelector("[data-action=\"deleteRecipe\"]")?.addEventListener("click", () => this._deleteRecipe());
        el.querySelector("[data-action=\"exportJson\"]")?.addEventListener("click", () => this._exportJson());
        el.querySelector("[data-action=\"importJson\"]")?.addEventListener("click", () => this._importJson());
    }

    _blankRecipe() {
        const recipeName = localize("IONRIFT.RESPITE.RECIPE.NewRecipeDefaultName");
        const isTailoring = this.#professionId === "tailoring";
        const isBrewing = this.#professionId === "brewing";
        const isLeather = this.#professionId === "leatherworking";
        const defaultImg = isTailoring
            ? "icons/equipment/back/cloak-hooded-blue.webp"
            : isBrewing
                ? "icons/consumables/drinks/tea-jasmine-green.webp"
                : isLeather
                    ? "icons/equipment/shield/buckler-wooden-boss-brown.webp"
                    : "icons/consumables/food/bowl-stew-brown.webp";
        const systemSubtype = isBrewing
            ? "potion"
            : (isTailoring || isLeather ? "trinket" : "food");
        const defaultSkill = isTailoring ? "dex" : (isBrewing ? "wis" : "sur");
        return applyProfessionToolToRecipe({
            name: recipeName,
            dc: 12,
            skill: defaultSkill,
            ingredients: [{ name: "", quantity: 1 }],
            output: {
                name: recipeName,
                type: "consumable",
                quantity: 1,
                img: defaultImg,
                description: `<p>${localize("IONRIFT.RESPITE.RECIPE.CustomCraftedDescription")}</p>`,
                rarity: "common",
                system: { type: { value: systemSubtype, subtype: "" } }
            },
            outputFlags: this._defaultOutputFlags()
        }, this.#professionId);
    }

    _defaultOutputFlags() {
        const rf = {
            foodTag: defaultFoodTagForProfession(this.#professionId),
            spoilsAfter: 3,
            partyMeal: false,
            wellFed: false,
            satiates: defaultSatiatesForProfession(this.#professionId)
        };
        syncResourceTypeFromMealFlags(rf);
        return { [MODULE_ID]: rf };
    }

    _applyMealFlagsFromForm(root, draft, tier) {
        const prefix = this._mealFieldPrefix(tier);
        const flagsKey = tier === "ambitious" ? "ambitiousOutputFlags" : "outputFlags";
        if (!draft[flagsKey]) draft[flagsKey] = foundry.utils.deepClone(this._defaultOutputFlags());
        const rf = draft[flagsKey][MODULE_ID] ?? {};
        draft[flagsKey][MODULE_ID] = rf;

        if (this._isMealProfession(this.#professionId)) {
            const satFood = root.querySelector(`[name="${prefix}SatiatesFood"]`)?.checked ?? false;
            const satWater = root.querySelector(`[name="${prefix}SatiatesWater"]`)?.checked ?? false;
            let satiates = buildSatiatesList(satFood, satWater);
            if (!satiates.length) {
                satiates = defaultSatiatesForProfession(this.#professionId);
            }
            const spoilsRaw = root.querySelector(`[name="${prefix}SpoilsAfter"]`)?.value?.trim() ?? "";
            commitMealEffectFieldsFromForm(rf, {
                presetId: root.querySelector(`[name="${prefix}BuffPresetId"]`)?.value ?? "none",
                partyMeal: root.querySelector(`[name="${prefix}PartyMeal"]`)?.checked ?? false,
                satiates,
                foodTag: root.querySelector(`[name="${prefix}FoodTag"]`)?.value
                    ?? defaultFoodTagForProfession(this.#professionId),
                spoilsAfter: spoilsRaw ? (Number(spoilsRaw) || null) : null
            });
        } else {
            delete rf.partyMeal;
            delete rf.satiates;
            delete rf.foodTag;
            delete rf.spoilsAfter;
            delete rf.resourceType;
            const presetId = root.querySelector(`[name="${prefix}BuffPresetId"]`)?.value ?? "none";
            if (presetId !== "custom") {
                applyMealBuffPresetToFlags(rf, presetId);
            }
        }
    }

    _pickImage(root, hiddenName, previewSelector) {
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
        const hidden = root.querySelector(`[name="${hiddenName}"]`);
        const preview = root.querySelector(previewSelector);
        const fp = new FP({
            type: "image",
            current: hidden?.value ?? "",
            callback: path => {
                if (hidden) hidden.value = path;
                if (preview) preview.src = path;
            }
        });
        fp.browse();
    }

    _readFormDraft(root) {
        const baseline = this.#draft
            ?? game.settings.get(MODULE_ID, "customRecipes")?.[this.#professionId]?.[this.#selectedIndex]
            ?? null;
        const draft = foundry.utils.deepClone(
            baseline ?? this._blankRecipe()
        );

        draft.name = root.querySelector("[name=\"name\"]")?.value?.trim() ?? draft.name;
        draft.dc = Number(root.querySelector("[name=\"dc\"]")?.value) || 12;
        draft.skill = root.querySelector("[name=\"skill\"]")?.value?.trim() || "sur";
        applyProfessionToolToRecipe(draft, this.#professionId);
        draft.outputFlags = draft.outputFlags ?? this._defaultOutputFlags();
        draft.output = draft.output ?? {};
        const formOutputName = root.querySelector("[name=\"outputName\"]")?.value?.trim() ?? draft.output.name;
        draft.output.name = resolveRecipeOutputNameOnSave(
            baseline?.name,
            baseline?.output?.name,
            draft.name,
            formOutputName
        );
        draft.output.quantity = Number(root.querySelector("[name=\"outputQty\"]")?.value) || 1;
        draft.output.img = root.querySelector("[name=\"outputImg\"]")?.value?.trim()
            ?? draft.output.img ?? "icons/consumables/food/bowl-stew-brown.webp";
        const outputDescRaw = root.querySelector("[name=\"outputDesc\"]")?.value?.trim() ?? "";
        draft.output.description = this._wrapDescription(outputDescRaw)
            || draft.output.description
            || `<p>${draft.output.name}</p>`;
        draft.output.type = draft.output.type ?? "consumable";
        draft.output.rarity = draft.output.rarity ?? "common";
        draft.output.system = draft.output.system ?? {
            type: {
                value: this.#professionId === "brewing"
                    ? "potion"
                    : (["tailoring", "leatherworking", "smithing"].includes(this.#professionId) ? "trinket" : "food"),
                subtype: ""
            }
        };

        if (this._hasOutputBuffEffects(this.#professionId)) {
            this._applyMealFlagsFromForm(root, draft, "standard");
        }

        const enableAmbitious = root.querySelector("[name=\"enableAmbitious\"]")?.checked;
        if (enableAmbitious) {
            const ambName = root.querySelector("[name=\"ambOutputName\"]")?.value?.trim()
                || format("IONRIFT.RESPITE.RECIPE.FineName", { name: draft.output.name });
            const ambQty = Number(root.querySelector("[name=\"ambOutputQty\"]")?.value) || 1;
            const ambImg = root.querySelector("[name=\"ambOutputImg\"]")?.value?.trim() || draft.output.img;
            const ambDescRaw = root.querySelector("[name=\"ambOutputDesc\"]")?.value?.trim() ?? "";
            const ambDescription = this._wrapDescription(ambDescRaw) || `<p>${ambName}</p>`;
            draft.ambitiousOutput = {
                name: ambName,
                type: "consumable",
                quantity: ambQty,
                img: ambImg,
                description: ambDescription,
                rarity: "uncommon",
                system: foundry.utils.deepClone(draft.output.system),
                compendiumId: draft.ambitiousOutput?.compendiumId
            };
            draft.ambitiousOutputFlags = foundry.utils.deepClone(
                draft.ambitiousOutputFlags ?? draft.outputFlags ?? this._defaultOutputFlags()
            );
            if (this._hasOutputBuffEffects(this.#professionId)) {
                this._applyMealFlagsFromForm(root, draft, "ambitious");
            }
        } else {
            delete draft.ambitiousOutput;
            delete draft.ambitiousOutputFlags;
        }

        draft.ingredients = [];
        for (const block of root.querySelectorAll(".recipe-editor-ingredient-block")) {
            const name = block.querySelector("[name=\"ingName\"]")?.value?.trim();
            const qty = Number(block.querySelector("[name=\"ingQty\"]")?.value) || 1;
            if (!name) continue;
            const alternates = [...block.querySelectorAll("[name=\"ingAlt\"]")]
                .map(input => input.value?.trim())
                .filter(Boolean);
            const entry = { name, quantity: qty };
            if (alternates.length) entry.alternates = alternates;
            draft.ingredients.push(entry);
        }
        if (!draft.ingredients.length) draft.ingredients = [{ name: localize("IONRIFT.RESPITE.RECIPE.RationsDefault"), quantity: 1 }];

        return draft;
    }

    async _confirmRecipeOverwrite(messages) {
        const body = messages.map(line => `<p>${this._esc(line)}</p>`).join("");
        const confirmFn = game.ionrift?.library?.confirm ?? Dialog.confirm.bind(Dialog);
        return await confirmFn({
            title: localize("IONRIFT.RESPITE.APP.ReplaceRecipeTitle"),
            content: body,
            yesLabel: localize("IONRIFT.RESPITE.RECIPE.Replace"),
            noLabel: localize("IONRIFT.RESPITE.UI.Cancel"),
            yesIcon: "fas fa-save",
            noIcon: "fas fa-times",
            defaultYes: false
        });
    }

    _flashSavedListItem(index) {
        requestAnimationFrame(() => {
            const item = this.element?.querySelector(
                `[data-action="selectRecipe"][data-index="${index}"]`
            );
            if (!item) return;
            item.classList.add("recipe-editor-list-item--saved-flash");
            setTimeout(() => item.classList.remove("recipe-editor-list-item--saved-flash"), 1400);
        });
    }

    async _saveRecipe(root) {
        let draft = this._readFormDraft(root);
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, "customRecipes") ?? {});
        const list = Array.isArray(stored[this.#professionId]) ? stored[this.#professionId] : [];
        const isUpdate = this.#selectedIndex >= 0 && this.#selectedIndex < list.length;

        this._ensureRecipeId(draft, list, isUpdate);

        const { valid, errors } = validateCustomRecipe(draft, this.#professionId);
        if (!valid) {
            ui.notifications.error(errors.join(" "));
            return;
        }

        const overwriteMessages = describeRecipeSaveOverwrite(
            this.#professionId,
            draft,
            list,
            { isUpdate, selectedIndex: this.#selectedIndex }
        );
        if (overwriteMessages.length) {
            const confirmed = await this._confirmRecipeOverwrite(overwriteMessages);
            if (!confirmed) return;
        }

        try {
            draft = await syncRecipeOutputsToCompendium(this.#professionId, draft);
        } catch (err) {
            const detail = formatSyncError(err);
            console.error(`${MODULE_ID} | RecipeEditorApp sync outputs`, detail, err);
            ui.notifications.error(format("IONRIFT.RESPITE.NOTIFY.CompendiumWriteFailed", { detail }));
            return;
        }

        let savedIndex;
        if (isUpdate) {
            list[this.#selectedIndex] = draft;
            savedIndex = this.#selectedIndex;
        } else {
            if (list.length >= CUSTOM_RECIPE_MAX_PER_PROFESSION) {
                ui.notifications.warn(format("IONRIFT.RESPITE.NOTIFY.MaxCustomRecipes", { max: CUSTOM_RECIPE_MAX_PER_PROFESSION }));
                return;
            }
            list.push(draft);
            savedIndex = list.length - 1;
        }

        stored[this.#professionId] = list;
        await game.settings.set(MODULE_ID, "customRecipes", sanitizeCustomRecipes(stored));
        applyCustomRecipesToLiveEngines({ render: true });

        this.#flashSavedIndex = savedIndex;
        this.#selectedIndex = savedIndex;
        this.#draft = null;
        ui.notifications.info(format("IONRIFT.RESPITE.NOTIFY.RecipeSaved", { name: draft.name, output: draft.output?.name ?? draft.name }));
        await this.render();
        this.#flashSavedIndex = null;
        this._flashSavedListItem(savedIndex);
    }

    /**
     * Assign a stable internal id. Hidden from the UI; preserved on edit, generated on create.
     * JSON import/export remains the path to set ids that override pack recipes.
     * @param {Object} draft
     * @param {Object[]} list
     * @param {boolean} isUpdate
     */
    _ensureRecipeId(draft, list, isUpdate) {
        if (isUpdate && draft.id) return;

        const taken = new Set(list.map(r => r.id).filter(Boolean));
        if (draft.id && !taken.has(draft.id)) return;

        let candidate = `custom_${this.#professionId}_${Date.now()}`;
        while (taken.has(candidate)) {
            candidate = `custom_${this.#professionId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }
        draft.id = candidate;
    }

    async _deleteRecipe() {
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, "customRecipes") ?? {});
        const list = stored[this.#professionId] ?? [];
        if (this.#selectedIndex < 0 || this.#selectedIndex >= list.length) return;
        const removed = list[this.#selectedIndex];
        const outputName = removed?.output?.name;
        const folderLabel = this._outputFolderLabel(this.#professionId);
        list.splice(this.#selectedIndex, 1);
        stored[this.#professionId] = list;
        await game.settings.set(MODULE_ID, "customRecipes", sanitizeCustomRecipes(stored));
        applyCustomRecipesToLiveEngines({ render: true });
        this.#selectedIndex = Math.max(0, this.#selectedIndex - 1);
        this.#draft = null;
        const compendiumNote = outputName
            ? format("IONRIFT.RESPITE.RECIPE.RemovedCompendiumNote", { name: outputName, folder: folderLabel })
            : "";
        ui.notifications.info(format("IONRIFT.RESPITE.NOTIFY.RecipeRemoved", { note: compendiumNote }));
        this.render();
    }

    _exportJson() {
        const data = game.settings.get(MODULE_ID, "customRecipes") ?? {};
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ionrift-custom-recipes.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    async _importJson() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                await game.settings.set(MODULE_ID, "customRecipes", sanitizeCustomRecipes(parsed));
                applyCustomRecipesToLiveEngines({ render: true });
                ui.notifications.info(localize("IONRIFT.RESPITE.NOTIFY.CustomRecipesImported"));
                this.#selectedIndex = 0;
                this.#draft = null;
                this.render();
            } catch (err) {
                console.error(err);
                ui.notifications.error(localize("IONRIFT.RESPITE.NOTIFY.CouldNotParseRecipeJson"));
            }
        });
        input.click();
    }
}
