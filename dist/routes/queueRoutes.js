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
const express_1 = require("express");
const isAuth_1 = __importDefault(require("../middleware/isAuth"));
const multer_1 = __importDefault(require("multer"));
const upload_1 = __importDefault(require("../config/upload"));
const upload = (0, multer_1.default)(upload_1.default);
const QueueController = __importStar(require("../controllers/QueueController"));
const queueRoutes = (0, express_1.Router)();
queueRoutes.get("/queue", isAuth_1.default, QueueController.index);
queueRoutes.post("/queue", isAuth_1.default, QueueController.store);
queueRoutes.get("/queue/:queueId", isAuth_1.default, QueueController.show);
queueRoutes.put("/queue/:queueId", isAuth_1.default, QueueController.update);
queueRoutes.delete("/queue/:queueId", isAuth_1.default, QueueController.remove);
queueRoutes.post("/queue/:queueId/media-upload", isAuth_1.default, upload.array("file"), QueueController.mediaUpload);
queueRoutes.delete("/queue/:queueId/media-upload", isAuth_1.default, QueueController.deleteMedia);
exports.default = queueRoutes;
