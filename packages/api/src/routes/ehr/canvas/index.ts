import Router from "express-promise-router";
import patient from "./patient";
import note from "./note";
import medicalPatient from "../../medical/patient";
import medicalDocument from "../../medical/document";
import settings from "../../settings";

const routes = Router();

routes.use("/patient", patient);
routes.use("/note", note);
routes.use("/medical/v1/patient", medicalPatient);
routes.use("/medical/v1/document", medicalDocument);
routes.use("/settings", settings);

export default routes;
