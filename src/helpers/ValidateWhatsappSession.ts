import Whatsapp from "../models/Whatsapp";
import { loadBaileys } from "../libs/baileys";

let bufferReviver: ((key: string, value: any) => any) | undefined;
loadBaileys()
  .then(mod => {
    bufferReviver = mod.BufferJSON.reviver;
  })
  .catch(() => {
    bufferReviver = undefined;
  });

type KeyPair = {
  public?: Record<string, unknown> | Buffer;
  private?: Record<string, unknown> | Buffer;
};

type SessionCreds = {
  noiseKey?: KeyPair;
  signedIdentityKey?: KeyPair;
  signedPreKey?: {
    keyPair?: KeyPair;
  };
  registrationId?: number;
};

const hasKeyPair = (keyPair?: KeyPair): boolean => {
  return Boolean(keyPair?.public && keyPair?.private);
};

const ValidateWhatsappSession = (whatsapp: Whatsapp): boolean => {
  if (!whatsapp?.session) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      whatsapp.session,
      bufferReviver
    ) as { creds?: SessionCreds };

    const creds = parsed?.creds;

    if (!creds) {
      return false;
    }

    const {
      noiseKey,
      signedIdentityKey,
      signedPreKey,
      registrationId
    } = creds;

    if (typeof registrationId !== "number") {
      return false;
    }

    if (!hasKeyPair(noiseKey)) {
      return false;
    }

    if (!hasKeyPair(signedIdentityKey)) {
      return false;
    }

    if (!hasKeyPair(signedPreKey?.keyPair)) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
};

export default ValidateWhatsappSession;
