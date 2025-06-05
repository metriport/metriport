import Router from "express-promise-router";
import { processEhrId } from "../../middlewares/ehr/middleware";
import ehr from "./ehr";

const routes = Router();

routes.use("/:ehrId", processEhrId, ehr);

export default routes;
