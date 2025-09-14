import { Organization, Practitioner } from "@medplum/fhirtypes";

/**
 * NUCC Provider Taxonomy Code mappings for medical specialties
 * Reference: https://www.nucc.org/index.php/code-sets-mainmenu-41/provider-taxonomy-mainmenu-40
 */
export const PRACTITIONER_SPECIALTY_CODES = {
  // Group Classifications
  "193200000X": "Multi-Specialty Group",
  "193400000X": "Single Specialty Group",

  // Allergy & Immunology
  "207K00000X": "Allergy & Immunology",
  "207KA0200X": "Allergy",
  "207KI0005X": "Clinical & Laboratory Immunology",

  // Anesthesiology
  "207L00000X": "Anesthesiology",
  "207LA0401X": "Addiction Medicine",
  "207LC0200X": "Critical Care Medicine",
  "207LH0002X": "Hospice and Palliative Medicine",
  "207LP2900X": "Pain Medicine",
  "207LP3000X": "Pediatric Anesthesiology",
  "207LP4000X": "Physician Nutrition Specialist",

  // Clinical Pharmacology
  "208U00000X": "Clinical Pharmacology",

  // Colon & Rectal Surgery
  "208C00000X": "Colon & Rectal Surgery",

  // Dermatology
  "207N00000X": "Dermatology",
  "207NI0002X": "Clinical & Laboratory Dermatological Immunology",
  "207ND0900X": "Dermatopathology",
  "207ND0101X": "MOHS-Micrographic Surgery",
  "207NP0225X": "Pediatric Dermatology",
  "207NS0135X": "Procedural Dermatology",

  // Electrodiagnostic Medicine
  "204R00000X": "Electrodiagnostic Medicine",

  // Emergency Medicine
  "207P00000X": "Emergency Medicine",
  "207PE0004X": "Emergency Medical Services",
  "207PH0002X": "Hospice and Palliative Medicine",
  "207PT0002X": "Medical Toxicology",
  "207PP0204X": "Pediatric Emergency Medicine",
  "207PS0010X": "Sports Medicine",
  "207PE0005X": "Undersea and Hyperbaric Medicine",

  // Family Medicine
  "207Q00000X": "Family Medicine",
  "207QA0401X": "Addiction Medicine",
  "207QA0000X": "Adolescent Medicine",
  "207QA0505X": "Adult Medicine",
  "207QG0300X": "Geriatric Medicine",
  "207QH0002X": "Hospice and Palliative Medicine",
  "207QB0002X": "Obesity Medicine",
  "207QP0002X": "Physician Nutrition Specialist",
  "207QS1201X": "Sleep Medicine",
  "207QS0010X": "Sports Medicine",

  // General Practice
  "208D00000X": "General Practice",

  // Hospitalist
  "208M00000X": "Hospitalist",

  // Independent Medical Examiner
  "202C00000X": "Independent Medical Examiner",

  // Integrative Medicine
  "202D00000X": "Integrative Medicine",

  // Internal Medicine
  "207R00000X": "Internal Medicine",
  "207RA0401X": "Addiction Medicine",
  "207RA0000X": "Adolescent Medicine",
  "207RA0002X": "Adult Congenital Heart Disease",
  "207RA0001X": "Advanced Heart Failure and Transplant Cardiology",
  "207RA0201X": "Allergy & Immunology",
  "207RC0000X": "Cardiovascular Disease",
  "207RI0001X": "Clinical & Laboratory Immunology",
  "207RC0001X": "Clinical Cardiac Electrophysiology",
  "207RC0200X": "Critical Care Medicine",
  "207RE0101X": "Endocrinology, Diabetes & Metabolism",
  "207RG0100X": "Gastroenterology",
  "207RG0300X": "Geriatric Medicine",
  "207RH0000X": "Hematology",
  "207RH0003X": "Hematology & Oncology",
  "207RI0008X": "Hepatology",
  "207RH0002X": "Hospice and Palliative Medicine",
  "207RH0005X": "Hypertension Specialist",
  "207RI0200X": "Infectious Disease",
  "207RI0011X": "Interventional Cardiology",
  "207RM1200X": "Magnetic Resonance Imaging (MRI)",
  "207RX0202X": "Medical Oncology",
  "207RN0300X": "Nephrology",
  "207RB0002X": "Obesity Medicine",
  "207RP1002X": "Physician Nutrition Specialist",
  "207RP1001X": "Pulmonary Disease",
  "207RR0500X": "Rheumatology",
  "207RS0012X": "Sleep Medicine",
  "207RS0010X": "Sports Medicine",
  "207RT0003X": "Transplant Hepatology",

  // Legal Medicine
  "209800000X": "Legal Medicine",

  // Medical Genetics
  "207SG0202X": "Clinical Biochemical Genetics",
  "207SC0300X": "Clinical Cytogenetics",
  "207SG0201X": "Clinical Genetics (M.D.)",
  "207SG0203X": "Clinical Molecular Genetics",
  "207SG0207X": "Medical Biochemical Genetics",
  "207SM0001X": "Molecular Genetic Pathology",
  "207SG0205X": "Ph.D. Medical Genetics",

  // Neurological Surgery
  "207T00000X": "Neurological Surgery",

  // Neuromusculoskeletal Medicine & OMM
  "204D00000X": "Neuromusculoskeletal Medicine & OMM",
  "204C00000X": "Sports Medicine (Neuromusculoskeletal Medicine)",

  // Nuclear Medicine
  "207U00000X": "Nuclear Medicine",
  "207UN0903X": "In Vivo & In Vitro Nuclear Medicine",
  "207UN0901X": "Nuclear Cardiology",
  "207UN0902X": "Nuclear Imaging & Therapy",

  // Obstetrics & Gynecology
  "207V00000X": "Obstetrics & Gynecology",
  "207VC0300X": "Complex Family Planning",
  "207VC0200X": "Critical Care Medicine",
  "207VF0040X": "Urogynecology and Reconstructive Pelvic Surgery",
  "207VX0201X": "Gynecologic Oncology",
  "207VG0400X": "Gynecology",
  "207VH0002X": "Hospice and Palliative Medicine",
  "207VM0101X": "Maternal & Fetal Medicine",
  "207VB0002X": "Obesity Medicine",
  "207VX0000X": "Obstetrics",
  "207VE0102X": "Reproductive Endocrinology",

  // Ophthalmology
  "207W00000X": "Ophthalmology",
  "207WX0120X": "Cornea and External Diseases Specialist",
  "207WX0009X": "Glaucoma Specialist",
  "207WX0109X": "Neuro-ophthalmology",
  "207WX0200X": "Ophthalmic Plastic and Reconstructive Surgery",
  "207WX0110X": "Pediatric Ophthalmology and Strabismus Specialist",
  "207WX0107X": "Retina Specialist",
  "207WX0108X": "Uveitis and Ocular Inflammatory Disease",

  // Oral & Maxillofacial Surgery
  "204E00000X": "Oral & Maxillofacial Surgery",

  // Orthopaedic Surgery
  "207X00000X": "Orthopaedic Surgery",
  "207XS0114X": "Adult Reconstructive Orthopaedic Surgery",
  "207XX0004X": "Orthopaedic Foot and Ankle Surgery",
  "207XS0106X": "Orthopaedic Hand Surgery",
  "207XS0117X": "Orthopaedic Surgery of the Spine",
  "207XX0801X": "Orthopaedic Trauma",
  "207XP3100X": "Pediatric Orthopaedic Surgery",
  "207XX0005X": "Sports Medicine (Orthopaedic Surgery)",

  // Otolaryngology
  "207Y00000X": "Otolaryngology",
  "207YS0123X": "Facial Plastic Surgery",
  "207YX0602X": "Otolaryngic Allergy",
  "207YX0905X": "Otolaryngology/Facial Plastic Surgery",
  "207YX0901X": "Otology & Neurotology",
  "207YP0228X": "Pediatric Otolaryngology",
  "207YX0007X": "Plastic Surgery within the Head & Neck",
  "207YS0012X": "Sleep Medicine (Otolaryngology)",

  // Pain Medicine
  "208VP0014X": "Interventional Pain Medicine",
  "208VP0000X": "Pain Medicine",

  // Pathology
  "207ZP0101X": "Anatomic Pathology",
  "207ZP0102X": "Anatomic Pathology & Clinical Pathology",
  "207ZB0001X": "Blood Banking & Transfusion Medicine",
  "207ZP0104X": "Chemical Pathology",
  "207ZC0008X": "Clinical Informatics (Pathology)",
  "207ZC0006X": "Clinical Pathology",
  "207ZP0105X": "Clinical Pathology/Laboratory Medicine",
  "207ZC0500X": "Cytopathology",
  "207ZD0900X": "Dermatopathology (Pathology)",
  "207ZF0201X": "Forensic Pathology",
  "207ZH0000X": "Hematology (Pathology)",
  "207ZI0100X": "Immunopathology",
  "207ZM0300X": "Medical Microbiology",
  "207ZP0007X": "Molecular Genetic Pathology (Pathology)",
  "207ZN0500X": "Neuropathology",
  "207ZP0213X": "Pediatric Pathology",

  // Pediatrics
  "208000000X": "Pediatrics",
  "2080A0000X": "Pediatric Adolescent Medicine",
  "2080C0008X": "Child Abuse Pediatrics",
  "2080I0007X": "Pediatric Clinical & Laboratory Immunology",
  "2080P0006X": "Developmental - Behavioral Pediatrics",
  "2080H0002X": "Pediatric Hospice and Palliative Medicine",
  "2080T0002X": "Pediatric Medical Toxicology",
  "2080N0001X": "Neonatal-Perinatal Medicine",

  // Psychiatry & Neurology
  "2084P0800X": "Psychiatry",
  "2084A0401X": "Addiction Medicine",
  "2084N0600X": "Neurology",
  "2084P0804X": "Psychiatry",
  "2084S0012X": "Sleep Medicine",
} as const;

/**
 * Organization name keyword mappings for specialty detection
 */
export const ORGANIZATION_SPECIALTY_KEYWORDS = {
  // Cardiology
  cardiology: "Cardiovascular",
  cardiac: "Cardiovascular",
  heart: "Cardiovascular",
  cardiovascular: "Cardiovascular",

  // Pulmonology
  pulmonology: "Pulmonary",
  pulmonary: "Pulmonary",
  lung: "Pulmonary",
  respiratory: "Pulmonary",

  // Oncology
  oncology: "Medical Oncology",
  cancer: "Medical Oncology",
  tumor: "Medical Oncology",
  hematology: "Hematology",

  // Emergency Medicine
  emergency: "Emergency Medicine",
  trauma: "Emergency Medicine",
  er: "Emergency Medicine",
  urgent: "Emergency Medicine",

  // Surgery
  surgery: "Orthopaedic Surgery",
  surgical: "Orthopaedic Surgery",
  orthopedic: "Orthopaedic Surgery",
  orthopaedic: "Orthopaedic Surgery",
  neurosurgery: "Neurological Surgery",

  // Internal Medicine
  internal: "Internal Medicine",
  medicine: "Internal Medicine",

  // Radiology
  radiology: "Nuclear Medicine",
  imaging: "Nuclear Medicine",

  // Psychiatry
  psychiatry: "Psychiatry",
  mental: "Psychiatry",
  behavioral: "Psychiatry",

  // Family Medicine
  family: "Family Medicine",
  primary: "Family Medicine",

  // Dermatology
  dermatology: "Dermatology",
  skin: "Dermatology",

  // Anesthesiology
  anesthesiology: "Anesthesiology",
  anesthesia: "Anesthesiology",

  // Pathology
  pathology: "Anatomic Pathology & Clinical Pathology",
  laboratory: "Anatomic Pathology & Clinical Pathology",

  // Pediatrics
  pediatrics: "Pediatrics",
  pediatric: "Pediatrics",
  children: "Pediatrics",

  // Obstetrics & Gynecology
  obstetrics: "Obstetrics & Gynecology",
  gynecology: "Obstetrics & Gynecology",
  women: "Obstetrics & Gynecology",

  // Ophthalmology
  ophthalmology: "Ophthalmology",
  eye: "Ophthalmology",
  vision: "Ophthalmology",

  // Otolaryngology
  otolaryngology: "Otolaryngology",
  ent: "Otolaryngology",
  ear: "Otolaryngology",
  nose: "Otolaryngology",
  throat: "Otolaryngology",

  // Pain Medicine
  pain: "Pain Medicine",

  // Allergy & Immunology
  allergy: "Allergy & Immunology",
  immunology: "Allergy & Immunology",

  // Gastroenterology
  gastroenterology: "Gastroenterology",
  gastro: "Gastroenterology",
  gi: "Gastroenterology",

  // Nephrology
  nephrology: "Nephrology",
  kidney: "Nephrology",

  // Endocrinology
  endocrinology: "Endocrinology, Diabetes & Metabolism",
  diabetes: "Endocrinology, Diabetes & Metabolism",
  hormone: "Endocrinology, Diabetes & Metabolism",

  // Rheumatology
  rheumatology: "Rheumatology",
  arthritis: "Rheumatology",
  joint: "Rheumatology",

  // Infectious Disease
  infectious: "Infectious Disease",
  infection: "Infectious Disease",
} as const;

/**
 * Extract medical specialty from practitioner qualifications
 */
export function extractSpecialtyFromPractitioners(practitioners: Practitioner[]): string {
  if (!practitioners || practitioners.length === 0) {
    return "Unknown";
  }

  for (const practitioner of practitioners) {
    // Check qualification codes first
    if (practitioner.qualification) {
      for (const qualification of practitioner.qualification) {
        if (qualification.code?.coding) {
          for (const coding of qualification.code.coding) {
            if (
              coding.code &&
              PRACTITIONER_SPECIALTY_CODES[coding.code as keyof typeof PRACTITIONER_SPECIALTY_CODES]
            ) {
              return PRACTITIONER_SPECIALTY_CODES[
                coding.code as keyof typeof PRACTITIONER_SPECIALTY_CODES
              ];
            }
          }
        }

        // Fallback to qualification text
        if (qualification.code?.text) {
          const qualificationText = qualification.code.text.toLowerCase();

          // Check against organization keywords for consistent mapping
          for (const [keyword, specialty] of Object.entries(ORGANIZATION_SPECIALTY_KEYWORDS)) {
            if (qualificationText.includes(keyword)) {
              return specialty;
            }
          }
        }
      }
    }
  }

  return "General Medicine";
}

/**
 * Extract medical specialty from organization names
 */
export function extractSpecialtyFromOrganizations(organizations: Organization[]): string {
  if (!organizations || organizations.length === 0) {
    return "Unknown";
  }

  for (const organization of organizations) {
    if (organization.name) {
      const orgName = organization.name.toLowerCase();

      // Check for keyword matches
      for (const [keyword, specialty] of Object.entries(ORGANIZATION_SPECIALTY_KEYWORDS)) {
        if (orgName.includes(keyword)) {
          return specialty;
        }
      }
    }
  }

  return "Unknown";
}

/**
 * Get specialty for a report with fallback logic
 * Priority: Practitioner specialty > Organization specialty > General Medicine
 */
export function getSpecialtyForReport(
  practitioners: Practitioner[],
  organizations?: Organization[]
): string {
  // First try to extract from practitioners
  const practitionerSpecialty = extractSpecialtyFromPractitioners(practitioners);
  if (practitionerSpecialty !== "Unknown" && practitionerSpecialty !== "General Medicine") {
    return practitionerSpecialty;
  }

  // Fallback to organization if available
  if (organizations && organizations.length > 0) {
    const orgSpecialty = extractSpecialtyFromOrganizations(organizations);
    if (orgSpecialty !== "Unknown") {
      return orgSpecialty;
    }
  }

  // Final fallback
  return practitionerSpecialty === "General Medicine" ? "General Medicine" : "Unknown";
}
