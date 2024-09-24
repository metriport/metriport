import Router from "express-promise-router";
import appointment from "./appointment";
const routes = Router();

routes.use("/appointment", appointment);

export default routes;
