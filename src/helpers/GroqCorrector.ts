import request from "request";
import Queue from "../models/Queue";
import ListSettingsServiceOne from "../services/SettingServices/ListSettingsServiceOne";

export async function maybeCorrectPortuguese(
  text: string,
  options: { companyId?: number; queueId?: number | null } = {}
): Promise<string> {
  try {
    const { companyId, queueId } = options;

    // Require queue flag enabled
    if (queueId == null) return text;
    const queue = await Queue.findByPk(queueId);
    if (!queue || (queue as any).useGroqCorrection !== true) return text;

    // Read API key from company setting
    if (!companyId) return text;
    const keySetting = await ListSettingsServiceOne({ companyId, key: "groqApiKey" });
    const apiKey = keySetting?.value;
    if (!apiKey) return text;

    const modelSetting = await ListSettingsServiceOne({ companyId, key: "groqModel" });
    const model = modelSetting?.value || "llama3-8b-8192";

    const payload = {
      model,
      messages: [
        {
          role: "system",
          content:
            "Você corrige apenas erros de português (ortografia, acentuação e gramática) mantendo o sentido, emojis e quebras de linha. Responda somente com o texto corrigido, sem comentários.",
        },
        { role: "user", content: text },
      ],
      temperature: 0,
    } as any;

    const res: any = await new Promise((resolve, reject) => {
      request(
        {
          method: "POST",
          url: "https://api.groq.com/openai/v1/chat/completions",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          timeout: 10000,
        },
        (err, _resp, body) => {
          if (err) return reject(err);
          try {
            const json = JSON.parse(String(body || "{}"));
            return resolve(json);
          } catch (e) {
            return reject(e);
          }
        }
      );
    });

    const content = res?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) return content;
    return text;
  } catch (_e) {
    return text;
  }
}
