import Router from "express-promise-router";
import patient from "./patient";
import workflow from "./workflow";

const routes = Router();

routes.use("/patient", patient);
routes.use("/workflow", workflow);

export default routes;
