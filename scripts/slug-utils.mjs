/**
 * slug-utils.mjs
 * Converts Obsidian project folder names to URL-safe slugs.
 *
 * Example: "2026-02_tr_ÉQUITÉ" -> "2026-02-tr-equite"
 */

/**
 * Convert a project folder name to a URL-safe slug.
 *
 * Steps:
 *   1. Unicode NFD normalisation (decomposes e.g. É into E + combining acute)
 *   2. Strip combining diacritical marks (U+0300..U+036F)
 *   3. Replace underscores with hyphens
 *   4. Lowercase the whole string
 *   5. Collapse consecutive hyphens into one
 *   6. Trim leading/trailing hyphens
 *
 * @param {string} folderName - The raw folder name (e.g. "2026-02_tr_ÉQUITÉ")
 * @returns {string}          - URL-safe slug   (e.g. "2026-02-tr-equite")
 */
export function folderToSlug(folderName) {
  return folderName
    .normalize('NFD')                      // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')       // strip combining marks
    .replace(/_/g, '-')                    // underscores -> hyphens
    .toLowerCase()                         // lowercase
    .replace(/-{2,}/g, '-')               // collapse consecutive hyphens
    .replace(/^-|-$/g, '');               // trim edge hyphens
}
