import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

const ShowWhatsAppByTokenService = async (token: string) => {
  const whatsapp = await Whatsapp.findOne({ where: { token } });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  return whatsapp;
};

export default ShowWhatsAppByTokenService;
