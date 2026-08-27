import Router from "express-promise-router";
import patient from "./patient";
import setup from "./setup";

const routes = Router();

routes.use("/patient", patient);
routes.use("/setup", setup);

export default routes;
