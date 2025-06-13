import { Router } from "express";
import dischargeRequery from "./discharge-requery";
import ehr from "./ehr";

const router = Router();

router.use("/", ehr);
router.use("/", dischargeRequery);

export default router;
