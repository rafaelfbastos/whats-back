import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import Company from "../models/Company";
import Invoices from "../models/Invoices";
import Setting from "../models/Setting";
import { getIO } from "../libs/socket";
import {
  findOrCreateCustomer,
  createPayment,
  getPixQrCode,
  getBoletoBarcode,
  getBillingCustomerByCompanyId,
  getPaymentById
} from "../services/AsaasService";

const COMPANY_GESTORA_ID = 1;
const WEBHOOK_TOKEN_SETTING_KEY = "asaasWebhookToken";
const CONFIRMED_PAYMENT_STATUSES = new Set(["RECEIVED", "CONFIRMED"]);

const getWebhookTokenFromRequest = (req: Request): string | undefined => {
  return (
    req.header("asaas-access-token") ||
    req.header("asaas-webhook-token") ||
    req.header("x-asaas-webhook-token") ||
    req.header("access-token") ||
    undefined
  );
};

const validateWebhookToken = async (req: Request): Promise<void> => {
  const setting = await Setting.findOne({
    where: { key: WEBHOOK_TOKEN_SETTING_KEY, companyId: COMPANY_GESTORA_ID }
  });

  if (!setting?.value) {
    return;
  }

  const providedToken = getWebhookTokenFromRequest(req);
  if (!providedToken || providedToken !== setting.value) {
    throw new AppError("Webhook não autorizado", 401);
  }
};

const markInvoicePaidAndExtendCompany = async (
  invoice: Invoices
): Promise<{ alreadyPaid: boolean; dueDate: string }> => {
  if (invoice.status === "paid") {
    return {
      alreadyPaid: true,
      dueDate: invoice.dueDate
    };
  }

  const companyId = invoice.companyId;
  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("Company não encontrada", 404);
  }

  // Calcula nova data de vencimento (+30 dias)
  const currentDueDate = company.dueDate ? new Date(company.dueDate) : new Date();
  const newDueDate = new Date(Math.max(currentDueDate.getTime(), Date.now()));
  newDueDate.setDate(newDueDate.getDate() + 30);
  const dueDateStr = newDueDate.toISOString().split("T")[0];

  // Atualiza empresa e fatura
  await company.update({ dueDate: dueDateStr });
  await invoice.update({ status: "paid" });

  // Notifica o frontend via WebSocket
  const io = getIO();
  const companyUpdate = await Company.findByPk(companyId);

  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-payment`,
    {
      action: "CONCLUIDA",
      company: companyUpdate
    }
  );

  return { alreadyPaid: false, dueDate: dueDateStr };
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  return res.json({ message: "Asaas subscription service" });
};

export const getCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const billingCustomer = await getBillingCustomerByCompanyId(companyId);

  if (!billingCustomer) {
    return res.json({ exists: false });
  }

  return res.json({
    exists: true,
    customer: {
      name: billingCustomer.name,
      email: billingCustomer.email,
      cpfCnpj: billingCustomer.cpfCnpj,
      phone: billingCustomer.phone
    }
  });
};

export const createSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    paymentMethod: Yup.string().oneOf(["pix", "boleto"]).required(),
    invoiceId: Yup.number().required()
  });

  if (!(await schema.isValid(req.body))) {
    throw new AppError("Dados inválidos", 400);
  }

  const {
    paymentMethod,
    invoiceId,
    // Dados do cliente (só necessários se não existir BillingCustomer)
    customerName,
    customerEmail,
    customerCpfCnpj,
    customerPhone,
    customerAddress,
    customerCity,
    customerState,
    customerZipcode
  } = req.body;

  // Busca a invoice
  const invoice = await Invoices.findByPk(invoiceId);
  if (!invoice) {
    throw new AppError("Fatura não encontrada", 404);
  }
  if (invoice.companyId !== companyId) {
    throw new AppError("Fatura não pertence a esta empresa", 403);
  }
  if (!invoice.value || Number.isNaN(Number(invoice.value))) {
    throw new AppError("Fatura com valor inválido", 400);
  }

  // Verifica se já existe BillingCustomer
  let billingCustomer = await getBillingCustomerByCompanyId(companyId);

  // Se não existe, valida os dados do cliente
  if (!billingCustomer) {
    const customerSchema = Yup.object().shape({
      customerName: Yup.string().required("Nome é obrigatório"),
      customerEmail: Yup.string().email().required("Email é obrigatório"),
      customerCpfCnpj: Yup.string().required("CPF/CNPJ é obrigatório")
    });

    if (!(await customerSchema.isValid(req.body))) {
      throw new AppError("Dados do cliente são obrigatórios para primeira cobrança", 400);
    }
  }

  try {
    // Busca ou cria cliente no Asaas
    const { asaasCustomerId } = await findOrCreateCustomer(companyId, {
      name: customerName || billingCustomer?.name,
      email: customerEmail || billingCustomer?.email,
      cpfCnpj: customerCpfCnpj || billingCustomer?.cpfCnpj,
      phone: customerPhone || billingCustomer?.phone,
      address: customerAddress || billingCustomer?.address,
      city: customerCity || billingCustomer?.city,
      state: customerState || billingCustomer?.state,
      zipcode: customerZipcode || billingCustomer?.zipcode
    });

    // Calcula data de vencimento (3 dias a partir de hoje)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Cria cobrança no Asaas (usando token da empresa gestora)
    const billingType = paymentMethod === "pix" ? "PIX" : "BOLETO";
    const payment = await createPayment({
      customerId: asaasCustomerId,
      billingType,
      value: Number(invoice.value),
      dueDate: dueDateStr,
      description: invoice.detail || `Fatura #${invoiceId}`,
      externalReference: `invoice_${invoiceId}`
    });

    // Atualiza a invoice com dados do Asaas
    const updateData: any = {
      paymentMethod,
      asaasPaymentId: payment.id
    };

    // Se for PIX, obtém QR Code
    if (paymentMethod === "pix") {
      try {
        const pixData = await getPixQrCode(payment.id);
        updateData.pixQrCode = pixData.payload;
      } catch (error) {
        console.error("Erro ao obter QR Code PIX:", error);
      }
    }

    // Se for Boleto, obtém URL e código de barras
    if (paymentMethod === "boleto") {
      updateData.boletoUrl = payment.bankSlipUrl;

      try {
        const boletoData = await getBoletoBarcode(payment.id);
        if (boletoData) {
          updateData.boletoBarcode = boletoData.identificationField;
        }
      } catch (error) {
        console.error("Erro ao obter código de barras:", error);
      }
    }

    await invoice.update(updateData);

    // Retorna dados para o frontend
    return res.json({
      paymentId: payment.id,
      paymentMethod,
      value: payment.value,
      dueDate: payment.dueDate,
      invoiceUrl: payment.invoiceUrl,
      // Dados PIX
      pixQrCode: updateData.pixQrCode || null,
      // Dados Boleto
      boletoUrl: updateData.boletoUrl || payment.bankSlipUrl || null,
      boletoBarcode: updateData.boletoBarcode || null
    });
  } catch (error: any) {
    console.error("Erro ao criar cobrança:", error);
    throw new AppError(error.message || "Erro ao criar cobrança", 400);
  }
};

export const createWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // Webhook do Asaas é configurado pelo painel
  return res.json({ message: "Configure o webhook pelo painel do Asaas" });
};

export const webhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    await validateWebhookToken(req);
  } catch (error: any) {
    return res.status(error.statusCode || 401).json({ error: error.message });
  }

  const { event, payment } = req.body;

  // Eventos de teste
  if (event === "PAYMENT_CREATED" || !event) {
    return res.json({ ok: true });
  }

  // Eventos de pagamento confirmado
  const confirmedEvents = [
    "PAYMENT_RECEIVED",
    "PAYMENT_CONFIRMED"
  ];

  if (confirmedEvents.includes(event) && payment) {
    try {
      const { externalReference, id: paymentId } = payment;

      // Extrai o invoiceId do externalReference (formato: invoice_123)
      let invoiceId: number | null = null;

      if (externalReference && externalReference.startsWith("invoice_")) {
        invoiceId = parseInt(externalReference.replace("invoice_", ""), 10);
      }

      // Tenta buscar pelo asaasPaymentId se não encontrou pelo externalReference
      let invoice: Invoices | null = null;

      if (invoiceId) {
        invoice = await Invoices.findByPk(invoiceId);
      }

      if (!invoice) {
        invoice = await Invoices.findOne({
          where: { asaasPaymentId: paymentId }
        });
      }

      if (!invoice) {
        console.error("Invoice não encontrada para payment:", paymentId);
        return res.json({ ok: true });
      }

      // Confirma status no Asaas antes de atualizar
      const paymentDetails = await getPaymentById(paymentId);
      if (!paymentDetails || !CONFIRMED_PAYMENT_STATUSES.has(paymentDetails.status)) {
        console.warn("Pagamento não confirmado no Asaas:", paymentId);
        return res.json({ ok: true });
      }

      await markInvoicePaidAndExtendCompany(invoice);

      console.log(`Pagamento confirmado: Invoice ${invoice.id}, Company ${invoice.companyId}`);
    } catch (error) {
      console.error("Erro ao processar webhook:", error);
    }
  }

  return res.json({ ok: true });
};

export const reconcilePayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { invoiceId } = req.params;

  const invoice = await Invoices.findByPk(invoiceId);
  if (!invoice) {
    throw new AppError("Fatura não encontrada", 404);
  }
  if (invoice.companyId !== companyId) {
    throw new AppError("Fatura não pertence a esta empresa", 403);
  }
  if (invoice.status === "paid") {
    return res.json({ status: "paid", alreadyPaid: true });
  }
  if (!invoice.asaasPaymentId) {
    throw new AppError("Fatura sem pagamento vinculado", 400);
  }

  const paymentDetails = await getPaymentById(invoice.asaasPaymentId);
  if (!paymentDetails) {
    throw new AppError("Não foi possível consultar o pagamento no Asaas", 502);
  }

  if (!CONFIRMED_PAYMENT_STATUSES.has(paymentDetails.status)) {
    return res.json({ status: paymentDetails.status, confirmed: false });
  }

  const result = await markInvoicePaidAndExtendCompany(invoice);

  return res.json({
    status: "paid",
    confirmed: true,
    alreadyPaid: result.alreadyPaid,
    dueDate: result.dueDate
  });
};
