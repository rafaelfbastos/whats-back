"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBodyButton = exports.getAd = exports.getViewOnceMessage = exports.getCallMessage = exports.getGroupInviteMessage = exports.getPaymentMessage = exports.getTemplateMessage = exports.getStickerMessage = exports.getReactionMessage = exports.getListMessage = exports.getButtonsMessage = exports.getContactMessage = exports.getLocationMessage = exports.getDocumentMessage = exports.getAudioMessage = exports.getVideoMessage = exports.getImageMessage = exports.getTextMessage = void 0;
// Função para extrair informações de mensagens de texto
const getTextMessage = (msg) => {
    return msg.message?.conversation;
};
exports.getTextMessage = getTextMessage;
// Função para extrair informações de mensagens de imagem
const getImageMessage = (msg) => {
    return msg.message?.imageMessage?.caption || "Imagem";
};
exports.getImageMessage = getImageMessage;
// Função para extrair informações de mensagens de vídeo
const getVideoMessage = (msg) => {
    return msg.message?.videoMessage?.caption || "Vídeo";
};
exports.getVideoMessage = getVideoMessage;
// Função para extrair informações de mensagens de áudio
const getAudioMessage = (msg) => {
    return "Áudio";
};
exports.getAudioMessage = getAudioMessage;
// Função para extrair informações de mensagens de documento
const getDocumentMessage = (msg) => {
    return msg.message?.documentMessage?.fileName || "Documento";
};
exports.getDocumentMessage = getDocumentMessage;
// Função para extrair informações de mensagens de localização
const getLocationMessage = (msg) => {
    return {
        latitude: msg.message?.locationMessage?.degreesLatitude,
        longitude: msg.message?.locationMessage?.degreesLongitude
    };
};
exports.getLocationMessage = getLocationMessage;
// Função para extrair informações de mensagens de contato
const getContactMessage = (msg) => {
    return msg.message?.contactMessage?.displayName;
};
exports.getContactMessage = getContactMessage;
// Função para extrair informações de mensagens de botão
const getButtonsMessage = (msg) => {
    return msg.message?.buttonsResponseMessage?.selectedButtonId;
};
exports.getButtonsMessage = getButtonsMessage;
// Função para extrair informações de mensagens de lista
const getListMessage = (msg) => {
    return msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
};
exports.getListMessage = getListMessage;
// Função para extrair informações de mensagens de reação
const getReactionMessage = (msg) => {
    return msg.message?.reactionMessage?.text;
};
exports.getReactionMessage = getReactionMessage;
// Função para extrair informações de mensagens de adesivo (sticker)
const getStickerMessage = (msg) => {
    return msg.message?.stickerMessage;
};
exports.getStickerMessage = getStickerMessage;
// Função para extrair informações de mensagens de modelo (template)
const getTemplateMessage = (msg) => {
    return msg.message?.templateMessage?.hydratedTemplate?.hydratedContentText;
};
exports.getTemplateMessage = getTemplateMessage;
// Função para extrair informações de mensagens de pagamento
const getPaymentMessage = (msg) => {
    return msg.message?.sendPaymentMessage?.noteMessage;
};
exports.getPaymentMessage = getPaymentMessage;
// Função para extrair informações de mensagens de convite de grupo
const getGroupInviteMessage = (msg) => {
    return msg.message?.groupInviteMessage?.groupName;
};
exports.getGroupInviteMessage = getGroupInviteMessage;
// Função para extrair informações de mensagens de chamada
const getCallMessage = (msg) => {
    return msg.message?.bcallMessage?.sessionId;
};
exports.getCallMessage = getCallMessage;
const getViewOnceMessage = (msg) => {
    if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText) {
        let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;
        for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage?.buttons) {
            bodyMessage += `\n\n${buton.buttonText?.displayText}`;
        }
        return bodyMessage;
    }
    if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
        let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
        for (const buton of msg.message?.viewOnceMessage?.message?.listMessage?.sections) {
            for (const rows of buton.rows) {
                bodyMessage += `\n\n${rows.title}`;
            }
        }
        return bodyMessage;
    }
};
exports.getViewOnceMessage = getViewOnceMessage;
const getAd = (msg) => {
    if (msg.key.fromMe && msg.message?.listResponseMessage?.contextInfo?.externalAdReply) {
        let bodyMessage = `*${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.title}*`;
        bodyMessage += `\n\n${msg.message?.listResponseMessage?.contextInfo?.externalAdReply?.body}`;
        return bodyMessage;
    }
};
exports.getAd = getAd;
const getBodyButton = (msg) => {
    if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText) {
        let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.buttonsMessage?.contentText}*`;
        for (const buton of msg.message?.viewOnceMessage?.message?.buttonsMessage?.buttons) {
            bodyMessage += `\n\n${buton.buttonText?.displayText}`;
        }
        return bodyMessage;
    }
    if (msg.key.fromMe && msg?.message?.viewOnceMessage?.message?.listMessage) {
        let bodyMessage = `*${msg?.message?.viewOnceMessage?.message?.listMessage?.description}*`;
        for (const buton of msg.message?.viewOnceMessage?.message?.listMessage?.sections) {
            for (const rows of buton.rows) {
                bodyMessage += `\n\n${rows.title}`;
            }
        }
        return bodyMessage;
    }
};
exports.getBodyButton = getBodyButton;
