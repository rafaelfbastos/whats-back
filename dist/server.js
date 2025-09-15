"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_graceful_shutdown_1 = __importDefault(require("http-graceful-shutdown"));
const app_1 = __importDefault(require("./app"));
const socket_1 = require("./libs/socket");
const logger_1 = require("./utils/logger");
const StartAllWhatsAppsSessions_1 = require("./services/WbotServices/StartAllWhatsAppsSessions");
const Company_1 = __importDefault(require("./models/Company"));
const queues_1 = require("./queues");
const wbotTransferTicketQueue_1 = require("./wbotTransferTicketQueue");
const node_cron_1 = __importDefault(require("node-cron"));
const server = app_1.default.listen(process.env.PORT, async () => {
    try {
        const companies = await Company_1.default.findAll();
        const sessionPromises = [];
        for (const c of companies) {
            sessionPromises.push((0, StartAllWhatsAppsSessions_1.StartAllWhatsAppsSessions)(c.id));
        }
        await Promise.all(sessionPromises);
        (0, queues_1.startQueueProcess)();
        logger_1.logger.info(`Server started on port: ${process.env.PORT}`);
    }
    catch (error) {
        logger_1.logger.error("Error starting server:", error);
        process.exit(1);
    }
});
process.on("uncaughtException", err => {
    console.error(`${new Date().toUTCString()} uncaughtException:`, err.message);
    console.error(err.stack);
    process.exit(1);
});
process.on("unhandledRejection", (reason, p) => {
    console.error(`${new Date().toUTCString()} unhandledRejection:`, reason, p);
    process.exit(1);
});
node_cron_1.default.schedule("* * * * *", async () => {
    try {
        logger_1.logger.info(`Serviço de transferência de tickets iniciado`);
        await (0, wbotTransferTicketQueue_1.TransferTicketQueue)();
    }
    catch (error) {
        logger_1.logger.error("Error in cron job:", error);
    }
});
(0, socket_1.initIO)(server);
// Configure graceful shutdown to handle all outstanding promises
(0, http_graceful_shutdown_1.default)(server, {
    signals: "SIGINT SIGTERM",
    timeout: 30000,
    onShutdown: async () => {
        logger_1.logger.info("Gracefully shutting down...");
        // Add any other cleanup code here, if necessary
    },
    finally: () => {
        logger_1.logger.info("Server shutdown complete.");
    }
});
