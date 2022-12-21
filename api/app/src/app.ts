import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import cors from "cors";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import { errorHandler } from "./default-error-handler";
import initDB from "./models/db";
import mountRoutes from "./routes/index";

const app: Application = express();
app.use(helmet()); // needs to come before any route declaration, including cors()
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

mountRoutes(app);
module.exports = app;

// route used for health checks
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.use(errorHandler);

app.listen(8080, "0.0.0.0", async () => {
  // initialize connection to the databases
  await initDB();
  console.log(`[server]: API server is running :)`);
});
