select 
    metric_name,
    invalid,
    total,
    percent_invalid
FROM (
    select 
        'diagnosticreport_id' as metric_name,
        sum(
            case 
                when id = '' or id is null
                then 1 
                else 0 
            end
        ) as invalid,
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
) as t1
UNION ALL (
    select 
        'diagnosticreport_identifier' as metric_name,
        sum(
            case 
                when (identifier_0_value = '' or identifier_0_value is null) or
                     (identifier_0_system = '' or identifier_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.identifier
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_status' as metric_name,
        sum(
            case 
                when status not in (
                    'registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown'
                )
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/valueset-diagnostic-report-status.html
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_category' as metric_name,
        sum(
            case 
                when (category_0_coding_0_code = '' or category_0_coding_0_code is null) or
                     (category_0_coding_0_system = '' or category_0_coding_0_system is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.category
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_code' as metric_name,
        sum(
            case 
                when (code_text = '' or code_text is null) and
                     ((code_coding_0_code = '' or code_coding_0_code is null) or
                      (code_coding_0_system = '' or code_coding_0_system is null))
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.code
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_subject' as metric_name,
        sum(
            case 
                when subject_reference = '' or subject_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.subject
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_encounter' as metric_name,
        sum(
            case 
                when encounter_reference = '' or encounter_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.encounter
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_effective' as metric_name,
        sum(
            case 
                when (effectiveperiod_start = '' or effectiveperiod_start is null) and 
                     (effectiveperiod_end = '' or effectiveperiod_end is null) and
                     (effectivedatetime = '' or effectivedatetime is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.effective[x]
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_performer' as metric_name,
        sum(
            case 
                when performer_0_reference = '' or performer_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.performer
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_result' as metric_name,
        sum(
            case 
                when result_0_reference = '' or result_0_reference is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.specimen
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_conclusion' as metric_name,
        sum(
            case 
                when conclusion = '' or conclusion is null
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.conclusion
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)
UNION ALL (
    select 
        'diagnosticreport_presented_form' as metric_name,
        sum(
            case 
                when (presentedform_0_contenttype = '' or presentedform_0_contenttype is null) or
                     (presentedform_0_data = '' or presentedform_0_data is null)
                then 1 
                else 0 
            end
        ) as invalid,  //https://hl7.org/fhir/R4/diagnosticreport-definitions.html#DiagnosticReport.presentedForm
        count(*) as total,
        round(invalid * 100 / total, 2) as percent_invalid
    from diagnosticreport 
)

/*
MISSING FHIR R4 DIAGNOSTICREPORT FIELDS NOT MAPPED IN CONFIGURATION:
Reference: https://hl7.org/fhir/R4/diagnosticreport.html

// - baseOn: Details concerning a service requested
// - issued: The date and time that this version of the report was made available to providers, typically after the report was reviewed and verified
// - resultInterpreter: The practitioner or organization that is responsible for the report's conclusions and interpretations
// - specimen: Details about the specimens on which this diagnostic report is based
// - imagingStudy: One or more links to full details of any imaging performed during the diagnostic investigation
// - media: A list of key images associated with this report
// - conclusionCode: One or more codes that represent the summary conclusion (interpretation/impression) of the diagnostic report
*/