"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const Whatsapp_1 = __importDefault(require("../models/Whatsapp"));
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public");
exports.default = {
    directory: publicFolder,
    storage: multer_1.default.diskStorage({
        destination: async function (req, file, cb) {
            let companyId;
            if (req.user?.companyId) {
                companyId = req.user.companyId;
            }
            else {
                const authHeader = req.headers.authorization;
                const [, token] = authHeader.split(" ");
                const whatsapp = await Whatsapp_1.default.findOne({ where: { token } });
                companyId = whatsapp.companyId;
            }
            const companyFolder = `${publicFolder}/company${companyId}`;
            // Criar a pasta company{companyId} caso ela não exista
            if (!fs_1.default.existsSync(companyFolder)) {
                fs_1.default.mkdirSync(companyFolder, { recursive: true });
                fs_1.default.chmodSync(companyFolder, 0o777);
            }
            const folder = `${companyFolder}/quick/`;
            // Criar a pasta quick/ caso ela não exista
            if (!fs_1.default.existsSync(folder)) {
                fs_1.default.mkdirSync(folder, { recursive: true });
                fs_1.default.chmodSync(folder, 0o777);
            }
            return cb(null, folder);
        },
        filename(req, file, cb) {
            const fileName = `${new Date().getTime()}_${file.originalname.replace("/", "-")}`;
            return cb(null, fileName);
        }
    })
};
