/**
 * Load forage/hunt provision items directly from active Respite overlays.
 * Works even when world-compendium materialisation produced an empty pack.
 */

import { MODULE_ID } from "../../../data/moduleId.js";

/**
 * @returns {Promise<Array<{
 *   itemRef: string,
 *   category: "forage"|"hunt",
 *   terrains: string[],
 *   itemData: object,
 *   quantity: number
 * }>>}
 */
export async function loadOverlayProvisionItems() {
    const overlay = game.ionrift?.library?.overlay;
    if (!overlay) return [];

    const rows = [];
    try {
        const sublayers = await overlay.listInstalledSublayers(MODULE_ID);
        for (const sublayer of sublayers) {
            const manifest = await overlay.getLocalManifest(MODULE_ID, sublayer);
            if (!manifest?.overlayId) continue;
            const active = await overlay.isOverlayActive(manifest.overlayId, MODULE_ID, sublayer);
            if (!active) continue;

            const fileIndex = await overlay.readFileIndex(MODULE_ID, sublayer);
            const paths = (fileIndex ?? []).filter(path =>
                /^items\/(forage|hunting)\//.test(path)
                && path.endsWith(".json")
                && !path.endsWith("/_folders.json")
            );

            // Browse fallback when index is missing or incomplete.
            let itemPaths = paths;
            if (!itemPaths.length) {
                for (const packDir of ["forage", "hunting"]) {
                    const listing = await overlay.listOverlayDir(MODULE_ID, sublayer, `items/${packDir}`);
                    for (const file of listing?.files ?? []) {
                        if (!file.endsWith(".json") || file === "_folders.json") continue;
                        itemPaths.push(`items/${packDir}/${file}`);
                    }
                }
            }

            for (const relPath of itemPaths) {
                const data = await overlay.readOverlayFile(MODULE_ID, sublayer, relPath);
                if (!data?.name) continue;
                const rf = data.flags?.[MODULE_ID] ?? {};
                const category = rf.category === "hunt" || relPath.includes("/hunting/")
                    ? "hunt"
                    : rf.category === "forage" || relPath.includes("/forage/")
                        ? "forage"
                        : null;
                if (!category) continue;

                let terrains;
                if (rf.terrain === "any") {
                    terrains = ["forest", "swamp", "desert", "mountain", "arctic", "wilderness"];
                } else if (rf.terrain) {
                    terrains = String(rf.terrain).split(",").map(t => t.trim()).filter(Boolean);
                } else {
                    continue;
                }

                const itemRef = rf.itemRef
                    ?? String(data.name).toLowerCase().replace(/\s+/g, "_");
                rows.push({
                    itemRef,
                    category,
                    terrains,
                    itemData: data,
                    quantity: 1
                });
            }
        }
    } catch (e) {
        console.warn(`${MODULE_ID} | OverlayProvisionItemLoader failed:`, e);
    }
    return rows;
}

/**
 * Merge overlay provision rows into a travel resolver (inline itemData).
 * @param {import("../../travel/resolve/TravelResolver.js").TravelResolver} resolver
 * @returns {Promise<number>} rows loaded
 */
export async function applyOverlayProvisionItems(resolver) {
    if (!resolver?.loadInlineProvisionItems) return 0;
    const rows = await loadOverlayProvisionItems();
    if (!rows.length) return 0;
    resolver.loadInlineProvisionItems(rows, { overrideRefs: true });
    return rows.length;
}
