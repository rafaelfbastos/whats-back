"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.docUpload = exports.certUpload = exports.mediaUpload = exports.show = exports.update = exports.index = void 0;
const socket_1 = require("../libs/socket");
const AppError_1 = __importDefault(require("../errors/AppError"));
const lodash_1 = require("lodash");
const User_1 = __importDefault(require("../models/User"));
const UpdateSettingService_1 = __importDefault(require("../services/SettingServices/UpdateSettingService"));
const ListSettingsService_1 = __importDefault(require("../services/SettingServices/ListSettingsService"));
const ShowSettingsService_1 = __importDefault(require("../services/SettingServices/ShowSettingsService"));
const index = async (req, res) => {
    const { companyId } = req.user;
    //if (req.user.profile !== "admin") {
    //throw new AppError("ERR_NO_PERMISSION", 403);
    //}
    const settings = await (0, ListSettingsService_1.default)({ companyId });
    return res.status(200).json(settings);
};
exports.index = index;
const update = async (req, res) => {
    if (req.user.profile !== "admin") {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    const { settingKey: key } = req.params;
    const { value } = req.body;
    const { companyId } = req.user;
    const setting = await (0, UpdateSettingService_1.default)({
        key,
        value,
        companyId
    });
    const io = (0, socket_1.getIO)();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-settings`, {
        action: "update",
        setting
    });
    return res.status(200).json(setting);
};
exports.update = update;
const show = async (req, res) => {
    //const { companyId } = req.user;
    const companyId = 1;
    const { settingKey } = req.params;
    const retornoData = await (0, ShowSettingsService_1.default)({ settingKey, companyId });
    return res.status(200).json(retornoData);
};
exports.show = show;
const mediaUpload = async (req, res) => {
    const { body } = req.body;
    const { companyId } = req.user;
    const userId = req.user.id;
    const requestUser = await User_1.default.findByPk(userId);
    if (requestUser.super === false) {
        throw new AppError_1.default("você nao tem permissão para esta ação!");
    }
    if (req.user.profile !== "admin") {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    if (companyId !== 1) {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    const files = req.files;
    const file = (0, lodash_1.head)(files);
    console.log(file);
    return res.send({ mensagem: "Arquivo Anexado" });
};
exports.mediaUpload = mediaUpload;
const certUpload = async (req, res) => {
    const { body } = req.body;
    const { companyId } = req.user;
    const userId = req.user.id;
    const requestUser = await User_1.default.findByPk(userId);
    if (requestUser.super === false) {
        throw new AppError_1.default("você nao tem permissão para esta ação!");
    }
    if (req.user.profile !== "admin") {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    if (companyId !== 1) {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    const files = req.files;
    const file = (0, lodash_1.head)(files);
    console.log(file);
    return res.send({ mensagem: "Arquivo Anexado" });
};
exports.certUpload = certUpload;
const docUpload = async (req, res) => {
    const { body } = req.body;
    const { companyId } = req.user;
    const userId = req.user.id;
    const requestUser = await User_1.default.findByPk(userId);
    if (requestUser.super === false) {
        throw new AppError_1.default("você nao tem permissão para esta ação!");
    }
    if (req.user.profile !== "admin") {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    if (companyId !== 1) {
        throw new AppError_1.default("ERR_NO_PERMISSION", 403);
    }
    const files = req.files;
    const file = (0, lodash_1.head)(files);
    console.log(file);
    return res.send({ mensagem: "Arquivo Anexado" });
};
exports.docUpload = docUpload;
