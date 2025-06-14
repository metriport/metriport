import { Router } from "express";
import ehr from "./ehr";

const router = Router();

router.use("/", ehr);

export default router;
