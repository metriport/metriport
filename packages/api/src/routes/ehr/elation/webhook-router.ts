import Router from "express-promise-router";
import appointmentWebhook from "./appointment-webhook";

const routes = Router();

routes.use("/appointments", appointmentWebhook);

export default routes;
