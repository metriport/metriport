import Router from "express-promise-router";
import athena from "./athenahealth";
import canvas from "./canvas";
import eclinicalworks from "./eclinicalworks";
import elation from "./elation";
import healthie from "./healthie";
import token from "./token";

const routes = Router();

// EHRs
routes.use("/athenahealth", athena);
routes.use("/canvas", canvas);
routes.use("/elation", elation);
routes.use("/healthie", healthie);
routes.use("/eclinicalworks", eclinicalworks);

// Shared -- MUST GO LAST
routes.use("/", token);

export default routes;
