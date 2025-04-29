import Router from "express-promise-router";
import appointmentWebhook from "../appointment-webhook";
import patientWebhook from "../patient-webhook";

const routes = Router();

routes.use("/:practiceId/appointment", appointmentWebhook);
routes.use("/:practiceId/patient", patientWebhook);

export default routes;
