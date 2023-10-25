package com.metriport.test;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.metriport.api.Metriport;
import com.metriport.api.resources.medical.MedicalClient;
import com.metriport.api.resources.medical.facility.types.Facility;
import com.metriport.api.resources.medical.organization.types.Organization;
import com.metriport.api.resources.medical.patient.requests.PatientList;
import com.metriport.api.resources.medical.patient.types.Patient;

public class Main {
  private static final Logger log = LoggerFactory.getLogger(Main.class);

  private static final String API_KEY = System.getProperty("api_key");

  public static void main(String[] args) {
    if (API_KEY == null) {
      log.error("Please provide an API key as a system property (e.g. -Dapi_key=...)");
      System.exit(1);
    }

    log.info("Querying Metriport API... ");
    MedicalClient api = Metriport.builder()
        .apiKey(API_KEY)
        // .url("https://api.sandbox.metriport.com/medical/v1")
        .build().medical();

    log.info("Getting organization...");
    Organization org = api.organization().get();
    log.info(org.getName());

    log.info("Listing facilities...");
    List<Facility> facilities = api.facility().list();

    for (Facility facility : facilities) {
      log.info(facility.getName());

      log.info(String.format("Listing patients of facility '%s'...", facility.getName()));
      PatientList filter = PatientList.builder().facilityId(facility.getId()).build();
      List<Patient> patients = api.patient().list(filter);

      log.info(String.format("...got %d patients, listing them...", patients.size()));
      for (Patient patient : patients) {
        log.info(patient.getFirstName() + " " + patient.getLastName());
      }
      log.info("");
    }

  }
}
