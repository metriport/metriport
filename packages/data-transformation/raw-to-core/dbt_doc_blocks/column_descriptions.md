{% docs _dbt_source_relation %}
dbt utils metadata column to indicate the source table from unioning tables together.
{% enddocs %}

{% docs accession_number %}
The lab order number from the source system.
{% enddocs %}

{% docs address %}
The street address of the record (e.g., facility location, patient, etc).
{% enddocs %}

{% docs admission_date %}
Admission date for the claim (inpatient claims only).
{% enddocs %}

{% docs admit_age %}
The age of the patient at the time of admission.
{% enddocs %}

{% docs admit_source_code %}
Indicates where the patient was before the healthcare encounter (inpatient claims only).
{% enddocs %}

{% docs admit_source_description %}
Description of the admit_source_code for the encounter.
{% enddocs %}

{% docs admit_type_code %}
Indicates the type of admission (inpatient claims only).
{% enddocs %}

{% docs admit_type_description %}
Description of the admit_type_code for the encounter.
{% enddocs %}

{% docs age %}
The age of the patient calculated based on their date of birth and the last time the tuva project was run.
{% enddocs %}

{% docs age_group %}
The decade age group the patient falls into based on their calculated age.
{% enddocs %}

{% docs allowed_amount %}
The total amount allowed (includes amount paid by the insurer and patient).
{% enddocs %}

{% docs ambulance_flag %}
Indicates whether ambulance services were utilized during the encounter (1 for yes, 0 for no).
{% enddocs %}

{% docs appointment_id %}
Unique identifier for the appointment.
{% enddocs %}

{% docs appointment_specialty %}
Specialty of a practitioner that would be required to perform the service requested in this appointment.
{% enddocs %}

{% docs apr_drg_code %}
APR-DRG for the claim (inpatient claims only).
{% enddocs %}

{% docs apr_drg_description %}
Description of the APR-DRG code.
{% enddocs %}

{% docs atc_code %}
ATC code for the medication.
{% enddocs %}

{% docs atc_description %}
Description for the ATC code.
{% enddocs %}

{% docs atc_mapping_method %}
mapping method used to populate the normalized codes and descriptions. Can be manual (fields were populated in input layer), automatic (dictionary codes matching the source code were found and was automatically populated) or custom (populated by normalization engine)
{% enddocs %}

{% docs attending_provider_id %}
ID for the attending provider on the encounter.
{% enddocs %}

{% docs attending_provider_name %}
Name of the attending provider on the encounter.
{% enddocs %}

{% docs bill_type_code %}
Bill type code for the claim (institutional claims only).
{% enddocs %}

{% docs bill_type_description %}
Bill type description.
{% enddocs %}

{% docs billing_id %}
Billing ID for the claim (typically represents organization billing the claim).
{% enddocs %}

{% docs billing_name %}
Billing provider name.
{% enddocs %}

{% docs billing_tin %}
Billing provider tax identification number (TIN).
{% enddocs %}

{% docs birth_date %}
The birth date of the patient.
{% enddocs %}

{% docs body_site %}
The body site where the vaccine was administered.
{% enddocs %}

{% docs cancellation_reason %}
Free text reason why the appointment was cancelled.
{% enddocs %}

{% docs ccs_category %}
The Clinical Classifications Software (CCS) category code for the diagnosis or procedure.
{% enddocs %}

{% docs ccs_category_description %}
Description of the Clinical Classifications Software (CCS) category.
{% enddocs %}

{% docs charge_amount %}
The total amount charged for the services provided, before any adjustments or payments. This is typically in US dollars.
{% enddocs %}

{% docs city %}
The city of the record (e.g., facility location, patient, etc).
{% enddocs %}

{% docs claim_attribution_number %}
A unique number used for attributing or associating claims with specific entities or processes.
{% enddocs %}

{% docs claim_count %}
The number of claims associated with the encounter or record.
{% enddocs %}

{% docs claim_end_date %}
End date for the claim.
{% enddocs %}

{% docs claim_id %}
Unique identifier for a claim. Each claim represents a distinct healthcare service or set of services provided to a patient.
{% enddocs %}

{% docs claim_line_attribution_number %}
A unique number used for attributing or associating specific claim lines with entities or processes.
{% enddocs %}

{% docs claim_line_end_date %}
End date for the claim line.
{% enddocs %}

{% docs claim_line_id %}
Unique identifier for each line item within a claim.
{% enddocs %}

{% docs claim_line_number %}
Indicates the line number for the particular line of the claim.
{% enddocs %}

{% docs claim_line_start_date %}
Start date for the claim line.
{% enddocs %}

{% docs claim_start_date %}
The date when the healthcare service was provided. Format: YYYY-MM-DD.
{% enddocs %}

{% docs claim_type %}
Indicates whether the claim is professional (CMS-1500), institutional (UB-04), dental, or vision.
{% enddocs %}

{% docs close_flag %}
A flag indicating if the claim has been closed.
{% enddocs %}

{% docs coinsurance_amount %}
The total coinsurance charged on the claim by the provider.
{% enddocs %}

{% docs collection_date %}
Date the test was collected.
{% enddocs %}

{% docs collection_datetime %}
Datetime the specimen was collected.
{% enddocs %}

{% docs condition_id %}
Unique identifier for each condition in the table.
{% enddocs %}

{% docs condition_rank %}
The numerical ranking of a diagnosis code in a claim. Principle diagnosis code is given a ranking of 1. Claims data typically has a strict ranking of conditions whereas medical records will often not have this information or the information won't be accurate.
{% enddocs %}

{% docs condition_type %}
The type of condition i.e. problem, admitting, or billing.
{% enddocs %}

{% docs copayment_amount %}
The total copayment charged on the claim by the provider.
{% enddocs %}

{% docs county %}
The county for the patient.
{% enddocs %}

{% docs custom_attributed_provider %}
Unique identifier for the provider assigned to this patient-year_month by the user.
{% enddocs %}

{% docs custom_attributed_provider_practice %}
Name of the practice for the attributed provider assigned by the user.
{% enddocs %}

{% docs custom_attributed_provider_organization %}
Name of the organization for the attributed provider assigned by the user.
{% enddocs %}

{% docs custom_attributed_provider_lob %}
Name of the line of business for the attributed provider assigned by the user (e.g. medicare, medicaid, commercial).
{% enddocs %}

{% docs data_source %}
User-configured field that indicates the data source.
{% enddocs %}

{% docs days_supply %}
The number of days supply included.
{% enddocs %}

{% docs death_date %}
Date the patient died if there is one.
{% enddocs %}

{% docs death_flag %}
A flag indicating if the patient has died.
{% enddocs %}

{% docs deductible_amount %}
The total deductible charged on the claim by the provider.
{% enddocs %}

{% docs default_ccsr_category_description_ip %}
Description of the default Clinical Classifications Software Refined (CCSR) category for inpatient services.
{% enddocs %}

{% docs default_ccsr_category_description_op %}
Description of the default Clinical Classifications Software Refined (CCSR) category for outpatient services.
{% enddocs %}

{% docs default_ccsr_category_ip %}
The default Clinical Classifications Software Refined (CCSR) category code for inpatient services.
{% enddocs %}

{% docs default_ccsr_category_op %}
The default Clinical Classifications Software Refined (CCSR) category code for outpatient services.
{% enddocs %}

{% docs delivery_flag %}
Indicates whether the encounter involved a delivery (1 for yes, 0 for no).
{% enddocs %}

{% docs delivery_type %}
Type of delivery that occurred during the encounter, if applicable.
{% enddocs %}

{% docs diagnosis_code_1 %}
The primary diagnosis code for the encounter or claim.
{% enddocs %}

{% docs diagnosis_code_type %}
The coding system used for the diagnosis code (e.g., ICD-10-CM, ICD-9-CM).
{% enddocs %}

{% docs discharge_date %}
Discharge date for the claim (inpatient claims only).
{% enddocs %}

{% docs discharge_disposition_code %}
Indicates the type of setting the patient was discharged to (institutional inpatient claims only).
{% enddocs %}

{% docs discharge_disposition_description %}
Description of the discharge_disposition_code for the encounter.
{% enddocs %}

{% docs dispensing_date %}
Date the medication was dispensed.
{% enddocs %}

{% docs dispensing_provider_id %}
ID for the provider that dispensed the prescription (e.g. pharmacy).
{% enddocs %}

{% docs dispensing_provider_name %}
Dispensing provider name.
{% enddocs %}

{% docs distinct_claims %}
The number of distinct claims associated with the record.
{% enddocs %}

{% docs distinct_service_category_count %}
The count of distinct service categories associated with the claim.
{% enddocs %}

{% docs dme_flag %}
Indicates whether durable medical equipment (DME) was used during the encounter (1 for yes, 0 for no).
{% enddocs %}

{% docs dq_problem %}
A flag or description indicating a data quality issue.
{% enddocs %}

{% docs drg_code_type %}
The DRG system used for the claim.
{% enddocs %}

{% docs drg_code %}
The DRG code on the claim.
{% enddocs %}

{% docs drg_description %}
The description for the DRG code used on the claim.
{% enddocs %}

{% docs dual_status_code %}
Indicates whether the patient is dually eligible for Medicare and Medicaid.
{% enddocs %}

{% docs duplicate_row_number %}
A number assigned to duplicate rows for identification purposes.
{% enddocs %}

{% docs duration %}
Number of minutes that the appointment or service is to take.
{% enddocs %}

{% docs ed_flag %}
Indicates whether the encounter involved an emergency department visit (1 for yes, 0 for no).
{% enddocs %}

{% docs eligibility_id %}
Unique identifier for each eligibility row in the table.
{% enddocs %}

{% docs email %}
The email for the patient
{% enddocs %}

{% docs encounter_claim_number %}
A unique identifier for the encounter or claim.
{% enddocs %}

{% docs encounter_claim_number_desc %}
A description or additional information about the encounter claim number.
{% enddocs %}

{% docs encounter_end_date %}
Date when the encounter ended.
{% enddocs %}

{% docs encounter_group %}
Categorization of the encounter into groups based on predefined criteria.
{% enddocs %}

{% docs encounter_id %}
Unique identifier for each encounter in the dataset.
{% enddocs %}

{% docs encounter_source_type %}
Indicates whether the encounter is from a claims or clinical data source
{% enddocs %}

{% docs encounter_start_date %}
Date when the encounter started.
{% enddocs %}

{% docs encounter_type %}
Indicates the type of encounter e.g. acute inpatient, emergency department, etc.
{% enddocs %}

{% docs end_date %}
The end date of the service or claim period.
{% enddocs %}

{% docs end_datetime %}
The end date/time of the appointment or service.
{% enddocs %}

{% docs enrollment_end_date %}
Date the patient's insurance eligibility ended.
{% enddocs %}

{% docs enrollment_flag %}
Flag indicating if the claim has corresponding enrollment during the same time period the service occurred.
{% enddocs %}

{% docs enrollment_start_date %}
Date the patient's insurance eligibility began.
{% enddocs %}

{% docs ethnicity %}
The ethnicity of the patient
{% enddocs %}

{% docs facility_id %}
Facility ID for the claim (typically represents the facility where services were performed).
{% enddocs %}

{% docs facility_name %}
Facility name.
{% enddocs %}

{% docs facility_npi %}
Facility NPI for the claim (typically represents the facility where services were performed).
{% enddocs %}

{% docs file_date %}
The date associated with the claims file, typically reflecting the reporting period of the claims data.
{% enddocs %}

{% docs file_name %}
The file name of the source file.
{% enddocs %}

{% docs facility_type %}
The type of facility e.g. acute care hospital.
{% enddocs %}

{% docs first_name %}
The first name of the patient.
{% enddocs %}

{% docs gender %}
The gender of the patient.
{% enddocs %}

{% docs group_id %}
The group id which multiple members are enrolled for health coverage.
{% enddocs %}

{% docs group_name %}
The group name under which multiple members are enrolled for health coverage.
{% enddocs %}

{% docs hcpcs_code %}
The CPT or HCPCS code representing the procedure or service provided. These codes are used to describe medical, surgical, and diagnostic services.
{% enddocs %}

{% docs hcpcs_modifier_1 %}
1st modifier for HCPCS code.
{% enddocs %}

{% docs hcpcs_modifier_2 %}
2nd modifier for HCPCS code.
{% enddocs %}

{% docs hcpcs_modifier_3 %}
3rd modifier for HCPCS code.
{% enddocs %}

{% docs hcpcs_modifier_4 %}
4th modifier for HCPCS code.
{% enddocs %}

{% docs hcpcs_modifier_5 %}
5th modifier for HCPCS code.
{% enddocs %}

{% docs immunization_id %}
Unique identifier for each immunization.
{% enddocs %}

{% docs in_network_flag %}
Flag indicating if the claim was in or out of network.
{% enddocs %}

{% docs ingest_datetime %}
The date and time the source file was ingested into the data warehouse or landed in cloud storage.
{% enddocs %}

{% docs inferred_claim_end_column_used %}
The column used to infer the claim end date.
{% enddocs %}

{% docs inferred_claim_end_year_month %}
The inferred year and month of the claim end date.
{% enddocs %}

{% docs inferred_claim_start_column_used %}
The column used to infer the claim start date.
{% enddocs %}

{% docs inferred_claim_start_year_month %}
The inferred year and month of the claim start date.
{% enddocs %}

{% docs inst_claim_count %}
Number of institutional claims generated from the encounter.
{% enddocs %}

{% docs lab_flag %}
Indicates whether lab services were utilized during the encounter (1 for yes, 0 for no).
{% enddocs %}

{% docs lab_result_id %}
Unique identifier for each lab result.
{% enddocs %}

{% docs last_name %}
The last name of the patient.
{% enddocs %}

{% docs latitude %}
The latitude of the record (e.g., facility location, patient, etc).
{% enddocs %}

{% docs length_of_stay %}
Length of the encounter calculated as encounter_end_date - encounter_start_date.
{% enddocs %}

{% docs location_id %}
Unique identifier for each location.
{% enddocs %}

{% docs longitude %}
The longitude of the record (e.g., facility location, patient, etc).
{% enddocs %}

{% docs lot_number %}
Lot number of the vaccine product.
{% enddocs %}

{% docs mapping_method %}
mapping method used to populate the normalized codes and descriptions. Can be manual (fields were populated in input layer), automatic (dictionary codes matching the source code were found and was automatically populated) or custom (populated by normalization engine)
{% enddocs %}

{% docs medical_claim_id %}
Unique identifier for each row in the table.
{% enddocs %}

{% docs medical_surgical %}
A flag or code indicating if the service was medical or surgical.
{% enddocs %}

{% docs medicare_status_code %}
Indicates how the patient became eligible for Medicare.
{% enddocs %}

{% docs medication_id %}
Unique identifier for each medication in the table.
{% enddocs %}

{% docs member_id %}
Identifier that links a patient to a particular insurance product or health plan. A patient can have more than one member_id because they can have more than one insurance product/plan.
{% enddocs %}

{% docs member_month_key %}
The unique combination of person_id, year_month, payer, plan, and data source.
{% enddocs %}

{% docs middle_name %}
The middle name of the patient.
{% enddocs %}

{% docs min_closing_row %}
The minimum row number for closing entries in the dataset.
{% enddocs %}

{% docs modality %}
The mode or method of treatment or service delivery.
{% enddocs %}

{% docs modifier_1 %}
First modifier for the procedure code.
{% enddocs %}

{% docs modifier_2 %}
Second modifier for the procedure code.
{% enddocs %}

{% docs modifier_3 %}
Third modifier for the procedure code.
{% enddocs %}

{% docs modifier_4 %}
Fourth modifier for the procedure code.
{% enddocs %}

{% docs modifier_5 %}
Fifth modifier for the procedure code.
{% enddocs %}

{% docs mortality_flag %}
A flag indicating if the patient died during the encounter.
{% enddocs %}

{% docs ms_drg_code %}
MS-DRG for the claim (inpatient claims only).
{% enddocs %}

{% docs ms_drg_description %}
Description of the ms_drg_code.
{% enddocs %}

{% docs name %}
The name of the location.
{% enddocs %}

{% docs name_suffix %}
The name suffixes (e.g., Sr., Jr., III.)
{% enddocs %}

{% docs ndc_code %}
National drug code associated with the medication.
{% enddocs %}

{% docs ndc_description %}
Description for the NDC.
{% enddocs %}

{% docs ndc_mapping_method %}
mapping method used to populate the normalized codes and descriptions. Can be manual (fields were populated in input layer), automatic (dictionary codes matching the source code were found and was automatically populated) or custom (populated by normalization engine)
{% enddocs %}

{% docs newborn_flag %}
Indicates whether the encounter was for a newborn (1 for yes, 0 for no).
{% enddocs %}

{% docs nicu_flag %}
Indicates whether the newborn was admitted to the Neonatal Intensive Care Unit (NICU) during the encounter (1 for yes, 0 for no).
{% enddocs %}

{% docs normalized_abnormal_flag %}
Normalized abnormal flag.
{% enddocs %}

{% docs normalized_appointment_type_code %}
Normalized appointment type code.
{% enddocs %}

{% docs normalized_appointment_type_description %}
Normalized appointment type description.
{% enddocs %}

{% docs normalized_cancellation_reason_code_type %}
The normalized type of code for the cancellation reason (e.g., appointment-cancellation-reason).
{% enddocs %}

{% docs normalized_cancellation_reason_code %}
The normalized code for the cancellation reason.
{% enddocs %}

{% docs normalized_cancellation_reason_description %}
Normalized description of the code for the cancellation reason.
{% enddocs %}

{% docs normalized_code %}
The normalized code.
{% enddocs %}

{% docs normalized_code_type %}
The normalized type of code.
{% enddocs %}

{% docs normalized_component_code %}
The normalized code for the component.
{% enddocs %}

{% docs normalized_component_description %}
Normalized description of the code for the component.
{% enddocs %}

{% docs normalized_component_type %}
The normalized type of code for the component.
{% enddocs %}

{% docs normalized_description %}
Normalized description of the code.
{% enddocs %}

{% docs normalized_dose %}
Normalized quantity of vaccine product that was administered.
{% enddocs %}

{% docs normalized_reason_code_type %}
The normalized type of code for the appointment reason (e.g., icd-10-cm).
{% enddocs %}

{% docs normalized_reason_code %}
The normalized code for the appointment reason (e.g., ICD-10 code).
{% enddocs %}

{% docs normalized_reason_description %}
Normalized description of the code for the appointment reason (e.g., ICD-10 description).
{% enddocs %}

{% docs normalized_reference_range_high %}
The normalized high end of the reference range.
{% enddocs %}

{% docs normalized_reference_range_low %}
The normalized low end of the reference range.
{% enddocs %}

{% docs normalized_status %}
The normalized status of the appointment.
{% enddocs %}

{% docs normalized_units %}
Normalized units of the lab test.
{% enddocs %}

{% docs npi %}
The national provider identifier associated with the record e.g. facility_npi, provider_npi
{% enddocs %}

{% docs observation_date %}
Date the observation was recorded.
{% enddocs %}

{% docs observation_flag %}
Indicates whether the encounter was marked as an observation stay (1 for yes, 0 for no).
{% enddocs %}

{% docs observation_id %}
Unique identifier for each observation in the dataset.
{% enddocs %}

{% docs observation_type %}
Type of observation.
{% enddocs %}

{% docs occurrence_date %}
Date the event occured or was to be occured.
{% enddocs %}

{% docs old_encounter_id %}
A previous or alternative identifier for the encounter.
{% enddocs %}

{% docs onset_date %}
Date when the condition first occurred.
{% enddocs %}

{% docs ordering_practitioner_id %}
Unique identifier for the practitioner who ordered the lab test.
{% enddocs %}

{% docs original_reason_entitlement_code %}
Original reason for Medicare entitlement code.
{% enddocs %}

{% docs original_service_cat_2 %}
The original second-level service category.
{% enddocs %}

{% docs original_service_cat_3 %}
The original third-level service category.
{% enddocs %}

{% docs paid_amount %}
The total amount paid by the insurer.
{% enddocs %}

{% docs paid_date %}
The date the claim was paid.
{% enddocs %}

{% docs panel_id %}
Unique identifier for the panel.
{% enddocs %}

{% docs parent_organization %}
The parent organization associated with the facility.
{% enddocs %}

{% docs patient_data_source_id %}
Identifier for the source system from which patient data originated.
{% enddocs %}

{% docs patient_id %}
Identifier that links a patient to a particular clinical source system.
{% enddocs %}

{% docs patient_row_num %}
A row number assigned to the patient's records.
{% enddocs %}

{% docs payer %}
Name of the payer (i.e. health insurer) providing coverage.
{% enddocs %}

{% docs payer_attributed_provider %}
Unique identifier for the provider assigned to this patient-year_month by the payer.
{% enddocs %}

{% docs payer_attributed_provider_practice %}
Name of the practice for the payer attributed provider.
{% enddocs %}

{% docs payer_attributed_provider_organization %}
Name of the organization for the payer attributed provider.
{% enddocs %}

{% docs payer_attributed_provider_lob %}
Name of the line of business for the payer attributed provider (e.g. medicare, medicaid, commercial).
{% enddocs %}

{% docs payer_type %}
Type of payer (e.g. commercial, medicare, medicaid, etc.).
{% enddocs %}

{% docs person_id %}
Unique identifier for each person in the dataset.
{% enddocs %}

{% docs pharmacy_claim_id %}
Unique identifier for each row in the table.
{% enddocs %}

{% docs pharmacy_flag %}
Indicates whether pharmacy services were utilized during the encounter (1 for yes, 0 for no).
{% enddocs %}

{% docs phone %}
The phone number for the patient.
{% enddocs %}

{% docs place_of_service_code %}
Place of service for the claim (professional claims only).
{% enddocs %}

{% docs place_of_service_description %}
Place of service description.
{% enddocs %}

{% docs plan %}
Name of the plan (i.e. sub contract) providing coverage.
{% enddocs %}

{% docs practice_affiliation %}
Practice affiliation of the provider.
{% enddocs %}

{% docs practitioner_id %}
Unique identifier for the practitioner on record (e.g., ordered medication, performed the procedure, etc).
{% enddocs %}

{% docs prescribing_date %}
Date the medication was prescribed.
{% enddocs %}

{% docs prescribing_provider_id %}
ID for the provider that wrote the prescription (e.g. priamry care physician).
{% enddocs %}

{% docs prescribing_provider_name %}
Prescribing provider name.
{% enddocs %}

{% docs present_on_admit_code %}
The present_on_admit_code related to the condition.
{% enddocs %}

{% docs present_on_admit_description %}
The description of the present_on_admit_code for the condition.
{% enddocs %}

{% docs primary_diagnosis_code %}
Primary diagnosis code for the encounter. If from claims the primary diagnosis code comes from the institutional claim.
{% enddocs %}

{% docs primary_diagnosis_code_type %}
The type of condition code reported in the source system e.g. ICD-10-CM.
{% enddocs %}

{% docs primary_diagnosis_description %}
Description of the primary diagnosis code.
{% enddocs %}

{% docs primary_specialty_description %}
Description of the primary medical specialty of the provider.
{% enddocs %}

{% docs primary_taxonomy_code %}
The primary taxonomy code identifying the provider's specialty, classification, or area of practice.
{% enddocs %}

{% docs priority %}
The priority or urgency level of the service or claim.
{% enddocs %}

{% docs priority_number %}
A number indicating the priority or sequence of the service or claim.
{% enddocs %}

{% docs procedure_date %}
Date when the procedure was performed.
{% enddocs %}

{% docs procedure_id %}
The unique identifier for the performed procedure.
{% enddocs %}

{% docs prof_claim_count %}
Number of professional claims generated from the encounter.
{% enddocs %}

{% docs provider_first_name %}
The first name of the healthcare provider.
{% enddocs %}

{% docs provider_last_name %}
The last name of the healthcare provider.
{% enddocs %}

{% docs provider_name %}
The name of the healthcare provider.
{% enddocs %}

{% docs provider_specialty %}
The medical specialty of the provider.
{% enddocs %}

{% docs quantity %}
The quantity of the medication.
{% enddocs %}

{% docs quantity_unit %}
The units for the quantity.
{% enddocs %}

{% docs race %}
The patient's race.
{% enddocs %}

{% docs reason %}
Free text reason for the appointment or service.
{% enddocs %}

{% docs recorded_date %}
Date when the condition was recorded.
{% enddocs %}

{% docs refills %}
Number of refills for the prescription.
{% enddocs %}

{% docs relative_rank %}
A ranking or order of importance for the record.
{% enddocs %}

{% docs rend_primary_specialty_description %}
A description of the rendering provider's primary specialty.
{% enddocs %}

{% docs rendering_id %}
Rendering ID for the claim (typically represents the physician or entity providing services).
{% enddocs %}

{% docs rendering_name %}
Rendering provider name.
{% enddocs %}

{% docs rendering_tin %}
Rendering provider tax identification number (TIN).
{% enddocs %}

{% docs resolved_date %}
Date when the condition was resolved.
{% enddocs %}

{% docs result %}
The result of the record (e.g., lab test, observation, etc).
{% enddocs %}

{% docs result_date %}
Date of the test result.
{% enddocs %}

{% docs result_datetime %}
Datetime of the test result.
{% enddocs %}

{% docs revenue_center_code %}
Revenue center code for the claim line (institutional only and typically multiple codes per claim).
{% enddocs %}

{% docs revenue_center_description %}
Revenue center description.
{% enddocs %}

{% docs route %}
The route used to administer the medication and/or vaccine.
{% enddocs %}

{% docs rxnorm_code %}
RxNorm code associated with the medication.
{% enddocs %}

{% docs rxnorm_description %}
Description for the RxNorm code.
{% enddocs %}

{% docs rxnorm_mapping_method %}
mapping method used to populate the normalized codes and descriptions. Can be manual (fields were populated in input layer), automatic (dictionary codes matching the source code were found and was automatically populated) or custom (populated by normalization engine)
{% enddocs %}

{% docs service_category_1 %}
The broader service category this claim belongs to.
{% enddocs %}

{% docs service_category_2 %}
The more specific service category this claim belongs to.
{% enddocs %}

{% docs service_category_3 %}
The most specific service category this claim belongs to.
{% enddocs %}

{% docs service_type %}
The type of service provided.
{% enddocs %}

{% docs service_unit_quantity %}
The number of units for the particular revenue center code.
{% enddocs %}

{% docs sex %}
The gender of the patient.
{% enddocs %}

{% docs snf_part_b_flag %}
Indicates whether the inpatient medical service for Medicare covers under Part B or not. (1 for yes and 0 for no)
{% enddocs %}

{% docs social_security_number %}
The social security number of the patient.
{% enddocs %}

{% docs source_abnormal_flag %}
Indicates whether the result is abnormal or normal.
{% enddocs %}

{% docs source_appointment_type_code %}
Appointment type code from the source.
{% enddocs %}

{% docs source_appointment_type_description %}
Appointment type description from the source.
{% enddocs %}

{% docs source_cancellation_reason_code_type %}
The type of code reported in the source system for the cancellation reason (e.g., appointment-cancellation-reason).
{% enddocs %}

{% docs source_cancellation_reason_code %}
The code in the source system for the cancellation reason.
{% enddocs %}

{% docs source_cancellation_reason_description %}
Description of the source code for the cancellation reason in the source system.
{% enddocs %}

{% docs source_code %}
The code in the source system (e.g., the ICD-10 code, NDC, lab, etc)
{% enddocs %}

{% docs source_code_type %}
The type of code reported in the source system (e.g., ICD-10 code, NDC, lab, etc)
{% enddocs %}

{% docs source_component_code %}
The code for the component in the source system (e.g., the ICD-10 code, NDC, lab, etc)
{% enddocs %}

{% docs source_component_type %}
The type of code for the component reported in the source system (e.g., ICD-10 code, NDC, lab, etc)
{% enddocs %}

{% docs source_component_description %}
Description of the source code for the component in the source system.
{% enddocs %}

{% docs source_description %}
Description of the source code in the source system.
{% enddocs %}

{% docs source_dose %}
The quantity of vaccine product that was administered.
{% enddocs %}

{% docs source_model %}
Indicates the DBT source relation name from which data is derived.
{% enddocs %}

{% docs source_model_name %}
The name of the source data model.
{% enddocs %}

{% docs source_reason_code_type %}
The type of code reported in the source system for the appointment reason; typically a Condition (e.g., icd-10-cm).
{% enddocs %}

{% docs source_reason_code %}
The code in the source system for the appointment reason (e.g., ICD-10 code).
{% enddocs %}

{% docs source_reason_description %}
Description of the source code for the appointment reason in the source system (e.g., ICD-10 description).
{% enddocs %}

{% docs source_reference_range_high %}
The high end of the reference range from the source system.
{% enddocs %}

{% docs source_reference_range_low %}
The low end of the reference range from the source system.
{% enddocs %}

{% docs source_status %}
Status of the appointment from the source system.
{% enddocs %}

{% docs source_units %}
Source units of the lab test.
{% enddocs %}

{% docs specialty %}
Specialty of the provider.
{% enddocs %}

{% docs specimen %}
The type of specimen e.g. blood, plasma, urine.
{% enddocs %}

{% docs start_date %}
The start date of the service or claim period.
{% enddocs %}

{% docs start_datetime %}
The start date/time of the appointment or service.
{% enddocs %}

{% docs state %}
The state of the record (e.g., facility location, patient, etc).
{% enddocs %}

{% docs status %}
Status of the record (e.g., condition, test, etc).
{% enddocs %}

{% docs status_reason %}
Indicates reason the event was not performed. (e.g., condition, test, immunization etc).
{% enddocs %}

{% docs strength %}
The strength of the medication.
{% enddocs %}

{% docs sub_specialty %}
Sub specialty of the provider.
{% enddocs %}

{% docs subscriber_id %}
Identifier that links a patient to a particular insurance product or health plan.
{% enddocs %}

{% docs subscriber_relation %}
The patient's relationship to the subscriber (e.g., self, spouse, child).
{% enddocs %}

{% docs total_allowed_amount %}
The total amount allowed by the insurance company for all services in the claim.
{% enddocs %}

{% docs total_charge_amount %}
The total amount charged for all services in the claim.
{% enddocs %}

{% docs total_cost_amount %}
The total amount paid on the claim by different parties.
{% enddocs %}

{% docs total_paid_amount %}
The total amount paid for all services in the claim.
{% enddocs %}

{% docs tuva_last_run %}
The last time the data was refreshed. Generated by `dbt_utils.pretty_time` as the local time of the `dbt run` environment. Timezone is configurable via the `tuva_last_run` var.
{% enddocs %}

{% docs tuva_package_version %}
The version defined in the Tuva package dbt_project.yml file.
{% enddocs %}

{% docs year_month %}
Unique year-month of in the dataset computed from eligibility.
{% enddocs %}

{% docs zip_code %}
The zip code of the record (e.g., facility location, patient, etc).
{% enddocs %}

{% docs fips_state_code %}
FIPS code for the state the patient lives in (most recent known address).
{% enddocs %}

{% docs normalized_state_name %}
State for the patient (most recent known address).
{% enddocs %}

{% docs fips_state_abbreviation %}
Abbreviated form of the state for the patient (most recient known address).
{% enddocs %}

{% docs hedis_measure_id %}
Measure unique identifier.
{% enddocs %}

{% docs hedis_measure_name %}
Measure name.
{% enddocs %}

{% docs hedis_measure_year %}
Year indicating the definition used.
{% enddocs %}

{% docs hedis_cql_key %}
CQL concept key.
{% enddocs %}

{% docs hedis_cql_value %}
CQL concept value.
{% enddocs %}

{% docs hedis_execution_id %}
Unique identifier for the measure, execution, and patient.
{% enddocs %}

{% docs hedis_status %}
Execution status.
{% enddocs %}

{% docs hedis_type %}
Execution type.
{% enddocs %}

{% docs hedis_rate_id %}
Identifier for "rate-1" or "rate-2". Some HEDIS measures report two rates for different outcomes (e.g., (GSD) Glycemic Status Assessment) or follow-up care (e.g., (DSF-E) Depression Screening and Follow-up). Refer to HEDIS measure documentation.
{% enddocs %}

{% docs hedis_population_type %}
Population type description for the pivoted values ("initial-population", "denominator", "denominator-exclusion", "denominator-exclusion-medicare", "denominator-medicare", "numerator").
{% enddocs %}

{% docs hedis_population_count %}
Boolean value for the pivoted values.
{% enddocs %}

{% docs period_start %}
Starting date of the performance or measurement period.
{% enddocs %}

{% docs period_end %}
Ending date of the performance or measurement period.
{% enddocs %}

{% docs performance_flag %}
Performance flag calculated by using exclusion, numerator, and denominator flags. When excluded from a measure the flag is null.
{% enddocs %}

{% docs denominator %}
The denominator is associated with a given patient population that may be counted as eligible to meet a measure’s inclusion requirements.
{% enddocs %}

{% docs numerator %}
The numerator reflects the subset of patients in the denominator for whom a particular service has been provided or for whom a particular outcome has been achieved with exclusion logic applied.
{% enddocs %}

{% docs exclusion %}
Specifications of those characteristics that would cause groups of individuals to be removed from the numerator and/or denominator of a measure although they experience the denominator index event.
{% enddocs %}

{% docs performance_rate %}
Calculated performance rate. The performance flag sum divided by the performance flag count multiplied by 100.
{% enddocs %}
