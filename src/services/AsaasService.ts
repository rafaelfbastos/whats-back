import axios from "axios";
import Setting from "../models/Setting";
import BillingCustomer from "../models/BillingCustomer";
import AppError from "../errors/AppError";

// URLs da API Asaas
const ASAAS_API_URL_PRODUCTION = "https://www.asaas.com/api/v3";
const ASAAS_API_URL_SANDBOX = "https://sandbox.asaas.com/api/v3";

interface CustomerData {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
}

interface PaymentData {
  customerId: string;
  billingType: "PIX" | "BOLETO";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}

interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
}

interface AsaasPaymentResponse {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  description: string;
}

interface AsaasPixQrCodeResponse {
  success: boolean;
  payload: string;
  encodedImage: string;
  expirationDate: string;
}

interface AsaasBoletoResponse {
  identificationField: string;
  nossoNumero: string;
  barCode: string;
}

// Empresa gestora (ID 1) é responsável por todas as cobranças
const COMPANY_GESTORA_ID = 1;

// Verifica se o modo sandbox está ativado
export const isAsaasSandbox = async (): Promise<boolean> => {
  const setting = await Setting.findOne({
    where: {
      key: "asaasSandbox",
      companyId: COMPANY_GESTORA_ID
    }
  });

  return setting?.value === "true" || setting?.value === "enabled";
};

// Retorna a URL da API baseada no modo (sandbox ou produção)
export const getAsaasApiUrl = async (): Promise<string> => {
  const sandbox = await isAsaasSandbox();
  return sandbox ? ASAAS_API_URL_SANDBOX : ASAAS_API_URL_PRODUCTION;
};

export const getAsaasToken = async (): Promise<string> => {
  const sandbox = await isAsaasSandbox();

  // Se sandbox, usa token de sandbox, senão usa token de produção
  const tokenKey = sandbox ? "asaasTokenSandbox" : "asaas";

  const setting = await Setting.findOne({
    where: {
      key: tokenKey,
      companyId: COMPANY_GESTORA_ID
    }
  });

  if (!setting || !setting.value) {
    const mode = sandbox ? "sandbox" : "produção";
    throw new AppError(`Token Asaas (${mode}) não configurado na empresa gestora`, 400);
  }

  return setting.value;
};

export const findCustomerByCpfCnpj = async (
  token: string,
  cpfCnpj: string
): Promise<AsaasCustomerResponse | null> => {
  try {
    const apiUrl = await getAsaasApiUrl();
    const response = await axios.get(`${apiUrl}/customers`, {
      params: { cpfCnpj },
      headers: {
        "Content-Type": "application/json",
        access_token: token
      }
    });

    if (response.data.totalCount > 0) {
      return response.data.data[0];
    }

    return null;
  } catch (error) {
    console.error("Erro ao buscar cliente no Asaas:", error);
    return null;
  }
};

export const createCustomer = async (
  token: string,
  data: CustomerData
): Promise<AsaasCustomerResponse> => {
  try {
    const apiUrl = await getAsaasApiUrl();
    const response = await axios.post(
      `${apiUrl}/customers`,
      {
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj.replace(/[^\d]/g, ""),
        phone: data.phone,
        address: data.address,
        province: data.city,
        postalCode: data.zipcode
      },
      {
        headers: {
          "Content-Type": "application/json",
          access_token: token
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao criar cliente no Asaas:", error.response?.data || error);
    throw new AppError(
      error.response?.data?.errors?.[0]?.description || "Erro ao criar cliente no Asaas",
      400
    );
  }
};

export const findOrCreateCustomer = async (
  companyId: number,
  data: CustomerData
): Promise<{ billingCustomer: BillingCustomer; asaasCustomerId: string }> => {
  const token = await getAsaasToken();

  // Verifica se já existe BillingCustomer local
  let billingCustomer = await BillingCustomer.findOne({
    where: { companyId }
  });

  if (billingCustomer && billingCustomer.asaasCustomerId) {
    return {
      billingCustomer,
      asaasCustomerId: billingCustomer.asaasCustomerId
    };
  }

  // Busca ou cria no Asaas
  let asaasCustomer = await findCustomerByCpfCnpj(token, data.cpfCnpj);

  if (!asaasCustomer) {
    asaasCustomer = await createCustomer(token, data);
  }

  // Cria ou atualiza BillingCustomer local
  if (billingCustomer) {
    await billingCustomer.update({
      ...data,
      asaasCustomerId: asaasCustomer.id
    });
  } else {
    billingCustomer = await BillingCustomer.create({
      companyId,
      ...data,
      asaasCustomerId: asaasCustomer.id
    });
  }

  return {
    billingCustomer,
    asaasCustomerId: asaasCustomer.id
  };
};

export const createPayment = async (
  data: PaymentData
): Promise<AsaasPaymentResponse> => {
  const token = await getAsaasToken();
  const apiUrl = await getAsaasApiUrl();

  try {
    const response = await axios.post(
      `${apiUrl}/payments`,
      {
        customer: data.customerId,
        billingType: data.billingType,
        value: data.value,
        dueDate: data.dueDate,
        description: data.description,
        externalReference: data.externalReference
      },
      {
        headers: {
          "Content-Type": "application/json",
          access_token: token
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao criar cobrança no Asaas:", error.response?.data || error);
    throw new AppError(
      error.response?.data?.errors?.[0]?.description || "Erro ao criar cobrança no Asaas",
      400
    );
  }
};

export const getPixQrCode = async (
  paymentId: string
): Promise<AsaasPixQrCodeResponse> => {
  const token = await getAsaasToken();
  const apiUrl = await getAsaasApiUrl();

  try {
    const response = await axios.get(
      `${apiUrl}/payments/${paymentId}/pixQrCode`,
      {
        headers: {
          "Content-Type": "application/json",
          access_token: token
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao obter QR Code PIX:", error.response?.data || error);
    throw new AppError(
      error.response?.data?.errors?.[0]?.description || "Erro ao obter QR Code PIX",
      400
    );
  }
};

export const getBoletoBarcode = async (
  paymentId: string
): Promise<AsaasBoletoResponse | null> => {
  const token = await getAsaasToken();
  const apiUrl = await getAsaasApiUrl();

  try {
    const response = await axios.get(
      `${apiUrl}/payments/${paymentId}/identificationField`,
      {
        headers: {
          "Content-Type": "application/json",
          access_token: token
        }
      }
    );

    return response.data;
  } catch (error: any) {
    // Boleto pode não estar disponível ainda
    if (error.response?.data?.errors?.[0]?.code === "invalid_action") {
      return null;
    }
    console.error("Erro ao obter código de barras:", error.response?.data || error);
    return null;
  }
};

export const getPaymentById = async (
  paymentId: string
): Promise<AsaasPaymentResponse | null> => {
  const token = await getAsaasToken();
  const apiUrl = await getAsaasApiUrl();

  try {
    const response = await axios.get(
      `${apiUrl}/payments/${paymentId}`,
      {
        headers: {
          "Content-Type": "application/json",
          access_token: token
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Erro ao buscar pagamento:", error.response?.data || error);
    return null;
  }
};

export const getBillingCustomerByCompanyId = async (
  companyId: number
): Promise<BillingCustomer | null> => {
  return BillingCustomer.findOne({
    where: { companyId }
  });
};
