"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const publicFolder = path_1.default.resolve(__dirname, "..", "..", "public/logotipos");
exports.default = {
    directory: publicFolder,
    storage: multer_1.default.diskStorage({
        destination: publicFolder,
        filename(req, file, cb) {
            // Normalize the expected logo reference and fix common typo
            const rawRef = String(req.query.ref || "");
            // Prevent path traversal and keep only the base name
            const safeRef = path_1.default.parse(rawRef).name;
            // Fix known misspelling used by the frontend when toggling dark mode
            const normalizedRef = safeRef === "lofo_w" ? "logo_w" : safeRef;
            // Fallback to a default name if empty
            const baseName = normalizedRef || "logo";
            const desiredFileName = `${baseName}${path_1.default.extname(file.originalname)}`;
            return cb(null, desiredFileName);
        }
    })
};
