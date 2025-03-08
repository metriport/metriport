import Router from "express-promise-router";
import patientWebhook from "./patient-webhook";

const routes = Router();

routes.use("/patient", patientWebhook);

export default routes;
