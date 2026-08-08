/**
 * PlayerRestrictionsApp
 * GM-only submenu for player restriction settings.
 * Opens from the Foundry module settings panel via registerMenu.
 *
 * All settings are boolean toggles. Uses Ionrift Glass theme (ionrift-window).
 */

/** Player restriction definitions. Order = display order. Keys are i18n paths. */
import { MODULE_ID } from "../../data/moduleId.js";
import { localize } from "../../utils/I18n.js";

const LIB_ID = "ionrift-library";

const RESTRICTION_TOGGLES = [
    {
        key: "interceptRests",
        labelKey: "IONRIFT.RESPITE.SETTINGS.interceptRestsName",
        icon: "fas fa-hand-paper",
        hintKey: "IONRIFT.RESPITE.PLAYER_RESTRICTIONS.InterceptHint"
    },
    {
        key: "lockPlayerQuantity",
        labelKey: "IONRIFT.RESPITE.SETTINGS.lockPlayerQuantityName",
        icon: "fas fa-lock",
        hintKey: "IONRIFT.RESPITE.PLAYER_RESTRICTIONS.LockQuantityHint"
    },
    {
        key: "lockAttuneOutsideRest",
        labelKey: "IONRIFT.RESPITE.SETTINGS.lockAttuneOutsideRestName",
        icon: "fas fa-gem",
        hintKey: "IONRIFT.RESPITE.PLAYER_RESTRICTIONS.LockAttuneHint"
    },
    {
        // Library world setting — Primary Party GM-owned PCs (Foundry v14+ only).
        key: "includeGmOwnedPartyMembers",
        moduleId: LIB_ID,
        v14Only: true,
        labelKey: "IONRIFT.LIBRARY.SETTINGS.IncludeGmOwnedPartyMembersName",
        icon: "fas fa-user-shield",
        hintKey: "IONRIFT.LIBRARY.SETTINGS.IncludeGmOwnedPartyMembersHint"
    }
];

function isV14() {
    return (game.release?.generation ?? 0) >= 14;
}

export class PlayerRestrictionsApp extends foundry.applications.api.ApplicationV2 {

    static DEFAULT_OPTIONS = {
        id: "respite-player-restrictions",
        window: {
            title: "IONRIFT.RESPITE.APP.PlayerRestrictionsTitle",
            icon: "fas fa-user-lock",
            resizable: false
        },
        position: { width: 420, height: "auto" },
        classes: ["ionrift-window"]
    };

    /** @override */
    async _prepareContext() {
        const toggles = [];
        for (const t of RESTRICTION_TOGGLES) {
            if (t.v14Only && !isV14()) continue;
            const scope = t.moduleId ?? MODULE_ID;
            let value = false;
            try {
                value = !!game.settings.get(scope, t.key);
            } catch { /* setting missing */ }
            toggles.push({
                key: t.key,
                moduleId: scope,
                icon: t.icon,
                label: localize(t.labelKey),
                hint: localize(t.hintKey),
                value
            });
        }
        return { toggles };
    }

    /** @override */
    async _renderHTML(context) {
        const el = document.createElement("div");
        el.classList.add("respite-settings-config");

        let html = `
        <p class="settings-config-lead">${localize("IONRIFT.RESPITE.PLAYER_RESTRICTIONS.Lead")}</p>
        <div class="settings-config-list">`;

        for (const toggle of context.toggles) {
            html += `
            <div class="settings-config-row" data-key="${toggle.key}">
                <div class="settings-config-info">
                    <div class="settings-config-label">
                        <i class="${toggle.icon} settings-config-icon"></i>
                        ${toggle.label}
                    </div>
                    <div class="settings-config-hint">${toggle.hint}</div>
                </div>
                <label class="settings-config-toggle">
                    <input type="checkbox" class="settings-config-cb"
                           data-key="${toggle.key}"
                           data-module="${toggle.moduleId}"
                           ${toggle.value ? "checked" : ""} />
                    <span class="settings-config-slider"></span>
                </label>
            </div>`;
        }

        html += `</div>
        <div class="settings-config-actions">
            <button type="button" class="settings-config-save-btn">
                <i class="fas fa-save"></i> ${localize("IONRIFT.RESPITE.UI.Save")}
            </button>
        </div>`;

        el.innerHTML = html;
        this._wireEvents(el);
        return el;
    }

    /** @override */
    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    _wireEvents(el) {
        el.querySelector(".settings-config-save-btn")?.addEventListener("click", () => this._onSave(el));
    }

    async _onSave(el) {
        const checkboxes = el.querySelectorAll(".settings-config-cb");
        for (const cb of checkboxes) {
            const scope = cb.dataset.module || MODULE_ID;
            await game.settings.set(scope, cb.dataset.key, cb.checked);
        }
        ui.notifications.info(localize("IONRIFT.RESPITE.NOTIFY.PlayerRestrictionsSaved"));
        this.close();
    }
}
