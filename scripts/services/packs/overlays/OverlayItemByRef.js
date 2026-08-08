import { MODULE_ID } from "../../../data/moduleId.js";

const cache = new Map();

export function clearOverlayItemByRefCache() {
  cache.clear();
}

export async function loadOverlayItemDataByRef(itemRef, moduleId = MODULE_ID) {
  if (!itemRef) return null;
  if (cache.has(itemRef)) return cache.get(itemRef);

  const overlay = game.ionrift?.library?.overlay;
  if (!overlay) return null;

  try {
    const sublayers = await overlay.listInstalledSublayers(moduleId);
    for (const sublayer of sublayers) {
      const manifest = await overlay.getLocalManifest(moduleId, sublayer);
      if (!manifest?.overlayId) continue;
      const active = await overlay.isOverlayActive(manifest.overlayId, moduleId, sublayer);
      if (!active) continue;

      let paths = (await overlay.readFileIndex(moduleId, sublayer) ?? [])
        .filter(p => p.startsWith("items/") && p.endsWith(".json") && !p.endsWith("/_folders.json"));

      if (!paths.length) {
        for (const dir of ["forage", "hunting", "butcher"]) {
          const listing = await overlay.listOverlayDir(moduleId, sublayer, `items/${dir}`);
          for (const file of listing?.files ?? []) {
            if (!file.endsWith(".json") || file === "_folders.json") continue;
            paths.push(`items/${dir}/${file}`);
          }
        }
      }

      for (const relPath of paths) {
        const data = await overlay.readOverlayFile(moduleId, sublayer, relPath);
        const ref = data?.flags?.[moduleId]?.itemRef;
        if (ref === itemRef && data?.name) {
          cache.set(itemRef, data);
          return data;
        }
      }
    }
  } catch (e) {
    console.warn(`${MODULE_ID} | loadOverlayItemDataByRef failed:`, e);
  }
  cache.set(itemRef, null);
  return null;
}
