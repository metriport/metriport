import Router from "express-promise-router";
import athena from "./athenahealth";
import canvas from "./canvas";
import elation from "./elation";
import healthie from "./healthie";
import { processEhrId } from "./middleware";
import patient from "./patient";
import practice from "./practice";

const routes = Router();

routes.use("/athenahealth", athena);
routes.use("/elation", elation);
routes.use("/canvas", canvas);
routes.use("/healthie", healthie);
routes.use("/:ehrId/patient", processEhrId, patient);
routes.use("/:ehrId/practice", processEhrId, practice);

export default routes;
