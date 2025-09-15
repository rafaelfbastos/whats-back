"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContactVcard = exports.upload = exports.list = exports.remove = exports.update = exports.show = exports.store = exports.getContact = exports.index = void 0;
const Yup = __importStar(require("yup"));
const socket_1 = require("../libs/socket");
const Contact_1 = __importDefault(require("../models/Contact"));
const ListContactsService_1 = __importDefault(require("../services/ContactServices/ListContactsService"));
const CreateContactService_1 = __importDefault(require("../services/ContactServices/CreateContactService"));
const ShowContactService_1 = __importDefault(require("../services/ContactServices/ShowContactService"));
const UpdateContactService_1 = __importDefault(require("../services/ContactServices/UpdateContactService"));
const DeleteContactService_1 = __importDefault(require("../services/ContactServices/DeleteContactService"));
const GetContactService_1 = __importDefault(require("../services/ContactServices/GetContactService"));
const CheckNumber_1 = __importDefault(require("../services/WbotServices/CheckNumber"));
const CheckIsValidContact_1 = __importDefault(require("../services/WbotServices/CheckIsValidContact"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const SimpleListService_1 = __importDefault(require("../services/ContactServices/SimpleListService"));
const lodash_1 = require("lodash");
const ImportContacts_1 = require("../services/ContactServices/ImportContacts");
const index = async (req, res) => {
    const { searchParam, pageNumber } = req.query;
    const { companyId } = req.user;
    const { contacts, count, hasMore } = await (0, ListContactsService_1.default)({
        searchParam,
        pageNumber,
        companyId
    });
    return res.json({ contacts, count, hasMore });
};
exports.index = index;
const getContact = async (req, res) => {
    const { name, number } = req.body;
    const { companyId } = req.user;
    const contact = await (0, GetContactService_1.default)({
        name,
        number,
        companyId
    });
    return res.status(200).json(contact);
};
exports.getContact = getContact;
const store = async (req, res) => {
    const { companyId } = req.user;
    const newContact = req.body;
    newContact.number = newContact.number.replace("-", "").replace(" ", "");
    const schema = Yup.object().shape({
        name: Yup.string().required(),
        number: Yup.string()
            .required()
            .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
    });
    try {
        await schema.validate(newContact);
    }
    catch (err) {
        throw new AppError_1.default(err.message);
    }
    await (0, CheckIsValidContact_1.default)(newContact.number, companyId);
    const validNumber = await (0, CheckNumber_1.default)(newContact.number, companyId);
    const number = validNumber.jid.replace(/\D/g, "");
    newContact.number = number;
    // Check if the contact already exists
    const existingContact = await Contact_1.default.findOne({
        where: {
            number: newContact.number,
            companyId
        }
    });
    if (existingContact) {
        // Contact already exists, send the existing contact data as the response
        return res.status(200).json({ alreadyExists: true, existingContact });
    }
    /**
     * Código desabilitado por demora no retorno
     */
    // const profilePicUrl = await GetProfilePicUrl(validNumber.jid, companyId);
    const contact = await (0, CreateContactService_1.default)({
        ...newContact,
        // profilePicUrl,
        companyId
    });
    const io = (0, socket_1.getIO)();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
        action: "create",
        contact
    });
    return res.status(200).json(contact);
};
exports.store = store;
const show = async (req, res) => {
    const { contactId } = req.params;
    const { companyId } = req.user;
    const contact = await (0, ShowContactService_1.default)(contactId, companyId);
    return res.status(200).json(contact);
};
exports.show = show;
const update = async (req, res) => {
    const contactData = req.body;
    const { companyId } = req.user;
    const schema = Yup.object().shape({
        name: Yup.string(),
        number: Yup.string().matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
    });
    try {
        await schema.validate(contactData);
    }
    catch (err) {
        throw new AppError_1.default(err.message);
    }
    await (0, CheckIsValidContact_1.default)(contactData.number, companyId);
    const validNumber = await (0, CheckNumber_1.default)(contactData.number, companyId);
    const number = validNumber.jid.replace(/\D/g, "");
    contactData.number = number;
    const { contactId } = req.params;
    const contact = await (0, UpdateContactService_1.default)({
        contactData,
        contactId,
        companyId
    });
    const io = (0, socket_1.getIO)();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
        action: "update",
        contact
    });
    return res.status(200).json(contact);
};
exports.update = update;
const remove = async (req, res) => {
    const { contactId } = req.params;
    const { companyId } = req.user;
    await (0, ShowContactService_1.default)(contactId, companyId);
    await (0, DeleteContactService_1.default)(contactId);
    const io = (0, socket_1.getIO)();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
        action: "delete",
        contactId
    });
    return res.status(200).json({ message: "Contact deleted" });
};
exports.remove = remove;
const list = async (req, res) => {
    const { name } = req.query;
    const { companyId } = req.user;
    const contacts = await (0, SimpleListService_1.default)({ name, companyId });
    return res.json(contacts);
};
exports.list = list;
const upload = async (req, res) => {
    const files = req.files;
    const file = (0, lodash_1.head)(files);
    const { companyId } = req.user;
    const response = await (0, ImportContacts_1.ImportContacts)(companyId, file);
    const io = (0, socket_1.getIO)();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
        action: "create",
        records: response
    });
    return res.status(200).json(response);
};
exports.upload = upload;
const getContactVcard = async (req, res) => {
    const { name, number } = req.query;
    const { companyId } = req.user;
    let vNumber = number;
    const numberDDI = vNumber.toString().substr(0, 2);
    const numberDDD = vNumber.toString().substr(2, 2);
    const numberUser = vNumber.toString().substr(-8, 8);
    if (numberDDD <= '30' && numberDDI === '55') {
        console.log("menor 30");
        vNumber = `${numberDDI + numberDDD + 9 + numberUser}@s.whatsapp.net`;
    }
    else if (numberDDD > '30' && numberDDI === '55') {
        console.log("maior 30");
        vNumber = `${numberDDI + numberDDD + numberUser}@s.whatsapp.net`;
    }
    else {
        vNumber = `${number}@s.whatsapp.net`;
    }
    console.log(vNumber);
    const contact = await (0, GetContactService_1.default)({
        name,
        number,
        companyId
    });
    return res.status(200).json(contact);
};
exports.getContactVcard = getContactVcard;
