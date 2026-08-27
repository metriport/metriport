import { Procedure } from "@medplum/fhirtypes";

/**
 * CPT code ranges for all procedure types
 * modality: https://www.dicomlibrary.com/dicom/modality/
 */
export const PROCEDURE_TYPE_RANGES = [
  // Imaging - X-Ray
  { start: 70010, end: 70390, type: "X-Ray", category: "Head/Neck X-Ray", modality: "DX" },
  { start: 71010, end: 71035, type: "X-Ray", category: "Chest X-Ray", modality: "DX" },
  { start: 72010, end: 72120, type: "X-Ray", category: "Spine X-Ray", modality: "DX" },
  { start: 73000, end: 73140, type: "X-Ray", category: "Upper Extremity X-Ray", modality: "DX" },
  { start: 73500, end: 73660, type: "X-Ray", category: "Lower Extremity X-Ray", modality: "DX" },
  { start: 74018, end: 74022, type: "X-Ray", category: "Abdomen X-Ray", modality: "DX" },

  // Imaging - CT
  { start: 70450, end: 70498, type: "CT", category: "Head/Neck CT", modality: "CT" },
  { start: 71250, end: 71275, type: "CT", category: "Chest CT", modality: "CT" },
  { start: 72125, end: 72133, type: "CT", category: "Spine CT", modality: "CT" },
  { start: 73200, end: 73225, type: "CT", category: "Upper Extremity CT", modality: "CT" },
  { start: 73700, end: 73725, type: "CT", category: "Lower Extremity CT", modality: "CT" },
  { start: 74150, end: 74178, type: "CT", category: "Abdomen/Pelvis CT", modality: "CT" },

  // Imaging - MRI
  { start: 70540, end: 70559, type: "MRI", category: "Head/Neck MRI", modality: "MR" },
  { start: 71550, end: 71555, type: "MRI", category: "Chest MRI", modality: "MR" },
  { start: 72141, end: 72159, type: "MRI", category: "Spine MRI", modality: "MR" },
  { start: 73218, end: 73223, type: "MRI", category: "Upper Extremity MRI", modality: "MR" },
  { start: 73718, end: 73723, type: "MRI", category: "Lower Extremity MRI", modality: "MR" },
  { start: 74181, end: 74185, type: "MRI", category: "Abdomen/Pelvis MRI", modality: "MR" },

  // Imaging - Ultrasound
  { start: 76506, end: 76999, type: "Ultrasound", category: "General Ultrasound", modality: "US" },
  { start: 93303, end: 93355, type: "Ultrasound", category: "Echocardiography", modality: "US" },
  { start: 93880, end: 93998, type: "Ultrasound", category: "Vascular Ultrasound", modality: "US" },

  // Imaging - Mammography
  { start: 77046, end: 77067, type: "Mammography", category: "Breast Imaging", modality: "MG" },

  // Imaging - Bone Densitometry
  { start: 77078, end: 77086, type: "Bone Density", category: "Bone Density", modality: "BMD" },

  // Imaging - Nuclear Medicine/PET
  { start: 78012, end: 78099, type: "Nuclear Medicine", category: "Bone Scan", modality: "NM" },
  {
    start: 78102,
    end: 78199,
    type: "Nuclear Medicine",
    category: "Nuclear Medicine - GI",
    modality: "NM",
  },
  {
    start: 78201,
    end: 78299,
    type: "Nuclear Medicine",
    category: "Nuclear Medicine - GU",
    modality: "NM",
  },
  {
    start: 78300,
    end: 78399,
    type: "Nuclear Medicine",
    category: "Nuclear Medicine - Musculoskeletal",
    modality: "NM",
  },
  {
    start: 78608,
    end: 78650,
    type: "Nuclear Medicine",
    category: "Nuclear Medicine - Cardiac",
    modality: "NM",
  },
  { start: 78414, end: 78499, type: "PET", category: "PET Scan", modality: "PT" },
  { start: 78800, end: 78899, type: "PET", category: "PET - Tumor Imaging", modality: "PT" },

  // Imaging - Fluoroscopy/Angiography
  { start: 75600, end: 75989, type: "Angiography", category: "Vascular Imaging", modality: "XA" },
  {
    start: 36200,
    end: 36299,
    type: "Vascular Injection",
    category: "Vascular Injection",
    modality: "XA",
  },
  {
    start: 93451,
    end: 93533,
    type: "Cardiac Catheterization",
    category: "Cardiac Imaging",
    modality: "XA",
  },

  // Imaging - Ophthalmic
  {
    start: 92133,
    end: 92136,
    type: "Ophthalmic Imaging",
    category: "Ophthalmic OCT",
    modality: "OCT",
  },
  {
    start: 92225,
    end: 92287,
    type: "Ophthalmic Imaging",
    category: "Ophthalmic Imaging",
    modality: "OP",
  },

  // Cardiac Procedures
  { start: 93000, end: 93010, type: "ECG", category: "Electrocardiography", modality: "ECG" },
  {
    start: 93224,
    end: 93278,
    type: "Cardiac Monitor",
    category: "Ambulatory ECG",
    modality: "ECG",
  },
  {
    start: 93561,
    end: 93572,
    type: "Cardiac EP Study",
    category: "Electrophysiology",
    modality: "EPS",
  },

  // Endoscopy
  { start: 43200, end: 43273, type: "Endoscopy", category: "Upper GI Endoscopy", modality: "ES" },
  {
    start: 44360,
    end: 44408,
    type: "Endoscopy",
    category: "Small Bowel Endoscopy",
    modality: "ES",
  },
  { start: 45300, end: 45398, type: "Endoscopy", category: "Colonoscopy", modality: "ES" },
  {
    start: 31231,
    end: 31298,
    type: "Endoscopy",
    category: "Nasal/Sinus Endoscopy",
    modality: "ES",
  },
  {
    start: 43235,
    end: 43259,
    type: "Endoscopy",
    category: "Esophagogastroduodenoscopy",
    modality: "ES",
  },

  // Surgery - General
  { start: 10021, end: 10022, type: "Surgery", category: "Fine Needle Aspiration" },
  { start: 10030, end: 10036, type: "Surgery", category: "Image-guided Procedures" },
  { start: 11000, end: 11047, type: "Surgery", category: "Debridement" },
  { start: 11055, end: 11057, type: "Surgery", category: "Paring/Cutting" },
  { start: 11100, end: 11107, type: "Surgery", category: "Skin Biopsy" },
  { start: 11200, end: 11201, type: "Surgery", category: "Skin Tag Removal" },
  { start: 11400, end: 11471, type: "Surgery", category: "Excision - Benign Lesions" },
  { start: 11600, end: 11646, type: "Surgery", category: "Excision - Malignant Lesions" },
  { start: 12001, end: 12057, type: "Surgery", category: "Simple Repair" },
  { start: 13100, end: 13160, type: "Surgery", category: "Complex Repair" },

  // Surgery - Musculoskeletal
  { start: 20200, end: 20999, type: "Surgery", category: "Musculoskeletal" },
  { start: 21010, end: 21499, type: "Surgery", category: "Head/Skull Surgery" },
  { start: 22010, end: 22899, type: "Surgery", category: "Spine Surgery" },
  { start: 23000, end: 23929, type: "Surgery", category: "Shoulder Surgery" },
  { start: 24000, end: 24999, type: "Surgery", category: "Elbow/Arm Surgery" },
  { start: 25000, end: 25999, type: "Surgery", category: "Forearm/Wrist Surgery" },
  { start: 26010, end: 26989, type: "Surgery", category: "Hand Surgery" },
  { start: 27000, end: 27299, type: "Surgery", category: "Hip/Pelvis Surgery" },
  { start: 27301, end: 27599, type: "Surgery", category: "Thigh/Knee Surgery" },
  { start: 27600, end: 27899, type: "Surgery", category: "Leg/Ankle Surgery" },
  { start: 28001, end: 28899, type: "Surgery", category: "Foot Surgery" },

  // Surgery - Respiratory
  { start: 30000, end: 30999, type: "Surgery", category: "Nose Surgery" },
  { start: 31000, end: 31899, type: "Surgery", category: "Larynx Surgery" },
  { start: 32035, end: 32999, type: "Surgery", category: "Chest/Lung Surgery" },

  // Surgery - Cardiovascular
  { start: 33010, end: 33999, type: "Surgery", category: "Heart Surgery" },
  { start: 34001, end: 34834, type: "Surgery", category: "Vascular Surgery" },

  // Surgery - Digestive
  { start: 40490, end: 40799, type: "Surgery", category: "Mouth Surgery" },
  { start: 41000, end: 41599, type: "Surgery", category: "Tongue/Floor of Mouth Surgery" },
  { start: 42000, end: 42999, type: "Surgery", category: "Throat Surgery" },
  { start: 43020, end: 43499, type: "Surgery", category: "Esophagus Surgery" },
  { start: 43500, end: 43999, type: "Surgery", category: "Stomach Surgery" },
  { start: 44005, end: 44799, type: "Surgery", category: "Intestine Surgery" },
  { start: 45000, end: 45999, type: "Surgery", category: "Rectum Surgery" },
  { start: 46020, end: 46999, type: "Surgery", category: "Anus Surgery" },
  { start: 47000, end: 47399, type: "Surgery", category: "Liver Surgery" },
  { start: 47400, end: 47999, type: "Surgery", category: "Biliary Surgery" },
  { start: 48000, end: 48999, type: "Surgery", category: "Pancreas Surgery" },
  { start: 49000, end: 49999, type: "Surgery", category: "Abdomen Surgery" },

  // Surgery - Urinary
  { start: 50010, end: 50593, type: "Surgery", category: "Kidney Surgery" },
  { start: 50600, end: 50980, type: "Surgery", category: "Ureter Surgery" },
  { start: 51020, end: 51999, type: "Surgery", category: "Bladder Surgery" },
  { start: 52000, end: 52700, type: "Surgery", category: "Urethra Surgery" },
  { start: 53000, end: 53899, type: "Surgery", category: "Urethra Surgery" },

  // Surgery - Reproductive
  { start: 54000, end: 54699, type: "Surgery", category: "Male Genital Surgery" },
  { start: 55000, end: 55899, type: "Surgery", category: "Prostate Surgery" },
  { start: 56405, end: 56821, type: "Surgery", category: "Vulva Surgery" },
  { start: 57000, end: 57426, type: "Surgery", category: "Vagina Surgery" },
  { start: 58100, end: 58579, type: "Surgery", category: "Uterus Surgery" },
  { start: 58600, end: 58770, type: "Surgery", category: "Ovary Surgery" },

  // Lab/Pathology
  { start: 80047, end: 80076, type: "Lab", category: "Organ/Disease Panels" },
  { start: 80150, end: 80299, type: "Lab", category: "Drug Testing" },
  { start: 80400, end: 80439, type: "Lab", category: "Evocative Testing" },
  { start: 81000, end: 81099, type: "Lab", category: "Urinalysis" },
  { start: 81105, end: 81408, type: "Lab", category: "Molecular Pathology" },
  { start: 82009, end: 84999, type: "Lab", category: "Chemistry" },
  { start: 85002, end: 85999, type: "Lab", category: "Hematology" },
  { start: 86000, end: 86849, type: "Lab", category: "Immunology" },
  { start: 87001, end: 87999, type: "Lab", category: "Microbiology" },
  { start: 88000, end: 88099, type: "Lab", category: "Necropsy" },
  { start: 88104, end: 88199, type: "Lab", category: "Cytopathology" },
  { start: 88300, end: 88399, type: "Lab", category: "Surgical Pathology" },

  // Physical Therapy
  { start: 97010, end: 97039, type: "Physical Therapy", category: "Modalities" },
  { start: 97110, end: 97546, type: "Physical Therapy", category: "Therapeutic Procedures" },
  { start: 97597, end: 97610, type: "Physical Therapy", category: "Active Wound Care" },

  // Chiropractic
  { start: 98940, end: 98943, type: "Chiropractic", category: "Spinal Manipulation" },

  // Injections/Infusions
  { start: 96360, end: 96379, type: "Infusion", category: "Hydration/Infusion" },
  { start: 96401, end: 96549, type: "Chemotherapy", category: "Chemotherapy Administration" },
  { start: 20550, end: 20553, type: "Injection", category: "Trigger Point Injection" },
  { start: 20600, end: 20611, type: "Injection", category: "Joint Injection" },

  // Anesthesia
  { start: 0, end: 1999, type: "Anesthesia", category: "Anesthesia Services" },

  // Evaluation & Management
  { start: 99201, end: 99215, type: "Office Visit", category: "Office/Outpatient Visits" },
  { start: 99217, end: 99220, type: "Hospital Care", category: "Observation Care" },
  { start: 99221, end: 99239, type: "Hospital Care", category: "Hospital Inpatient Services" },
  { start: 99241, end: 99255, type: "Consultation", category: "Consultations" },
  { start: 99281, end: 99288, type: "Emergency", category: "Emergency Department" },
  { start: 99304, end: 99318, type: "Nursing Facility", category: "Nursing Facility Services" },
  { start: 99341, end: 99350, type: "Home Visit", category: "Home Services" },
  { start: 99381, end: 99397, type: "Preventive", category: "Preventive Medicine" },
] as const;

/**
 * Get full procedure info from CPT code
 */
export function getProcedureInfo(cptCode: number) {
  const match = PROCEDURE_TYPE_RANGES.find(range => cptCode >= range.start && cptCode <= range.end);
  return match || { type: "-", category: "-" };
}

/**
 * Get the type of the procedure from the CPT code
 * @param procedure
 * @returns The type of the procedure
 */
export function getProcedureType(procedure: Procedure): string {
  for (const c of procedure.code?.coding ?? []) {
    if (c.system !== "http://www.ama-assn.org/go/cpt" || !c.code) continue;
    const foundType = getTypeFromCptCodeRange(c.code);
    if (foundType) return foundType;
  }
  return "-";
}

function getTypeFromCptCodeRange(cptCode: string): string | undefined {
  const numericCode = parseInt(cptCode, 10);
  if (isNaN(numericCode)) return undefined;
  return PROCEDURE_TYPE_RANGES.find(r => numericCode >= r.start && numericCode <= r.end)?.type;
}
