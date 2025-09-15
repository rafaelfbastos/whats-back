"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Plan_1 = __importDefault(require("../../models/Plan"));
const FindAllPlanServiceRegister = async () => {
    const plans = await Plan_1.default.findAll({
        where: {
            useInternal: true
        },
        order: [["name", "ASC"]]
    });
    return plans;
};
exports.default = FindAllPlanServiceRegister;
