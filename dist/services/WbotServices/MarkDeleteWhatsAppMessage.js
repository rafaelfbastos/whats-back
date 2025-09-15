"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Message_1 = __importDefault(require("../../models/Message"));
const socket_1 = require("../../libs/socket");
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const UpdateTicketService_1 = __importDefault(require("../TicketServices/UpdateTicketService"));
const MarkDeleteWhatsAppMessage = async (from, timestamp, msgId, companyId) => {
    from = from.replace('@c.us', '').replace('@s.whatsapp.net', '');
    if (msgId) {
        const messages = await Message_1.default.findAll({
            where: {
                id: msgId,
                companyId
            }
        });
        try {
            const messageToUpdate = await Message_1.default.findByPk(messages[0].id, {
                include: [
                    "contact",
                    {
                        model: Message_1.default,
                        as: "quotedMsg",
                        include: ["contact"]
                    }
                ]
            });
            if (messageToUpdate) {
                const ticket = await Ticket_1.default.findOne({
                    where: {
                        id: messageToUpdate.ticketId,
                        companyId
                    }
                });
                await messageToUpdate.update({ isDeleted: true });
                await (0, UpdateTicketService_1.default)({ ticketData: { lastMessage: "🚫 _Mensagem Apagada_" }, ticketId: ticket.id, companyId });
                const io = (0, socket_1.getIO)();
                io.of(companyId.toString())
                    // .to(messageToUpdate.ticketId.toString())
                    .emit(`appMessage-${messageToUpdate}`, {
                    action: "update",
                    message: messageToUpdate
                });
            }
        }
        catch (err) {
            console.log("Erro ao tentar marcar a mensagem com excluída");
        }
        return timestamp;
    }
    ;
};
exports.default = MarkDeleteWhatsAppMessage;
