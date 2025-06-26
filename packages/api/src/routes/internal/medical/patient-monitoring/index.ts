import Router from "express-promise-router";
import dischargeRequery from "./discharge-requery";
import jobRoutes from "./job";

const routes = Router();

routes.use("/job", jobRoutes);
routes.use("/discharge-requery", dischargeRequery);

export default routes;
