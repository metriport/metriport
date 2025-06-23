import Router from "express-promise-router";
import dischargeRequery from "./discharge-requery";

const routes = Router();

routes.use("/discharge-requery/", dischargeRequery);

export default routes;
