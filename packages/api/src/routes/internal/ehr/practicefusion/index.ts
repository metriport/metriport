import Router from "express-promise-router";
import patient from "./patient";
import practice from "./practice";

const routes = Router();

routes.use("/patient", patient);
routes.use("/practice", practice);

export default routes;
