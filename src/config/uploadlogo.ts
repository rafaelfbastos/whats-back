import path from "path";
import multer from "multer";

const publicFolder = path.resolve(__dirname, "..", "..", "public/logotipos");

export default {
  directory: publicFolder,
  
  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      // Normalize the expected logo reference and fix common typo
      const rawRef = String(req.query.ref || "");
      // Prevent path traversal and keep only the base name
      const safeRef = path.parse(rawRef).name;

      // Fix known misspelling used by the frontend when toggling dark mode
      const normalizedRef = safeRef === "lofo_w" ? "logo_w" : safeRef;

      // Fallback to a default name if empty
      const baseName = normalizedRef || "logo";

      const desiredFileName = `${baseName}${path.extname(file.originalname)}`;
      return cb(null, desiredFileName);
    }
  })
};
