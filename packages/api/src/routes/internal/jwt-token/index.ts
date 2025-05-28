import Router from "express-promise-router";
import athena from "./athenahealth";
import canvas from "./canvas";
import eclinicalworks from "./eclinicalworks";
import elation from "./elation";
import healthie from "./healthie";
import token from "./token";

const routes = Router();

// Shared
routes.use("/", token);

// EHRs
routes.use("/athenahealth", athena);
routes.use("/canvas", canvas);
routes.use("/elation", elation);
routes.use("/healthie", healthie);
routes.use("/eclinicalworks", eclinicalworks);

export default routes;
