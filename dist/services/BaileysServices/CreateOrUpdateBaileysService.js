"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const Baileys_1 = __importDefault(require("../../models/Baileys"));
const createOrUpdateBaileysService = async ({ whatsappId, contacts }) => {
    const baileysExists = await Baileys_1.default.findOne({
        where: { whatsappId }
    });
    if (!contacts) {
        return baileysExists;
    }
    if (baileysExists) {
        const getContacts = [];
        const baileysContacts = baileysExists.contacts
            ? JSON.parse(baileysExists.contacts)
            : [];
        if ((0, lodash_1.isArray)(baileysContacts)) {
            getContacts.push(...baileysContacts);
        }
        getContacts.push(...contacts);
        getContacts.sort();
        getContacts.filter((v, i, a) => a.indexOf(v) === i);
        const newBaileys = await baileysExists.update({
            contacts: JSON.stringify(getContacts)
        });
        return newBaileys;
    }
    const baileys = await Baileys_1.default.create({
        whatsappId,
        contacts: JSON.stringify(contacts)
    });
    return baileys;
};
exports.default = createOrUpdateBaileysService;
