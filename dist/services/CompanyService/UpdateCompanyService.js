"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../../errors/AppError"));
const Company_1 = __importDefault(require("../../models/Company"));
const Setting_1 = __importDefault(require("../../models/Setting"));
const Invoices_1 = __importDefault(require("../../models/Invoices"));
const Plan_1 = __importDefault(require("../../models/Plan"));
const UpdateCompanyService = async (companyData) => {
    const company = await Company_1.default.findByPk(companyData.id);
    const { name, phone, email, status, planId, campaignsEnabled, dueDate, recurrence } = companyData;
    if (!company) {
        throw new AppError_1.default("ERR_NO_COMPANY_FOUND", 404);
    }
    const openInvoices = await Invoices_1.default.findAll({
        where: {
            status: "open",
            companyId: company.id,
        },
    });
    if (openInvoices.length > 1) {
        for (const invoice of openInvoices.slice(1)) {
            await invoice.update({ status: "cancelled" });
        }
    }
    const plan = await Plan_1.default.findByPk(planId);
    if (!plan) {
        throw new Error("Plano Não Encontrado.");
    }
    // 5. Atualizar a única invoice com status "open" existente, baseada no companyId.
    const openInvoice = openInvoices[0];
    if (openInvoice) {
        await openInvoice.update({
            value: plan.value,
            detail: plan.name,
            dueDate: dueDate,
        });
    }
    else {
        throw new Error("Nenhuma fatura em aberto para este cliente!");
    }
    await company.update({
        name,
        phone,
        email,
        status,
        planId,
        dueDate,
        recurrence
    });
    if (companyData.campaignsEnabled !== undefined) {
        const [setting, created] = await Setting_1.default.findOrCreate({
            where: {
                companyId: company.id,
                key: "campaignsEnabled"
            },
            defaults: {
                companyId: company.id,
                key: "campaignsEnabled",
                value: `${campaignsEnabled}`
            }
        });
        if (!created) {
            await setting.update({ value: `${campaignsEnabled}` });
        }
    }
    return company;
};
exports.default = UpdateCompanyService;
