import Router from "express-promise-router";
import appointmentWebhook from "../appointment-webhook";
import patientWebhook from "../patient-webhook";

const routes = Router();

routes.use("/appointments", appointmentWebhook);
routes.use("/patients", patientWebhook);

export default routes;
