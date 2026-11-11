/** Messages between the isolated content script and the MAIN-world YouTube filter. */
export const MSG_FROM_CONTENT = 'safehouse-cs';
export const MSG_FROM_MAIN = 'safehouse-main';

/** localStorage key (on youtube.com) caching the config, so the MAIN world can read it synchronously. */
export const CFG_STORAGE_KEY = '__safehouse_cfg';

export interface MainWorldConfig {
  /** Global switch AND the YouTube site toggle. */
  active: boolean;
  includeOlderGta: boolean;
  customKeywords: string[];
  allowlist: string[];
}

/** Extension-internal runtime messages. */
export type RuntimeMessage =
  | { type: 'count'; count: number }
  | { type: 'getCount' }
  | { type: 'allowOnce'; url: string };
