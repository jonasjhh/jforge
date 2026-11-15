// Describes one module. Each module's meta.ts exports one of these; the
// landing page lists every module from it and the module's Vite config
// builds its PWA manifest from it.
export interface ModuleMeta {
  /** Folder name under modules/, URL path (/<name>/) and API prefix (/api/<name>). */
  name: string;
  title: string;
  description: string;
  /** Background and theme colour of the installed app. */
  themeColor: string;
  /** Port of this module's Vite dev server. Unique per module. */
  devPort: number;
}
