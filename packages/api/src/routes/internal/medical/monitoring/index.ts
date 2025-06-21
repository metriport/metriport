import Router from "express-promise-router";
import dischargeRequery from "./discharge-requery";

const routes = Router();

routes.use("/job/discharge-requery/", dischargeRequery);

export default routes;
