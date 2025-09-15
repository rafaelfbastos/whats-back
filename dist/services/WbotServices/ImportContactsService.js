"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GetDefaultWhatsApp_1 = __importDefault(require("../../helpers/GetDefaultWhatsApp"));
const wbot_1 = require("../../libs/wbot");
const Contact_1 = __importDefault(require("../../models/Contact"));
const logger_1 = require("../../utils/logger");
const ShowBaileysService_1 = __importDefault(require("../BaileysServices/ShowBaileysService"));
const CreateContactService_1 = __importDefault(require("../ContactServices/CreateContactService"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const ImportContactsService = async (companyId) => {
    const defaultWhatsapp = await (0, GetDefaultWhatsApp_1.default)(companyId);
    const wbot = (0, wbot_1.getWbot)(defaultWhatsapp.id);
    const baileys = await (0, ShowBaileysService_1.default)(wbot.id);
    let phoneContactsList = null;
    try {
        phoneContactsList = baileys.contacts && JSON.parse(baileys.contacts);
    }
    catch (error) {
        logger_1.logger.warn({ baileys }, `Could not get whatsapp contacts from database. Err: ${error}`);
        throw new AppError_1.default("Could not get whatsapp contacts from database.", 500);
    }
    if (Array.isArray(phoneContactsList)) {
        const processContacts = async (contactsList) => {
            contactsList.forEach(async ({ id, name, notify }) => {
                if (id === "status@broadcast" || id.includes("g.us"))
                    return;
                const number = id.replace(/\D/g, "");
                const existingContact = await Contact_1.default.findOne({
                    where: { number, companyId }
                });
                if (existingContact) {
                    // Atualiza o nome do contato existente
                    existingContact.name = name || notify || number;
                    await existingContact.save();
                }
                else {
                    // Criar um novo contato
                    try {
                        await (0, CreateContactService_1.default)({
                            number,
                            name: name || notify || number,
                            companyId
                        });
                    }
                    catch (error) {
                        logger_1.logger.error({ name, number, companyId }, `Could not save contact. Err: ${error}`);
                    }
                }
            });
        };
        processContacts(phoneContactsList).then(() => {
            logger_1.logger.debug(`Contacts imported successfully from WhatsApp for company ID: ${companyId}`);
        }, error => {
            logger_1.logger.error(`Error importing contacts from WhatsApp for company ID: ${companyId} - ${error.message}`);
        });
    }
};
exports.default = ImportContactsService;
