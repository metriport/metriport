import Router from "express-promise-router";
import medical from "./index";
import tcmEncounter from "./tcm-encounter";

const routes = Router();

routes.use("/", medical);
routes.use("/tcm/encounter", tcmEncounter);

export default routes;
