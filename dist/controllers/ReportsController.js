"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.departamentRatings = exports.rushHour = exports.appointmentsAtendent = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../database"));
const appointmentsAtendent = async (req, res) => {
    const { companyId, initialDate, finalDate } = req.query;
    const resultAppointmentsByAttendents = await database_1.default.query(`
      SELECT 
         u."name" as user_name
        ,COUNT(t.*) as total_tickets
      FROM "Users" u 
      LEFT JOIN "TicketTraking" tt ON tt."userId" = u.id 
      LEFT JOIN "Tickets" t ON t.id = tt."ticketId" AND t."createdAt" BETWEEN '${initialDate}' AND '${finalDate}'
      where u."companyId" = ${companyId}
      GROUP BY u."name"
      ORDER BY total_tickets ASC
    `, { type: sequelize_1.QueryTypes.SELECT });
    const resultTicketsByQueues = await database_1.default.query(`
      SELECT 
        q."name"
        ,COUNT(DISTINCT t.id) as total_tickets 
      FROM "Queues" q 
      LEFT JOIN "Messages" m ON m."queueId" = q.id 
      LEFt JOIN "Tickets" t ON t.id = m."ticketId"  AND t."createdAt" BETWEEN '${initialDate}' AND '${finalDate}'
      WHERE q."companyId" = ${companyId}
      GROUP BY q."name" 
      ORDER BY total_tickets ASC
    `, { type: sequelize_1.QueryTypes.SELECT });
    return res.json({
        appointmentsByAttendents: resultAppointmentsByAttendents,
        ticketsByQueues: resultTicketsByQueues,
    });
};
exports.appointmentsAtendent = appointmentsAtendent;
const rushHour = async (req, res) => {
    const { companyId, initialDate, finalDate } = req.query;
    const resultAppointmentsByHours = await database_1.default.query(`
      SELECT
        extract (hour from m."createdAt") AS message_hour,
        COUNT(m.id) AS message_count
      FROM "Messages" m
      LEFT JOIN "Tickets" t ON t.id = m."ticketId"
      WHERE t."companyId" = ${companyId}
        AND m."createdAt" BETWEEN '${initialDate}' AND '${finalDate}'
      GROUP BY
        extract (hour from m."createdAt")
      ORDER BY
        extract (hour from m."createdAt")
    `, { type: sequelize_1.QueryTypes.SELECT });
    return res.json(resultAppointmentsByHours);
};
exports.rushHour = rushHour;
const departamentRatings = async (req, res) => {
    const { companyId, initialDate, finalDate } = req.query;
    const resultDepartamentRating = await database_1.default.query(`
      SELECT
        m."ticketId"
        ,q."name"
        ,round(avg(ur.rate), 2) AS total_rate
      FROM "Messages" m
      LEFT JOIN "Tickets" t ON t.id = m."ticketId"
      LEFT JOIN "UserRatings" ur ON ur."ticketId" = t.id
      LEFT JOIN "Queues" q ON q.id = m."queueId"
      WHERE m."queueId" IS NOT NULL
        AND m."companyId" = ${companyId}
        AND ur."createdAt" BETWEEN '${initialDate}' AND '${finalDate}'
      GROUP BY m."ticketId", q."name"
    `, { type: sequelize_1.QueryTypes.SELECT });
    return res.json(resultDepartamentRating);
};
exports.departamentRatings = departamentRatings;
