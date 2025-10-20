import Router from "express-promise-router";
import appointmentWebhook from "../appointment-webhook";
import patientWebhook from "../patient-webhook";

const routes = Router();

routes.use("/appointment", appointmentWebhook);
routes.use("/patient", patientWebhook);

export default routes;
