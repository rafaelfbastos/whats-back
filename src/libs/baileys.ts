import type * as BaileysNamespace from "@whiskeysockets/baileys";

const dynamicImport = (modulePath: string) =>
  new Function("modulePath", "return import(modulePath);")(modulePath);

let baileysPromise: Promise<typeof BaileysNamespace> | null = null;
let loggerModule: any | null = null;

/**
 * Loads the Baileys ESM module using dynamic import to avoid require/ESM issues.
 * The result is cached to prevent multiple imports.
 */
export const loadBaileys = (): Promise<typeof BaileysNamespace> => {
  if (!baileysPromise) {
    baileysPromise = dynamicImport("@whiskeysockets/baileys");
  }
  return baileysPromise;
};

/**
 * Loads the Baileys logger helper (ESM path).
 */
export const loadBaileysLogger = async () => {
  if (!loggerModule) {
    const mod = await dynamicImport("@whiskeysockets/baileys/lib/Utils/logger.js");
    loggerModule = (mod as any).default || mod;
  }
  return loggerModule;
};
