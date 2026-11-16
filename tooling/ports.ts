// Local dev ports. Different from heatshift (8789/9230) and kinetic
// (8788/9229) so all of them can run side by side. Keep in sync with the
// [dev] section of wrangler.toml.
export const WORKER_DEV_PORT = 8790;
export const LANDING_DEV_PORT = 5180;
/** The Worker the end-to-end tests start, apart from a running dev server. */
export const WORKER_E2E_PORT = 8791;
export const WORKER_E2E_INSPECTOR_PORT = 9232;
