import Router from "express-promise-router";
import oauth2 from "./oauth2";

const routes = Router();

routes.use("/oauth2", oauth2);

export default routes;
