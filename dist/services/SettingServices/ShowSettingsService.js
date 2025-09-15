"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../../errors/AppError"));
const Setting_1 = __importDefault(require("../../models/Setting"));
const ShowSettingsService = async ({ settingKey, // Update parameter name to settingKey
companyId }) => {
    const setting = await Setting_1.default.findOne({
        where: { key: settingKey, companyId } // Update key to settingKey
    });
    if (!setting) {
        throw new AppError_1.default("ERR_NO_SETTING_FOUND", 404);
    }
    return setting;
};
exports.default = ShowSettingsService;
