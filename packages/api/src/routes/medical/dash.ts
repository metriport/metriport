import Router from "express-promise-router";
import medical from "./index";
import tcmEncounter from "./tcm-encounter";
import inference from "./inference";

const routes = Router();

routes.use("/", medical);
routes.use("/tcm/encounter", tcmEncounter);
routes.use("/inference", inference);

export default routes;
