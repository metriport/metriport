import Router from "express-promise-router";
import patient from "./patient";
import signingKey from "./signing-key";

const routes = Router();

routes.use("/patient", patient);
routes.use("/signing-key", signingKey);

export default routes;
