"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../../errors/AppError"));
const GetTicketWbot_1 = __importDefault(require("../../helpers/GetTicketWbot"));
const Message_1 = __importDefault(require("../../models/Message"));
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const EditWhatsAppMessage = async ({ messageId, body, }) => {
    const message = await Message_1.default.findByPk(messageId, {
        include: [
            {
                model: Ticket_1.default,
                as: "ticket",
                include: ["contact"]
            }
        ]
    });
    if (!message) {
        throw new AppError_1.default("No message found with this ID.");
    }
    const { ticket } = message;
    const wbot = await (0, GetTicketWbot_1.default)(ticket);
    const msg = JSON.parse(message.dataJson);
    try {
        await wbot.sendMessage(message.remoteJid, {
            text: body,
            edit: msg.key,
        }, {});
        message.update({ body: body, isEdited: true });
        return { ticket: message.ticket, message: message };
    }
    catch (err) {
        console.log(err);
        throw new AppError_1.default("ERR_EDITING_WAPP_MSG");
    }
};
exports.default = EditWhatsAppMessage;
