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
exports.getMessageOptions = void 0;
const Sentry = __importStar(require("@sentry/node"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const GetTicketWbot_1 = __importDefault(require("../../helpers/GetTicketWbot"));
const mime_types_1 = __importDefault(require("mime-types"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "..", "public");
const processAudio = async (audio, companyId) => {
    const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.ogg`;
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`${ffmpeg_static_1.default} -i ${audio} -vn -c:a libopus -b:a 128k ${outputAudio} -y`, (error, _stdout, _stderr) => {
            if (error)
                reject(error);
            fs_1.default.unlinkSync(audio);
            resolve(outputAudio);
        });
    });
};
const processAudioFile = async (audio, companyId) => {
    const outputAudio = `${publicFolder}/company${companyId}/${new Date().getTime()}.mp3`;
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`${ffmpeg_static_1.default} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`, (error, _stdout, _stderr) => {
            if (error)
                reject(error);
            fs_1.default.unlinkSync(audio);
            resolve(outputAudio);
        });
    });
};
const getMessageOptions = async (fileName, pathMedia, companyId, body = " ") => {
    const mimeType = mime_types_1.default.lookup(pathMedia);
    const typeMessage = mimeType.split("/")[0];
    try {
        if (!mimeType) {
            throw new Error("Invalid mimetype");
        }
        let options;
        if (typeMessage === "video") {
            options = {
                video: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
                fileName: fileName
                // gifPlayback: true
            };
        }
        else if (typeMessage === "audio") {
            const typeAudio = true; //fileName.includes("audio-record-site");
            const convert = await processAudio(pathMedia, companyId);
            if (typeAudio) {
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true, // Certifique-se de que PTT está definido corretamente
                };
            }
            else {
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: typeAudio ? "audio/mp4" : mimeType,
                    ptt: true
                };
            }
        }
        else if (typeMessage === "document") {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else if (typeMessage === "application") {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
                fileName: fileName,
                mimetype: mimeType
            };
        }
        else {
            options = {
                image: fs_1.default.readFileSync(pathMedia),
                caption: body ? body : null,
            };
        }
        return options;
    }
    catch (e) {
        Sentry.captureException(e);
        console.log(e);
        return null;
    }
};
exports.getMessageOptions = getMessageOptions;
const SendWhatsAppMedia = async ({ media, ticket, body, isForwarded = false }) => {
    try {
        const wbot = await (0, GetTicketWbot_1.default)(ticket);
        const companyId = ticket.companyId.toString();
        const pathMedia = media.path;
        const typeMessage = media.mimetype.split("/")[0];
        let options;
        const bodyMessage = (0, Mustache_1.default)(body, ticket.contact);
        if (typeMessage === "video") {
            options = {
                video: fs_1.default.readFileSync(pathMedia),
                caption: body,
                fileName: media.originalname.replace('/', '-')
                // gifPlayback: true
            };
        }
        else if (typeMessage === "audio") {
            const typeAudio = media.originalname.includes("audio-record-site");
            if (typeAudio) {
                const convert = await processAudio(media.path, companyId);
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: typeAudio ? "audio/mp4" : media.mimetype,
                    ptt: true
                };
            }
            else {
                const convert = await processAudioFile(media.path, companyId);
                options = {
                    audio: fs_1.default.readFileSync(convert),
                    mimetype: typeAudio ? "audio/mp4" : media.mimetype
                };
            }
        }
        else if (typeMessage === "document" || typeMessage === "text") {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: body,
                fileName: media.originalname.replace('/', '-'),
                mimetype: media.mimetype
            };
        }
        else if (typeMessage === "application") {
            options = {
                document: fs_1.default.readFileSync(pathMedia),
                caption: body,
                fileName: media.originalname.replace('/', '-'),
                mimetype: media.mimetype
            };
        }
        else {
            options = {
                image: fs_1.default.readFileSync(pathMedia),
                caption: body
            };
        }
        const sentMessage = await wbot.sendMessage(`${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`, {
            ...options
        });
        await ticket.update({ lastMessage: bodyMessage });
        return sentMessage;
    }
    catch (err) {
        Sentry.captureException(err);
        console.log(err);
        throw new AppError_1.default("ERR_SENDING_WAPP_MSG");
    }
};
exports.default = SendWhatsAppMedia;
