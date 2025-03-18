import Router from "express-promise-router";
import athena from "./athenahealth";
import canvas from "./canvas";
import elation from "./elation";

const routes = Router();

// EHRs
routes.use("/athenahealth", athena);
routes.use("/canvas", canvas);
routes.use("/elation", elation);

export default routes;
