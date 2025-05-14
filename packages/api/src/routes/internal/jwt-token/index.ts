import Router from "express-promise-router";
import athena from "./athenahealth";
import canvas from "./canvas";
import elation from "./elation";
import healthie from "./healthie";
import eclinicalworks from "./eclinicalworks";

const routes = Router();

// EHRs
routes.use("/athenahealth", athena);
routes.use("/canvas", canvas);
routes.use("/elation", elation);
routes.use("/healthie", healthie);
routes.use("/eclinicalworks", eclinicalworks);

export default routes;
