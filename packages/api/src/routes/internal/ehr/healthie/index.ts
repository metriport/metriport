import Router from "express-promise-router";
import patient from "./patient";
import secretKey from "./secret-key";

const routes = Router();

routes.use("/patient", patient);
routes.use("/secret-key", secretKey);

export default routes;
