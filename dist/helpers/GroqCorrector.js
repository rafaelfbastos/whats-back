"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeCorrectPortuguese = void 0;
const request_1 = __importDefault(require("request"));
const Queue_1 = __importDefault(require("../models/Queue"));
const ListSettingsServiceOne_1 = __importDefault(require("../services/SettingServices/ListSettingsServiceOne"));
async function maybeCorrectPortuguese(text, options = {}) {
    try {
        const { companyId, queueId } = options;
        // Require queue flag enabled
        if (queueId == null)
            return text;
        const queue = await Queue_1.default.findByPk(queueId);
        if (!queue || queue.useGroqCorrection !== true)
            return text;
        // Read API key from company setting
        if (!companyId)
            return text;
        const keySetting = await (0, ListSettingsServiceOne_1.default)({ companyId, key: "groqApiKey" });
        const apiKey = keySetting?.value;
        if (!apiKey)
            return text;
        const modelSetting = await (0, ListSettingsServiceOne_1.default)({ companyId, key: "groqModel" });
        const model = modelSetting?.value || "llama3-8b-8192";
        const payload = {
            model,
            messages: [
                {
                    role: "system",
                    content: "Você corrige apenas erros de português (ortografia, acentuação e gramática) mantendo o sentido, emojis e quebras de linha. Responda somente com o texto corrigido, sem comentários.",
                },
                { role: "user", content: text },
            ],
            temperature: 0,
        };
        const res = await new Promise((resolve, reject) => {
            (0, request_1.default)({
                method: "POST",
                url: "https://api.groq.com/openai/v1/chat/completions",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                timeout: 10000,
            }, (err, _resp, body) => {
                if (err)
                    return reject(err);
                try {
                    const json = JSON.parse(String(body || "{}"));
                    return resolve(json);
                }
                catch (e) {
                    return reject(e);
                }
            });
        });
        const content = res?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim().length > 0)
            return content;
        return text;
    }
    catch (_e) {
        return text;
    }
}
exports.maybeCorrectPortuguese = maybeCorrectPortuguese;
