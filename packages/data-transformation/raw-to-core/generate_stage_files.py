#!/usr/bin/env python3
"""
Script to generate stage SQL files from configuration INI files.
Reads the [Struct] section from each config file and creates corresponding stage SQL files.
"""

from pathlib import Path

CONFIG_DIR = Path(__file__).parent.parent / "fhir-to-csv/src/parseFhir/configurations"
STAGE_DIR = Path(__file__).parent / "models/core_pipeline/stage"

# Mapping from config file name to source table name (as defined in _sources.yml)
CONFIG_TO_SOURCE = {
    "config_AllergyIntolerance.ini": "allergyintolerance",
    "config_Binary.ini": "binary",
    "config_Condition.ini": "condition",
    "config_Coverage.ini": "coverage",
    "config_DiagnosticReport.ini": "diagnosticreport",
    "config_Encounter.ini": "encounter",
    "config_Immunization.ini": "immunization",
    "config_Location.ini": "location",
    "config_Medication.ini": "medication",
    "config_MedicationAdministration.ini": "medicationadministration",
    "config_MedicationDispense.ini": "medicationdispense",
    "config_MedicationRequest.ini": "medicationrequest",
    "config_MedicationStatement.ini": "medicationstatement",
    "config_Observation.ini": "observation",
    "config_Organization.ini": "organization",
    "config_Patient.ini": "patient",
    "config_Patient_address.ini": "patient_address",
    "config_Patient_name.ini": "patient_name",
    "config_Patient_telecom.ini": "patient_telecom",
    "config_Practitioner.ini": "practitioner",
    "config_Procedure.ini": "procedure",
}

# Columns to exclude from stage files (none - include all columns)
EXCLUDE_COLUMNS = set()

# Whitelist of columns to include for each table (if empty, includes all columns)
# This dramatically reduces I/O by only materializing columns actually used
INCLUDE_COLUMNS = {
    "allergyintolerance": {
        # Direct columns from core models - ordered as they appear in core query
        "id",
        "onsetdatetime",
        "onsetperiod_start",
        # Clinical status codings (max_index=1)
        *[f"clinicalstatus_coding_{i}_code" for i in range(2)],
        *[f"clinicalstatus_coding_{i}_display" for i in range(2)],
        *[f"clinicalstatus_coding_{i}_system" for i in range(2)],
        # Code codings (max_index=4)
        *[f"code_coding_{i}_code" for i in range(5)],
        *[f"code_coding_{i}_display" for i in range(5)],
        *[f"code_coding_{i}_system" for i in range(5)],
        "meta_source",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        # Reaction columns (max_index=2)
        *[f"reaction_{i}_onset" for i in range(3)],
        *[f"reaction_{i}_severity" for i in range(3)],
        *[f"reaction_{i}_substance_coding_{j}_code" for i in range(3) for j in range(1)],
        *[f"reaction_{i}_substance_coding_{j}_display" for i in range(3) for j in range(1)],
        *[f"reaction_{i}_substance_coding_{j}_system" for i in range(3) for j in range(1)],
        *[f"reaction_{i}_manifestation_{j}_coding_{k}_code" for i in range(3) for j in range(3) for k in range(1)],
        *[f"reaction_{i}_manifestation_{j}_coding_{k}_display" for i in range(3) for j in range(3) for k in range(1)],
        *[f"reaction_{i}_manifestation_{j}_coding_{k}_system" for i in range(3) for j in range(3) for k in range(1)],
        # References last
        "patient_reference",
        "encounter_reference",
        "recorder_reference",
        "asserter_reference",
    },
    "binary": {
        "id", "contenttype", "data", "meta_lastupdated", "meta_source", "patient_id",
    },
    "condition": {
        # Direct columns - ordered as they appear in core query
        "id",
        "recordeddate",
        "onsetdatetime",
        "onsetperiod_start",
        "onsetperiod_end",
        # Code codings (max_index=9)
        *[f"code_coding_{i}_code" for i in range(10)],
        *[f"code_coding_{i}_display" for i in range(10)],
        *[f"code_coding_{i}_system" for i in range(10)],
        # Category codings (max_index=1, secondary_max_index=1)
        *[f"category_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"category_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"category_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        # Clinical status codings (max_index=1)
        *[f"clinicalstatus_coding_{i}_code" for i in range(2)],
        *[f"clinicalstatus_coding_{i}_display" for i in range(2)],
        *[f"clinicalstatus_coding_{i}_system" for i in range(2)],
        "note_0_text",
        # Extensions (max_index=9) - note: column names are lowercase in raw tables
        # Condition needs valueCodeableConcept_* for HCC extension
        *[f"extension_{i}_url" for i in range(10)],
        *[f"extension_{i}_valuestring" for i in range(10)],
        *[f"extension_{i}_valuecoding_code" for i in range(10)],
        *[f"extension_{i}_valuecoding_display" for i in range(10)],
        *[f"extension_{i}_valuecoding_system" for i in range(10)],
        *[f"extension_{i}_valuecodeableconcept_coding_0_code" for i in range(10)],
        *[f"extension_{i}_valuecodeableconcept_coding_0_display" for i in range(10)],
        *[f"extension_{i}_valuecodeableconcept_coding_0_system" for i in range(10)],
        "meta_source",
        # References last
        "subject_reference",
        "encounter_reference",
        "recorder_reference",
    },
    "coverage": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "period_start",
        "period_end",
        "type_coding_0_code",
        "type_coding_0_display",
        "type_coding_0_system",
        "subscriberid",
        "dependent",
        "relationship_coding_0_code",
        "relationship_coding_0_display",
        "relationship_coding_0_system",
        # Class columns (max_index=2) - used by get_coverage_class
        *[f"class_{i}_value" for i in range(2)],
        *[f"class_{i}_type_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"class_{i}_type_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"class_{i}_type_coding_{j}_system" for i in range(2) for j in range(2)],
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "beneficiary_reference",
        "policyholder_reference",
        "subscriber_reference",
        *[f"payor_{i}_reference" for i in range(3)],
    },
    "diagnosticreport": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "effectivedatetime",
        "effectiveperiod_start",
        "effectiveperiod_end",
        # Code codings (max_index=4)
        *[f"code_coding_{i}_code" for i in range(5)],
        *[f"code_coding_{i}_display" for i in range(5)],
        *[f"code_coding_{i}_system" for i in range(5)],
        # Category codings (max_index=1, secondary_max_index=1)
        *[f"category_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"category_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"category_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # Presented forms (max_index=29) - zero-padded format: 00, 01, 02... 09, 10, 11... 29
        *[f"presentedform_{i:02d}_contenttype" for i in range(30)],
        *[f"presentedform_{i:02d}_creation" for i in range(30)],
        *[f"presentedform_{i:02d}_data" for i in range(30)],
        *[f"presentedform_{i:02d}_hash" for i in range(30)],
        *[f"presentedform_{i:02d}_language" for i in range(30)],
        *[f"presentedform_{i:02d}_size" for i in range(30)],
        *[f"presentedform_{i:02d}_title" for i in range(30)],
        *[f"presentedform_{i:02d}_url" for i in range(30)],
        # References last
        "subject_reference",
        "encounter_reference",
        *[f"performer_{i}_reference" for i in range(3)],
        *[f"result_{i:02d}_reference" for i in range(30)],
    },
    "encounter": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "period_start",
        "period_end",
        "class_code",
        "class_display",
        "class_system",
        # Type codings (max_index=1, secondary_max_index=1)
        *[f"type_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"type_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"type_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        # Discharge disposition codings (max_index=1) - only coding_0 is used directly, but macro needs up to index 1
        *[f"hospitalization_dischargedisposition_coding_{i}_code" for i in range(2)],
        *[f"hospitalization_dischargedisposition_coding_{i}_display" for i in range(2)],
        *[f"hospitalization_dischargedisposition_coding_{i}_system" for i in range(2)],
        # Reason codings (max_index=1, secondary_max_index=1)
        *[f"reasoncode_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"reasoncode_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"reasoncode_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        *[f"participant_{i}_individual_reference" for i in range(3)],
        *[f"location_{i}_location_reference" for i in range(3)],
        *[f"diagnosis_{i:02d}_condition_reference" for i in range(30)],
    },
    "immunization": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "occurrencedatetime",
        "occurrencestring",
        # Vaccine code codings (max_index=4)
        *[f"vaccinecode_coding_{i}_code" for i in range(5)],
        *[f"vaccinecode_coding_{i}_display" for i in range(5)],
        *[f"vaccinecode_coding_{i}_system" for i in range(5)],
        "dosequantity_value",
        "dosequantity_unit",
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "patient_reference",
        "encounter_reference",
        "location_reference",
        *[f"performer_{i}_actor_reference" for i in range(3)],
    },
    "medication": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        # Code codings (max_index=4)
        *[f"code_coding_{i}_code" for i in range(5)],
        *[f"code_coding_{i}_display" for i in range(5)],
        *[f"code_coding_{i}_system" for i in range(5)],
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
    },
    "medicationadministration": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "effectivedatetime",
        "effectiveperiod_start",
        "effectiveperiod_end",
        "dosage_dose_unit",
        "dosage_dose_value",
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        "medicationreference_reference",
        *[f"performer_{i}_actor_reference" for i in range(3)],
    },
    "medicationdispense": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "whenhandedover",
        "whenprepared",
        "quantity_unit",
        "quantity_value",
        "dosageinstruction_0_doseandrate_0_dosequantity_unit",
        "dosageinstruction_0_doseandrate_0_dosequantity_value",
        "dayssupply_value",
        "dayssupply_unit",
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        "medicationreference_reference",
        "location_reference",
        *[f"performer_{i}_actor_reference" for i in range(3)],
    },
    "medicationrequest": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "authoredon",
        "intent",
        "dosageinstruction_0_doseandrate_0_dosequantity_unit",
        "dosageinstruction_0_doseandrate_0_dosequantity_value",
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        "medicationreference_reference",
        "encounter_reference",
        "requester_reference",
        *[f"reasonreference_{i}_reference" for i in range(10)],
    },
    "medicationstatement": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "effectivedatetime",
        "effectiveperiod_start",
        "effectiveperiod_end",
        "dosage_0_doseandrate_0_dosequantity_unit",
        "dosage_0_doseandrate_0_dosequantity_value",
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        "medicationreference_reference",
    },
    "observation": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "effectivedatetime",
        "effectiveperiod_start",
        "effectiveperiod_end",
        # Code codings (max_index=4)
        *[f"code_coding_{i}_code" for i in range(5)],
        *[f"code_coding_{i}_display" for i in range(5)],
        *[f"code_coding_{i}_system" for i in range(5)],
        "valuequantity_value",
        "valuestring",
        "valuecodeableconcept_text",
        "valuecodeableconcept_coding_0_display",
        "valuequantity_unit",
        "referencerange_0_high_unit",
        "referencerange_0_low_unit",
        "referencerange_0_low_value",
        "referencerange_0_high_value",
        # Category codings (max_index=2, secondary_max_index=1) - 3 layers until final 2 indices
        *[f"category_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"category_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"category_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        # Interpretation codings (max_index=2, secondary_max_index=1) - 3 layers until final 2 indices
        *[f"interpretation_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"interpretation_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"interpretation_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        # Body site codings (max_index=1)
        *[f"bodysite_coding_{i}_code" for i in range(2)],
        *[f"bodysite_coding_{i}_display" for i in range(2)],
        *[f"bodysite_coding_{i}_system" for i in range(2)],
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        "encounter_reference",
        *[f"performer_{i}_reference" for i in range(3)],
    },
    "procedure": {
        # Direct columns - ordered as they appear in core query
        "id",
        "status",
        "performeddatetime",
        "performedperiod_start",
        "performedperiod_end",
        # Code codings (max_index=4)
        *[f"code_coding_{i}_code" for i in range(5)],
        *[f"code_coding_{i}_display" for i in range(5)],
        *[f"code_coding_{i}_system" for i in range(5)],
        # Body site codings (max_index=2, secondary_max_index=1) - 3 layers until final 2 indices
        *[f"bodysite_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"bodysite_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"bodysite_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        # Reason codings (max_index=2, secondary_max_index=1) - 3 layers until final 2 indices
        *[f"reasoncode_{i}_coding_{j}_code" for i in range(2) for j in range(2)],
        *[f"reasoncode_{i}_coding_{j}_display" for i in range(2) for j in range(2)],
        *[f"reasoncode_{i}_coding_{j}_system" for i in range(2) for j in range(2)],
        "note_0_text",
        # Extensions (max_index=2) - note: column names are lowercase in raw tables
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "subject_reference",
        "encounter_reference",
        "location_reference",
        *[f"performer_{i}_actor_reference" for i in range(3)],
        *[f"report_{i:02d}_reference" for i in range(30)],
    },
    # Patient tables use get_demographic_source_value which needs extensions 0-4
    "patient": {
        # Direct columns - ordered as they appear in core query
        "id",
        "name_0_given_0",
        "name_0_family",
        "gender",
        "birthdate",
        # Identifier columns (first 5 identifiers: 0-4)
        *[f"identifier_{i}_value" for i in range(5)],
        *[f"identifier_{i}_system" for i in range(5)],
        # Extensions (max_index=2) - note: column names are lowercase
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
    },
    "patient_address": {
        # Direct columns - ordered as they appear in core query
        "anchor_index",
        "patient_id",
        *[f"line_{i}" for i in range(5)],
        "city",
        "district",
        "state",
        "postalcode",
        "country",
        # Extensions (0-4 for get_demographic_source_value, limited to first 10)
        *[f"extension_{i}_url" for i in range(5)],
        *[f"extension_{i}_valuecoding_code" for i in range(5)],
        *[f"extension_{i}_valuestring" for i in range(5)],
    },
    "patient_name": {
        # Direct columns - ordered as they appear in core query
        "anchor_index",
        "patient_id",
        "family",
        *[f"given_{i}" for i in range(10)],
        *[f"prefix_{i}" for i in range(5)],
        *[f"suffix_{i}" for i in range(5)],
        # Extensions (0-4 for get_demographic_source_value, limited to first 10)
        *[f"extension_{i}_url" for i in range(5)],
        *[f"extension_{i}_valuecoding_code" for i in range(5)],
        *[f"extension_{i}_valuestring" for i in range(5)],
    },
    "patient_telecom": {
        # Direct columns - ordered as they appear in core query
        "anchor_index",
        "patient_id",
        "system",
        "value",
        # Extensions (0-4 for get_demographic_source_value, limited to first 10)
        *[f"extension_{i}_url" for i in range(5)],
        *[f"extension_{i}_valuecoding_code" for i in range(5)],
        *[f"extension_{i}_valuestring" for i in range(5)],
    },
    "location": {
        # Direct columns - ordered as they appear in core query
        "id",
        "name",
        "type_coding_0_display",
        "physicaltype_coding_0_display",
        "address_0_text",
        *[f"address_{i}_line_0" for i in range(1)],
        *[f"address_{i}_line_1" for i in range(1)],
        *[f"address_{i}_city" for i in range(1)],
        *[f"address_{i}_state" for i in range(1)],
        *[f"address_{i}_country" for i in range(1)],
        *[f"address_{i}_postalcode" for i in range(1)],
        # Extensions (max_index=2) - note: column names are lowercase
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
        # References last
        "managingorganization_reference",
    },
    # Organization, Location, Practitioner - re-analyzed for actual column usage
    "organization": {
        # Direct columns - ordered as they appear in core query
        "id",
        "name",
        *[f"address_{i}_line_0" for i in range(1)],
        *[f"address_{i}_line_1" for i in range(1)],
        *[f"address_{i}_line_2" for i in range(1)],
        *[f"address_{i}_city" for i in range(1)],
        *[f"address_{i}_state" for i in range(1)],
        *[f"address_{i}_country" for i in range(1)],
        *[f"address_{i}_postalcode" for i in range(1)],
        # Extensions (max_index=2) - note: column names are lowercase
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
    },
    "practitioner": {
        # Direct columns - ordered as they appear in core query
        "id",
        "name_0_given_0",
        "name_0_family",
        "qualification_0_code_coding_0_display",
        "qualification_0_code_text",
        # Extensions (max_index=2) - note: column names are lowercase
        *[f"extension_{i}_url" for i in range(3)],
        *[f"extension_{i}_valuestring" for i in range(3)],
        *[f"extension_{i}_valuecoding_code" for i in range(3)],
        *[f"extension_{i}_valuecoding_display" for i in range(3)],
        *[f"extension_{i}_valuecoding_system" for i in range(3)],
        "meta_source",
    },
}


def parse_struct_section(config_path: Path) -> list[str]:
    """Parse the [Struct] section from a config file and return column names."""
    columns = []
    in_struct = False
    
    with open(config_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            
            if line == "[Struct]":
                in_struct = True
                continue
            elif line.startswith("[") and line.endswith("]"):
                in_struct = False
                continue
            
            if in_struct and "=" in line and not line.startswith("#"):
                col_name = line.split("=")[0].strip()
                if col_name.lower() not in EXCLUDE_COLUMNS:
                    columns.append(col_name)
    
    return columns


def generate_stage_sql(source_name: str, columns: list[str]) -> str:
    """Generate a stage SQL file content."""
    sql_lines = [
        "select",
    ]
    
    # Filter columns if whitelist exists for this table
    if source_name in INCLUDE_COLUMNS:
        whitelist = INCLUDE_COLUMNS[source_name]
        columns = [col for col in columns if col in whitelist]
        print(f"  Filtered to {len(columns)} columns (from whitelist)")
    
    # Add columns - each on its own line
    for col in columns:
        if (source_name == "coverage" and col == "order"):
            continue
        sql_lines.append(f"    t.{col},")
    
    # Add metadata columns
    sql_lines.extend([
        "    t.m_patient_id,",
        "    t.m_job_id,",
        "    t.m_created_at,",
        "    t.m_updated_at,",
        "    t.m_deleted_at,",
        "    '{{ var('input_job_id') }}' as raw_to_core_job_id",
        f"from {{{{ source('raw', '{source_name}_active' if target.name == 'postgres' else '{source_name}') }}}} as t",
        f"inner join {{{{ source('raw', 'latest_metriport_incremental_job') }}}} j on t.m_patient_id = j.m_patient_id and t.m_job_id = j.id and j.m_created_at > '{{{{ var(\"lookback_timestamp\") }}}}'::timestamp",
        f"\n"
    ])
    
    return "\n".join(sql_lines)


def main():
    """Generate stage SQL files for all config files."""
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    
    for config_name, source_name in CONFIG_TO_SOURCE.items():
        config_path = CONFIG_DIR / config_name
        
        if not config_path.exists():
            print(f"Warning: Config file not found: {config_path}")
            continue
        
        columns = parse_struct_section(config_path)
        
        if not columns:
            print(f"Warning: No columns found in {config_name}")
            continue
        
        sql_content = generate_stage_sql(source_name, columns)
        
        output_path = STAGE_DIR / f"stage__{source_name}.sql"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(sql_content)
        
        print(f"Generated: {output_path.name} ({len(columns)} columns)")
    
    print("\nAll stage files generated successfully!")


if __name__ == "__main__":
    main()

