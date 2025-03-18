import Router from "express-promise-router";
import athena from "./athenahealth";
import canvas from "./canvas";
import elation from "./elation";

const routes = Router();

routes.use("/athenahealth", athena);
routes.use("/elation", elation);
routes.use("/canvas", canvas);

export default routes;
