import axios from "axios";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import puppeteer from "puppeteer";
import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import type { WASocket, proto, WAMessage } from "@whiskeysockets/baileys";
import { loadBaileys } from "../../libs/baileys";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";
import { logger } from "../../utils/logger";
import { isNil } from "lodash";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import getNumberFromJid from "../../utils/getNumberFromJid";

type Session = WASocket & {
  id?: number;
};

interface Request {
  wbot: Session;
  msg: WAMessage;
  ticket: Ticket;
  typebot: QueueIntegrations;
}

interface FileTriggerPayload {
  url: string;
  convert?: boolean;
  caption?: string;
  fileName?: string;
}

interface ContactTriggerPayload {
  phone: string;
  displayName?: string;
  fullName?: string;
  formattedPhone?: string;
  organization?: string;
  email?: string;
}

const typebotTempDir = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "tmp",
  "typebot"
);

const ensureTempDir = async (): Promise<string> => {
  await fs.mkdir(typebotTempDir, { recursive: true });
  return typebotTempDir;
};

const sanitizeFileName = (name: string): string => {
  if (!name) return "";
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
};

const getFileNameFromUrl = (fileUrl: string): string => {
  try {
    const parsedUrl = new URL(fileUrl);
    const baseName = path.basename(parsedUrl.pathname);
    return baseName || "";
  } catch {
    return "";
  }
};

const downloadFileToTemp = async (
  fileUrl: string,
  desiredName?: string
): Promise<{ filePath: string; fileName: string; mimeType: string }> => {
  const baseTmpDir = await ensureTempDir();
  const response = await axios.get<ArrayBuffer>(fileUrl, {
    responseType: "arraybuffer"
  });

  const safeName =
    sanitizeFileName(desiredName || getFileNameFromUrl(fileUrl)) ||
    `arquivo-${Date.now()}`;

  const filePath = path.join(baseTmpDir, `${randomUUID()}-${safeName}`);
  await fs.writeFile(filePath, Buffer.from(response.data));

  return {
    filePath,
    fileName: safeName,
    mimeType: response.headers["content-type"] || "application/octet-stream"
  };
};

const convertUrlToPdf = async (
  pageUrl: string,
  desiredName?: string
): Promise<{ filePath: string; fileName: string; mimeType: string }> => {
  const baseTmpDir = await ensureTempDir();
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ignoreHTTPSErrors: true,
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.goto(pageUrl, {
      waitUntil: "networkidle2",
      timeout: 90000
    });

    const baseName =
      sanitizeFileName(
        desiredName?.replace(/\.pdf$/i, "") ||
          getFileNameFromUrl(pageUrl) ||
          "documento"
      ) + ".pdf";
    const filePath = path.join(baseTmpDir, `${randomUUID()}-${baseName}`);

    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true
    });

    return {
      filePath,
      fileName: baseName,
      mimeType: "application/pdf"
    };
  } finally {
    await browser.close();
  }
};

const cleanupTempFile = async (filePath?: string) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    logger.warn({ filePath, err }, "typebot-file-cleanup-error");
  }
};

const sanitizeDigits = (value: string): string => {
  return value.replace(/\D/g, "");
};

const buildContactVcard = (
  payload: ContactTriggerPayload
): { vcard: string; displayName: string } => {
  const phoneDigits = sanitizeDigits(payload.phone || "");

  if (!phoneDigits) {
    throw new Error("A phone number is required to send a contact");
  }

  const displayName = payload.fullName || payload.displayName || phoneDigits;
  const formattedPhone = payload.formattedPhone || payload.phone || phoneDigits;

  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${displayName}`];

  if (payload.organization) {
    lines.push(`ORG:${payload.organization};`);
  }

  if (payload.email) {
    lines.push(`EMAIL;type=INTERNET:${payload.email}`);
  }

  lines.push(`TEL;type=CELL;type=VOICE;waid=${phoneDigits}:${formattedPhone}`);
  lines.push("END:VCARD");

  return {
    vcard: lines.join("\n"),
    displayName
  };
};

const handleContactTrigger = async ({
  payload,
  wbot,
  remoteJid
}: {
  payload: ContactTriggerPayload;
  wbot: Session;
  remoteJid: string;
}): Promise<void> => {
  const { vcard, displayName } = buildContactVcard(payload);

  await wbot.sendMessage(remoteJid, {
    contacts: {
      displayName,
      contacts: [{ vcard }]
    }
  });
};

const handleFileTrigger = async ({
  payload,
  wbot,
  remoteJid
}: {
  payload: FileTriggerPayload;
  wbot: Session;
  remoteJid: string;
}): Promise<void> => {
  const { url, convert = false, caption, fileName } = payload;

  if (!url) {
    throw new Error("URL is required to send a file.");
  }

  let fileInfo:
    | { filePath: string; fileName: string; mimeType: string }
    | undefined;

  try {
    fileInfo = convert
      ? await convertUrlToPdf(url, fileName)
      : await downloadFileToTemp(url, fileName);

    await wbot.sendMessage(remoteJid, {
      document: { url: fileInfo.filePath },
      mimetype: fileInfo.mimeType,
      fileName: fileInfo.fileName,
      caption
    });
  } finally {
    await cleanupTempFile(fileInfo?.filePath);
  }
};

const typebotListener = async ({
  wbot,
  msg,
  ticket,
  typebot
}: Request): Promise<void> => {
  const { delay } = await loadBaileys();

  if (msg.key.remoteJid === "status@broadcast") return;

  const {
    urlN8N: url,
    typebotExpires,
    typebotKeywordFinish,
    typebotKeywordRestart,
    typebotUnknownMessage,
    typebotSlug,
    typebotDelayMessage,
    typebotRestartMessage
  } = typebot;

  const number = getNumberFromJid(msg.key.remoteJid);
  const replyJid = msg.key.remoteJid || `${number}@s.whatsapp.net`;

  const normalizedKeywordFinish =
    typeof typebotKeywordFinish === "string" ? typebotKeywordFinish : "";
  const closedWords = normalizedKeywordFinish
    .split(" ")
    .map(word => word.trim())
    .filter(word => word.length > 0);

  const keywordRestart = typebotKeywordRestart || "";
  const restartMessage = typebotRestartMessage || typebotUnknownMessage || "";
  const unknownMessage = typebotUnknownMessage || "Desculpe, não entendi.";

  let body = getBodyMessage(msg) || "";

  async function createSession(msg, typebot, number) {
    try {
      const id = Math.floor(Math.random() * 10000000000).toString();

      const reqData = JSON.stringify({
        isStreamEnabled: true,
        message: "string",
        resultId: "string",
        isOnlyRegistering: false,
        prefilledVariables: {
          number: number,
          pushName: msg.pushName || ""
        }
      });

      const config = {
        method: "post" as const,
        maxBodyLength: Infinity,
        url: `${url}/api/v1/typebots/${typebotSlug}/startChat`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        data: reqData
      };

      const request = await axios.request(config);

      return request.data;
    } catch (err) {
      logger.info("Erro ao criar sessão do typebot: ", err);
      throw err;
    }
  }

  let sessionId;
  let dataStart;
  let status = false;
  try {
    const dataLimite = new Date();
    dataLimite.setMinutes(dataLimite.getMinutes() - Number(typebotExpires));

    if (typebotExpires > 0 && ticket.updatedAt < dataLimite) {
      await ticket.update({
        typebotSessionId: null,
        isBot: true
      });

      await ticket.reload();
    }

    if (isNil(ticket.typebotSessionId)) {
      dataStart = await createSession(msg, typebot, number);
      sessionId = dataStart.sessionId;
      status = true;
      await ticket.update({
        typebotSessionId: sessionId,
        typebotStatus: true,
        useIntegration: true,
        integrationId: typebot.id
      });
    } else {
      sessionId = ticket.typebotSessionId;
      status = ticket.typebotStatus;
    }

    if (!status) return;

    //let body = getConversationMessage(msg);

    if (!closedWords.includes(body) && body !== keywordRestart) {
      let requestContinue;
      let messages;
      let input;
      if (dataStart?.messages.length === 0 || dataStart === undefined) {
        const reqData = JSON.stringify({
          message: body
        });

        let config = {
          method: "post" as const,
          maxBodyLength: Infinity,
          url: `${url}/api/v1/sessions/${sessionId}/continueChat`,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          data: reqData
        };
        requestContinue = await axios.request(config);
        messages = requestContinue.data?.messages;
        input = requestContinue.data?.input;
      } else {
        messages = dataStart?.messages;
        input = dataStart?.input;
      }

      if (messages?.length === 0) {
        await wbot.sendMessage(replyJid, { text: unknownMessage });
      } else {
        for (const message of messages) {
          if (message.type === "text") {
            let formattedText = "";
            let linkPreview = false;
            for (const richText of message.content.richText) {
              for (const element of richText.children) {
                let text = "";

                if (element.text) {
                  text = element.text;
                }
                if (element.type && element.children) {
                  for (const subelement of element.children) {
                    let text = "";

                    if (subelement.text) {
                      text = subelement.text;
                    }

                    if (subelement.type && subelement.children) {
                      for (const subelement2 of subelement.children) {
                        let text = "";

                        if (subelement2.text) {
                          text = subelement2.text;
                        }

                        if (subelement2.bold) {
                          text = `*${text}*`;
                        }
                        if (subelement2.italic) {
                          text = `_${text}_`;
                        }
                        if (subelement2.underline) {
                          text = `~${text}~`;
                        }
                        if (subelement2.url) {
                          const linkText = subelement2.children[0].text;
                          text = `[${linkText}](${subelement2.url})`;
                          linkPreview = true;
                        }
                        formattedText += text;
                      }
                    }
                    if (subelement.bold) {
                      text = `*${text}*`;
                    }
                    if (subelement.italic) {
                      text = `_${text}_`;
                    }
                    if (subelement.underline) {
                      text = `~${text}~`;
                    }
                    if (subelement.url) {
                      const linkText = subelement.children[0].text;
                      text = `[${linkText}](${subelement.url})`;
                      linkPreview = true;
                    }
                    formattedText += text;
                  }
                }

                if (element.bold) {
                  text = `*${text}*`;
                }
                if (element.italic) {
                  text = `_${text}_`;
                }
                if (element.underline) {
                  text = `~${text}~`;
                }

                if (element.url) {
                  const linkText = element.children[0].text;
                  text = `[${linkText}](${element.url})`;
                  linkPreview = true;
                }

                formattedText += text;
              }
              formattedText += "\n";
            }
            formattedText = formattedText.replace("**", "").replace(/\n$/, "");

            if (formattedText === "Invalid message. Please, try again.") {
              formattedText = unknownMessage;
            }

            if (formattedText.startsWith("#")) {
              let gatilho = formattedText.replace("#", "");

              try {
                let jsonGatilho = JSON.parse(gatilho);

                if (
                  jsonGatilho.stopBot &&
                  isNil(jsonGatilho.userId) &&
                  isNil(jsonGatilho.queueId)
                ) {
                  await ticket.update({
                    useIntegration: false,
                    isBot: false
                  });

                  return;
                }
                if (
                  !isNil(jsonGatilho.queueId) &&
                  jsonGatilho.queueId > 0 &&
                  isNil(jsonGatilho.userId)
                ) {
                  await UpdateTicketService({
                    ticketData: {
                      queueId: jsonGatilho.queueId,
                      chatbot: false,
                      useIntegration: false,
                      integrationId: null
                    },
                    ticketId: ticket.id,
                    companyId: ticket.companyId
                  });

                  return;
                }

                if (
                  (jsonGatilho.action === "sendFile" ||
                    jsonGatilho.type === "sendFile") &&
                  jsonGatilho.url
                ) {
                  try {
                    await handleFileTrigger({
                      payload: {
                        url: jsonGatilho.url,
                        convert: Boolean(jsonGatilho.convert),
                        caption: jsonGatilho.caption,
                        fileName: jsonGatilho.fileName
                      },
                      wbot,
                      remoteJid: msg.key.remoteJid
                    });
                  } catch (error) {
                    logger.warn(
                      {
                        payload: jsonGatilho,
                        error
                      },
                      "typebot-send-file-trigger-error"
                    );
                  }
                  continue;
                }

                if (
                  (jsonGatilho.action === "sendContact" ||
                    jsonGatilho.type === "sendContact") &&
                  jsonGatilho.phone
                ) {
                  try {
                    await handleContactTrigger({
                      payload: {
                        phone: jsonGatilho.phone,
                        displayName: jsonGatilho.displayName,
                        fullName: jsonGatilho.fullName,
                        formattedPhone: jsonGatilho.formattedPhone,
                        organization: jsonGatilho.organization,
                        email: jsonGatilho.email
                      },
                      wbot,
                      remoteJid: msg.key.remoteJid
                    });
                  } catch (error) {
                    logger.warn(
                      {
                        payload: jsonGatilho,
                        error
                      },
                      "typebot-send-contact-trigger-error"
                    );
                  }
                  continue;
                }

                if (
                  !isNil(jsonGatilho.queueId) &&
                  jsonGatilho.queueId > 0 &&
                  !isNil(jsonGatilho.userId) &&
                  jsonGatilho.userId > 0
                ) {
                  await UpdateTicketService({
                    ticketData: {
                      queueId: jsonGatilho.queueId,
                      userId: jsonGatilho.userId,
                      chatbot: false,
                      useIntegration: false,
                      integrationId: null
                    },
                    ticketId: ticket.id,
                    companyId: ticket.companyId
                  });

                  return;
                }
              } catch (err) {
                logger.warn("Invalid typebot trigger payload", {
                  gatilho,
                  ticketId: ticket.id,
                  error: err
                });
              }
            }

            await wbot.presenceSubscribe(msg.key.remoteJid);
            //await delay(2000)
            await wbot.sendPresenceUpdate("composing", msg.key.remoteJid);
            await delay(typebotDelayMessage);
            await wbot.sendPresenceUpdate("paused", msg.key.remoteJid);

            await wbot.sendMessage(msg.key.remoteJid, { text: formattedText });
          }

          if (message.type === "audio") {
            await wbot.presenceSubscribe(msg.key.remoteJid);
            //await delay(2000)
            await wbot.sendPresenceUpdate("composing", msg.key.remoteJid);
            await delay(typebotDelayMessage);
            await wbot.sendPresenceUpdate("paused", msg.key.remoteJid);
            const media = {
              audio: {
                url: message.content.url,
                mimetype: "audio/mp4",
                ptt: true
              }
            };
            await wbot.sendMessage(msg.key.remoteJid, media);
          }

          // if (message.type === 'embed') {
          //     await wbot.presenceSubscribe(msg.key.remoteJid)
          //     //await delay(2000)
          //     await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
          //     await delay(typebotDelayMessage)
          //     await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
          //     const media = {

          //         document: { url: message.content.url },
          //         mimetype: 'application/pdf',
          //         caption: ""

          //     }
          //     await wbot.sendMessage(msg.key.remoteJid, media);
          // }

          if (message.type === "image") {
            await wbot.presenceSubscribe(msg.key.remoteJid);
            //await delay(2000)
            await wbot.sendPresenceUpdate("composing", msg.key.remoteJid);
            await delay(typebotDelayMessage);
            await wbot.sendPresenceUpdate("paused", msg.key.remoteJid);
            const media = {
              image: {
                url: message.content.url
              }
            };
            await wbot.sendMessage(msg.key.remoteJid, media);
          }

          // if (message.type === 'video' ) {
          //     await wbot.presenceSubscribe(msg.key.remoteJid)
          //     //await delay(2000)
          //     await wbot.sendPresenceUpdate('composing', msg.key.remoteJid)
          //     await delay(typebotDelayMessage)
          //     await wbot.sendPresenceUpdate('paused', msg.key.remoteJid)
          //     const media = {
          //         video: {
          //             url: message.content.url,
          //         },

          //     }
          //     await wbot.sendMessage(msg.key.remoteJid, media);
          // }
        }
        if (input) {
          if (input.type === "choice input") {
            let formattedText = "";
            const items = input.items;
            for (const item of items) {
              formattedText += `▶️ ${item.content}\n`;
            }
            formattedText = formattedText.replace(/\n$/, "");
            await wbot.presenceSubscribe(msg.key.remoteJid);
            //await delay(2000)
            await wbot.sendPresenceUpdate("composing", msg.key.remoteJid);
            await delay(typebotDelayMessage);
            await wbot.sendPresenceUpdate("paused", msg.key.remoteJid);
            await wbot.sendMessage(msg.key.remoteJid, { text: formattedText });
          }
        }
      }
    }
    if (body === keywordRestart && keywordRestart !== "") {
      await ticket.update({
        isBot: true,
        typebotSessionId: null
      });

      await ticket.reload();

      await wbot.sendMessage(replyJid, { text: restartMessage });
    }
    if (closedWords.includes(body)) {
      await UpdateTicketService({
        ticketData: {
          status: "closed",
          useIntegration: false,
          integrationId: null
        },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      return;
    }
  } catch (error) {
    logger.info("Error on typebotListener: ", error);
    await ticket.update({
      typebotSessionId: null
    });
    throw error;
  }
};

export default typebotListener;
