import * as Sentry from "@sentry/node";
import type {
  WASocket,
  Browsers,
  DisconnectReason,
  CacheStore
} from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import { FindOptions } from "sequelize/types";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import authState from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from 'node-cache';
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import { loadBaileys, loadBaileysLogger } from "./baileys";
import getNumberFromJid from "../utils/getNumberFromJid";
let cachedBaileys: Awaited<ReturnType<typeof loadBaileys>> | null = null;
const getBaileys = async () => {
  if (!cachedBaileys) cachedBaileys = await loadBaileys();
  return cachedBaileys;
};

type Session = WASocket & {
  id?: number;
};

const sessions: Session[] = [];

const retriesQrCodeMap = new Map<number, number>();

type QrCodeWaiter = {
  resolve: (qrCode: string) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
};

const qrCodeWaiters = new Map<number, QrCodeWaiter>();

const resolveQrCodeWaiter = (whatsappId: number, qrCode: string): void => {
  const waiter = qrCodeWaiters.get(whatsappId);

  if (!waiter) return;

  clearTimeout(waiter.timeout);
  qrCodeWaiters.delete(whatsappId);
  waiter.resolve(qrCode);
};

const rejectQrCodeWaiter = (whatsappId: number, error: Error | string): void => {
  const waiter = qrCodeWaiters.get(whatsappId);

  if (!waiter) return;

  clearTimeout(waiter.timeout);
  qrCodeWaiters.delete(whatsappId);
  const formattedError =
    typeof error === "string"
      ? new AppError(error)
      : error;
  waiter.reject(formattedError);
};

export const waitForQrCode = (
  whatsappId: number,
  timeoutMs = 60000
): Promise<string> => {
  if (qrCodeWaiters.has(whatsappId)) {
    throw new AppError(
      "Já existe uma solicitação de QR Code em andamento para esta conexão.",
      429
    );
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      qrCodeWaiters.delete(whatsappId);
      reject(
        new AppError(
          "Não foi possível gerar o QR Code dentro do tempo limite.",
          504
        )
      );
    }, timeoutMs);

    qrCodeWaiters.set(whatsappId, {
      resolve: (qrCode: string) => {
        clearTimeout(timeout);
        qrCodeWaiters.delete(whatsappId);
        resolve(qrCode);
      },
      reject: (error: unknown) => {
        clearTimeout(timeout);
        qrCodeWaiters.delete(whatsappId);
        reject(error);
      },
      timeout
    });
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      if (isLogout) {
        sessions[sessionIndex].logout();
        sessions[sessionIndex].ws.close();
      }

      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

export const restartWbot = async (
  companyId: number,
  session?: any
): Promise<void> => {
  try {
    const options: FindOptions = {
      where: {
        companyId,
      },
      attributes: ["id"],
    }

    const whatsapp = await Whatsapp.findAll(options);

    whatsapp.map(async c => {
      const sessionIndex = sessions.findIndex(s => s.id === c.id);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].ws.close();
      }

    });

  } catch (err) {
    logger.error(err);
  }
};

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      (async () => {
        const baileys = await getBaileys();
        const MAIN_LOGGER = await loadBaileysLogger();
        const loggerBaileys = MAIN_LOGGER.child({});
        loggerBaileys.level = "error";

        const io = getIO();

        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });

        if (!whatsappUpdate) return;

        const { id, name, provider } = whatsappUpdate;

        const { version, isLatest } = await baileys.fetchLatestBaileysVersion();
        const isLegacy = provider === "stable" ? true : false;
        const DisconnectReason = baileys.DisconnectReason;

        logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
        logger.info(`isLegacy: ${isLegacy}`);
        logger.info(`Starting session ${name}`);
        let retriesQrCode = 0;

        let wsocket: Session = null;
        const { state, saveState } = await authState(whatsapp);

        const msgRetryCounterCache = new NodeCache();
        const userDevicesCache: CacheStore = new NodeCache();

        wsocket = baileys.default({
          logger: loggerBaileys,
          printQRInTerminal: false,
          browser: [
            process.env.BROWSER_CLIENT || "Zappey",
            process.env.BROWSER_NAME || "Chrome",
            process.env.BROWSER_VERSION || "10.0"
          ],
          auth: {
            creds: state.creds,
            keys: baileys.makeCacheableSignalKeyStore(state.keys, logger),
          },
          version,
          // defaultQueryTimeoutMs: 60000,
          // retryRequestDelayMs: 250,
          // keepAliveIntervalMs: 1000 * 60 * 10 * 3,
          msgRetryCounterCache,
          shouldIgnoreJid: jid => baileys.isJidBroadcast(jid),
        });

        // wsocket = makeWASocket({
        //   version,
        //   logger: loggerBaileys,
        //   printQRInTerminal: false,
        //   auth: state as AuthenticationState,
        //   generateHighQualityLinkPreview: false,
        //   shouldIgnoreJid: jid => isJidBroadcast(jid),
        //   browser: ["Chat", "Chrome", "10.15.7"],
        //   patchMessageBeforeSending: (message) => {
        //     const requiresPatch = !!(
        //       message.buttonsMessage ||
        //       // || message.templateMessage
        //       message.listMessage
        //     );
        //     if (requiresPatch) {
        //       message = {
        //         viewOnceMessage: {
        //           message: {
        //             messageContextInfo: {
        //               deviceListMetadataVersion: 2,
        //               deviceListMetadata: {},
        //             },
        //             ...message,
        //           },
        //         },
        //       };
        //     }

        //     return message;
        //   },
        // })

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            logger.info(`Socket ${name} Connection Update ${connection || ""} ${lastDisconnect || ""}`);

            const disconect = (lastDisconnect?.error as Boom)?.output?.statusCode;

            if (connection === "close") {
              if (disconect === 403) {
                await whatsapp.update({ status: "PENDING", session: "", number: "" });
                removeWbot(id, false);

                await DeleteBaileysService(whatsapp.id);

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
              }

              if (disconect !== DisconnectReason.loggedOut) {
                removeWbot(id, false);
                setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 2000);
              } else {
                await whatsapp.update({ status: "PENDING", session: "", number: "" });
                await DeleteBaileysService(whatsapp.id);

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                removeWbot(id, false);
                setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 2000);
              }

              rejectQrCodeWaiter(
                id,
                "A sessão do WhatsApp foi encerrada antes que o QR Code fosse gerado."
              );
            }

            if (connection === "open") {
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0,
                number:
                  wsocket.type === "md"
                    ? baileys.jidNormalizedUser((wsocket as WASocket).user.id).split("@")[0]
                    : "-"
              });

              io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                action: "update",
                session: whatsapp
              });

              const sessionIndex = sessions.findIndex(
                s => s.id === whatsapp.id
              );
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }

              resolve(wsocket);

              rejectQrCodeWaiter(
                id,
                "A sessão do WhatsApp foi autenticada antes de gerar um QR Code."
              );
            }

            if (qr !== undefined) {
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                await whatsapp.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsapp.id);

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit("whatsappSession", {
                  action: "update",
                  session: whatsapp
                });
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                wsocket = null;
                retriesQrCodeMap.delete(id);

                rejectQrCodeWaiter(
                  id,
                  "Quantidade máxima de tentativas de geração de QR Code excedida."
                );
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0,
                  number: ""
                });
                const sessionIndex = sessions.findIndex(
                  s => s.id === whatsapp.id
                );

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  sessions.push(wsocket);
                }

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });

                resolveQrCodeWaiter(id, qr);
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveState);

        wsocket.ev.on(
          "presence.update",
          async ({ id: remoteJid, presences }) => {
            try {
              logger.debug(
                { remoteJid, presences },
                "Received contact presence"
              );
              if (!presences[remoteJid]?.lastKnownPresence) {
                return;
              }
              const contact = await Contact.findOne({
                where: {
                  number: getNumberFromJid(remoteJid),
                  companyId: whatsapp.companyId
                }
              });
              if (!contact) {
                return;
              }
              const ticket = await Ticket.findOne({
                where: {
                  contactId: contact.id,
                  whatsappId: whatsapp.id,
                  status: {
                    [Op.or]: ["open", "pending"]
                  }
                }
              });

              if (ticket) {
                io.to(ticket.id.toString())
                  .to(`company-${whatsapp.companyId}-${ticket.status}`)
                  .to(`queue-${ticket.queueId}-${ticket.status}`)
                  .emit(`company-${whatsapp.companyId}-presence`, {
                    ticketId: ticket.id,
                    presence: presences[remoteJid].lastKnownPresence
                  });
              }
            } catch (error) {
              logger.error(
                { remoteJid, presences },
                "presence.update: error processing"
              );
              if (error instanceof Error) {
                logger.error(`Error: ${error.name} ${error.message}`);
              } else {
                logger.error(`Error was object of type: ${typeof error}`);
              }
            }
          }
        );

      })();
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
      reject(error);
    }
  });
};
