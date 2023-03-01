import Router from "express-promise-router";
import facility from "./facility";
import organization from "./organization";
import patient from "./patient";
import link from "./link";
import document from "./document";

const routes = Router();

routes.use("/facility", facility);
routes.use("/organization", organization);
routes.use("/patient", patient);
routes.use("/link", link);
routes.use("/document", document);

export default routes;
