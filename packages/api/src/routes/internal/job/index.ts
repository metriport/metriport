import Router from "express-promise-router";
import patient from "./patient";

const routes = Router();

routes.use("/patient", patient);

export default routes;
