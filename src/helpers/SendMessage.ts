import fs from "fs";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import GetWhatsappWbot from "./GetWhatsappWbot";
import ValidateWhatsappSession from "./ValidateWhatsappSession";

import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";

export type MessageData = {
  number: number | string;
  body: string;
  mediaPath?: string;
  fileName?: string;
};

export const SendMessage = async (
  whatsapp: Whatsapp,
  messageData: MessageData
): Promise<any> => {
  try {
    const isValidSession = ValidateWhatsappSession(whatsapp);

    if (!isValidSession) {
      throw new AppError("ERR_WAPP_SESSION_INVALID", 401);
    }

    const wbot = await GetWhatsappWbot(whatsapp);
    const chatId = `${messageData.number}@s.whatsapp.net`;

    const preparePresence = async (): Promise<void> => {
      try {
        await wbot.presenceSubscribe(chatId);
        await wbot.sendPresenceUpdate("available", chatId);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        logger.warn(
          `SendMessage -> presence handshake failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    };

    await preparePresence();

    let message;

    if (messageData.mediaPath) {
      const options = await getMessageOptions(
        messageData.fileName,
        messageData.mediaPath,
        messageData.body
      );
      if (options) {
        const body = fs.readFileSync(messageData.mediaPath);
        message = await wbot.sendMessage(chatId, {
          ...options
        });
      }
    } else {
      const body = `\u200e ${messageData.body}`;
      message = await wbot.sendMessage(chatId, { text: body });
    }

    return message;
  } catch (err: any) {
    throw new Error(err);
  }
};
