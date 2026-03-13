import express from "express";
import isAuth from "../middleware/isAuth";

import * as ReportsController from "../controllers/ReportsController";

const routes = express.Router();

routes.get("/reports/appointmentsAtendent", isAuth, ReportsController.appointmentsAtendent);
routes.get("/reports/rushHour", isAuth, ReportsController.rushHour);
routes.get("/reports/departamentRatings", isAuth, ReportsController.departamentRatings);
routes.get("/ticket/reports", isAuth, ReportsController.ticketReports);

export default routes;
