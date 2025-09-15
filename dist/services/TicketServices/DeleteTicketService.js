"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const TicketTraking_1 = __importDefault(require("../../models/TicketTraking"));
const DeleteTicketService = async (id) => {
    const ticket = await Ticket_1.default.findOne({
        where: { id }
    });
    if (!ticket) {
        throw new AppError_1.default("ERR_NO_TICKET_FOUND", 404);
    }
    const tracking = await TicketTraking_1.default.findOne({
        where: { ticketId: ticket.id }
    });
    if (tracking) {
        tracking.finishedAt = new Date();
        tracking.save();
    }
    await tracking.save();
    await ticket.destroy();
    return ticket;
};
exports.default = DeleteTicketService;
