// JSDoc-only type definitions mirroring tokengratis-id's `lib/types.ts`
// (the canonical schema). No runtime code — this file exists purely so
// editors can resolve the `import("./types.mjs").Provider` JSDoc references
// used elsewhere in this package. Kept in sync loosely; the live JSON from
// the API is always the source of truth, this package never validates or
// invents fields beyond what upstream sends.

/**
 * @typedef {"provider_api" | "inference_provider"} ProviderCategory
 */

/**
 * @typedef {Object} Model
 * @property {string} id
 * @property {string} name
 * @property {string | null} context
 * @property {string | null} maxOutput
 * @property {string | null} modality
 * @property {string | null} rateLimit
 */

/**
 * @typedef {Object} SourceRef
 * @property {string} name
 * @property {string} url
 * @property {string} syncedAt
 */

/**
 * @typedef {Object} Provider
 * @property {string} slug
 * @property {string} name
 * @property {ProviderCategory | null} category
 * @property {string | null} country
 * @property {string | null} flag
 * @property {string | null} domain
 * @property {string | null} logo
 * @property {string | null} url
 * @property {string | null} baseUrl
 * @property {string} [description]
 * @property {string[]} modalities
 * @property {number} modelCount
 * @property {string | null} maxContext
 * @property {string | null} freeLimit
 * @property {string | null} moreModels
 * @property {Model[]} models
 * @property {SourceRef[]} sources
 * @property {string} syncedAt
 * @property {string | null} sourceUpdatedAt
 */

export {};
