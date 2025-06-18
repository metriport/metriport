import Router from "express-promise-router";
import medical from "./index";
import tcmEncounter from "./tcm-encounter";

const routes = Router();

// Include all regular medical routes
routes.get("/", (req, res) => {
  res.json({ message: "Hello world" });
});
routes.use("/", medical);

// Mount TCM encounter routes under /tcm
routes.use("/tcm/encounter", tcmEncounter);

export default routes;
