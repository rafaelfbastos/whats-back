const getNumberFromJid = (jid: string): string => {
  if (!jid) {
    return "";
  }

  const [localPart] = jid.split("@");
  const [withoutDevice] = localPart.split(":");

  return withoutDevice.replace(/\D/g, "");
};

export default getNumberFromJid;
