import Router from "express-promise-router";
import patient from "./patient";
import medicalPatient from "../../medical/patient";
import medicalDocument from "../../medical/document";

const routes = Router();

routes.use("/patient", patient);
routes.use("/medical/v1/patient", medicalPatient);
routes.use("/medical/v1/document", medicalDocument);

export default routes;
