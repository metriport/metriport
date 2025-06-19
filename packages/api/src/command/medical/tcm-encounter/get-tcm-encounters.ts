import { Op, WhereOptions } from "sequelize";
import { TcmEncounter } from "../../../domain/medical/tcm-encounter";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { Pagination } from "../../pagination";
import { buildDayjs } from "@metriport/shared/common/date";

/**
 * Add a default filter date far in the past to guarantee hitting the compound index
 */
const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

export type GetTcmEncountersCmd = {
  cxId: string;
  after?: string;
  pagination: Pagination;
};

export type CountTcmEncountersCmd = {
  cxId: string;
  after?: string;
};

type TcmEncounterForDisplay = TcmEncounter & {
  patientName: string;
};

export async function getTcmEncounters({ cxId, after, pagination }: GetTcmEncountersCmd): Promise<{
  items: TcmEncounterForDisplay[];
}> {
  const where: WhereOptions<TcmEncounterModel> = {
    cxId,
    admitTime: {
      [Op.gt]: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE,
    },
  };

  const rows = await TcmEncounterModel.findAll({
    where,
    include: [
      {
        model: PatientModel,
        as: "PatientModel",
        attributes: ["id", "cxId", "data"],
      },
    ],
    limit: pagination.count + 1, // Get one extra to determine if there's a next page
    order: [["admitTime", "DESC"]],
  });

  const items = rows.map((row: TcmEncounterModel) => {
    const patient = (row.get("PatientModel") as PatientModel).dataValues.data;

    /** Hack to get around Sequelize type inference not seeing associations */
    const encounterData = { ...row.dataValues, PatientModel: undefined };
    delete encounterData.PatientModel;

    return {
      ...encounterData,
      patientName: patient.firstName + " " + patient.lastName,
      patientDateOfBirth: patient.dob,
      patientPhoneNumbers: patient.contact?.map(contact => contact.phone) ?? [],
      patientStates: patient.address?.map(address => address.state) ?? [],
    };
  });

  return {
    items,
  };
}

export async function getTcmEncountersCount({ cxId, after }: CountTcmEncountersCmd): Promise<{
  totalCount: number;
}> {
  const where: WhereOptions<TcmEncounterModel> = {
    cxId,
    admitTime: {
      [Op.gt]: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE,
    },
  };

  const count = await TcmEncounterModel.count({
    where,
  });

  return {
    totalCount: count,
  };
}
