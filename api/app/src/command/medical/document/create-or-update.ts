import { Transaction } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import {
  DocumentReference,
  DocumentReferenceCreate,
} from "../../../domain/medical/document-reference";
import { MedicalDataSource } from "../../../external";
import { DocumentReferenceModel } from "../../../models/medical/document-reference";
import { Patient } from "../../../models/medical/patient";

export async function createOrUpdate(
  patient: Patient,
  docs: DocumentReferenceCreate[]
): Promise<DocumentReference[]> {
  const documents = await Promise.all(
    docs.map(async doc => {
      const sequelize = DocumentReferenceModel.sequelize;
      if (!sequelize) throw new Error("Missing sequelize");
      let transaction: Transaction | undefined = await sequelize.transaction();
      try {
        const existing = await DocumentReferenceModel.findOne({
          where: {
            cxId: patient.cxId,
            patientId: patient.id,
            source: doc.source,
            externalId: doc.externalId,
          },
          lock: true,
          transaction,
        });
        if (existing) {
          return await existing.update(
            {
              data: {
                ...existing.data,
                ...doc.data,
              },
              raw: doc.raw,
            },
            { transaction }
          );
        } else {
          return await DocumentReferenceModel.create(
            {
              id: uuidv4(),
              cxId: patient.cxId,
              patientId: patient.id,
              source: MedicalDataSource.COMMONWELL,
              externalId: doc.externalId,
              data: doc.data,
              raw: doc.raw,
            },
            { transaction }
          );
        }
      } catch (err) {
        await transaction.rollback();
        transaction = undefined;
        throw err;
      } finally {
        if (transaction) await transaction.commit();
      }
    })
  );
  return documents;
}
