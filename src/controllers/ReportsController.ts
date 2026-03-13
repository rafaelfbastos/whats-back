import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../database";
import AppError from "../errors/AppError";

const parseArrayParam = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getDateRange = (initialDate?: string, finalDate?: string) => {
  if (!initialDate || !finalDate) return null;
  return {
    start: `${initialDate} 00:00:00`,
    end: `${finalDate} 23:59:59`
  };
};

export const appointmentsAtendent = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { initialDate, finalDate } = req.query as {
    initialDate?: string;
    finalDate?: string;
  };
  const { companyId } = req.user;
  const range = getDateRange(initialDate, finalDate);
  if (!range) {
    throw new AppError("Período inválido", 400);
  }

  const appointmentsByAttendents = await sequelize.query(
    `
      select
        u.name as user_name,
        count(t.id)::int as total_tickets
      from "Tickets" t
      left join "Users" u on u.id = t."userId"
      where t."companyId" = ?
        and t."createdAt" between ? and ?
        and u.id is not null
      group by u.name
      order by total_tickets desc
    `,
    {
      replacements: [companyId, range.start, range.end],
      type: QueryTypes.SELECT
    }
  );

  const ticketsByQueues = await sequelize.query(
    `
      select
        coalesce(q.name, 'SEM FILA') as name,
        count(t.id)::int as total_tickets
      from "Tickets" t
      left join "Queues" q on q.id = t."queueId"
      where t."companyId" = ?
        and t."createdAt" between ? and ?
      group by name
      order by total_tickets desc
    `,
    {
      replacements: [companyId, range.start, range.end],
      type: QueryTypes.SELECT
    }
  );

  return res.json({ appointmentsByAttendents, ticketsByQueues });
};

export const rushHour = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { initialDate, finalDate } = req.query as {
    initialDate?: string;
    finalDate?: string;
  };
  const { companyId } = req.user;
  const range = getDateRange(initialDate, finalDate);
  if (!range) {
    throw new AppError("Período inválido", 400);
  }

  const data = await sequelize.query(
    `
      select
        date_part('hour', m."createdAt")::int as message_hour,
        count(*)::int as message_count
      from "Messages" m
      where m."companyId" = ?
        and m."createdAt" between ? and ?
      group by 1
      order by 1
    `,
    {
      replacements: [companyId, range.start, range.end],
      type: QueryTypes.SELECT
    }
  );

  return res.json(data);
};

export const departamentRatings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { initialDate, finalDate } = req.query as {
    initialDate?: string;
    finalDate?: string;
  };
  const { companyId } = req.user;
  const range = getDateRange(initialDate, finalDate);
  if (!range) {
    throw new AppError("Período inválido", 400);
  }

  const data = await sequelize.query(
    `
      select
        coalesce(q.name, 'SEM FILA') as name,
        coalesce(avg(ur.rate), 0)::numeric(10,2) as total_rate
      from "UserRatings" ur
      left join "Tickets" t on t.id = ur."ticketId"
      left join "Queues" q on q.id = t."queueId"
      where ur."companyId" = ?
        and ur."createdAt" between ? and ?
      group by name
      order by total_rate desc
    `,
    {
      replacements: [companyId, range.start, range.end],
      type: QueryTypes.SELECT
    }
  );

  return res.json(data);
};

export const ticketReports = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    searchParam,
    ticketId,
    contactId,
    whatsappId,
    users,
    queueIds,
    status,
    dateFrom,
    dateTo,
    page = "1",
    pageSize = "10"
  } = req.query as any;

  const { companyId } = req.user;
  const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pageNumber - 1) * limit;

  const userIds = parseArrayParam(users).map((id) => Number(id)).filter(Boolean);
  const whatsappIds = parseArrayParam(whatsappId).map((id) => Number(id)).filter(Boolean);
  const queueIdList = parseArrayParam(queueIds).map((id) => Number(id)).filter(Boolean);
  const statusList = parseArrayParam(status).map((s) => String(s)).filter(Boolean);

  let where = `t."companyId" = :companyId`;

  if (ticketId) {
    where += ` and t.id = :ticketId`;
  }

  if (contactId) {
    where += ` and t."contactId" = :contactId`;
  }

  if (whatsappIds.length) {
    where += ` and t."whatsappId" in (:whatsappIds)`;
  }

  if (userIds.length) {
    where += ` and t."userId" in (:userIds)`;
  }

  if (queueIdList.length) {
    where += ` and t."queueId" in (:queueIds)`;
  }

  if (statusList.length) {
    where += ` and t.status in (:statusList)`;
  }

  if (dateFrom && dateTo) {
    where += ` and t."createdAt" between :dateFrom and :dateTo`;
  }

  if (searchParam) {
    where += ` and (
      ct.name ilike :searchParam
      or ct.number ilike :searchParam
      or t."lastMessage" ilike :searchParam
    )`;
  }

  const replacementsNamed: Record<string, any> = {
    companyId,
    ticketId,
    contactId,
    whatsappIds,
    userIds,
    queueIds: queueIdList,
    statusList,
    dateFrom: dateFrom ? `${dateFrom} 00:00:00` : undefined,
    dateTo: dateTo ? `${dateTo} 23:59:59` : undefined,
    searchParam: searchParam ? `%${searchParam}%` : undefined
  };

  const queryBase = `
    from "Tickets" t
    left join "Users" u on u.id = t."userId"
    left join "Contacts" ct on ct.id = t."contactId"
    left join "Queues" q on q.id = t."queueId"
    left join "Whatsapps" w on w.id = t."whatsappId"
    left join lateral (
      select max(tt."finishedAt") as "finishedAt"
      from "TicketTraking" tt
      where tt."ticketId" = t.id
    ) tt on true
    where ${where}
  `;

  const totalTickets = await sequelize.query(
    `
      select count(*)::int as total
      ${queryBase}
    `,
    {
      replacements: replacementsNamed,
      type: QueryTypes.SELECT,
      plain: true
    }
  );

  const tickets = await sequelize.query(
    `
      select
        t.id,
        t.uuid,
        w.name as "whatsappName",
        ct.name as "contactName",
        u.name as "userName",
        coalesce(q.name, 'SEM FILA') as "queueName",
        q.color as "queueColor",
        case
          when t.status = 'open' then 'ABERTO'
          when t.status = 'closed' then 'FECHADO'
          when t.status = 'pending' then 'PENDENTE'
          else upper(t.status)
        end as status,
        t."lastMessage",
        t."createdAt",
        tt."finishedAt" as "closedAt"
      ${queryBase}
      order by t."createdAt" desc
      limit :limit offset :offset
    `,
    {
      replacements: {
        ...replacementsNamed,
        limit,
        offset
      },
      type: QueryTypes.SELECT
    }
  );

  return res.json({ tickets, totalTickets });
};
