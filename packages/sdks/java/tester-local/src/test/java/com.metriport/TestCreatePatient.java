package com.metriport;

import com.metriport.generated.Metriport;
import com.metriport.generated.resources.medical.patient.requests.PatientCreate;
import com.metriport.generated.resources.medical.patient.types.BasePatient;
import com.metriport.generated.resources.medical.patient.types.PersonalIdentifier;
import com.metriport.generated.resources.medical.patient.types.DriversLicense;
import com.metriport.generated.resources.medical.patient.types.Ssn;
import com.metriport.generated.resources.commons.types.Address;
import com.metriport.generated.resources.commons.types.UsState;
import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Arrays;

public class TestCreatePatient {
    @Test
    public void createPatient() {
        Dotenv dotenv = Dotenv.load();

        String apiKey = dotenv.get("API_KEY");
        String facilityId = dotenv.get("FACILITY_ID");
        String baseUrl = dotenv.get("BASE_URL");

        Metriport client = Metriport.builder()
                .apiKey(apiKey)
                .url(baseUrl)
                .build();

        DriversLicense driversLicense = DriversLicense.builder()
                .state(UsState.CA)
                .value("12345678")
                .build();

        PersonalIdentifier personalIdentifierDL = PersonalIdentifier.driversLicense(driversLicense);

        Ssn ssn = Ssn.builder()
                .value("123456789")
                .build();

        PersonalIdentifier personalIdentifierSSN = PersonalIdentifier.ssn(ssn);

        BasePatient patientData = BasePatient.builder()
                .firstName("John")
                .lastName("Doe")
                .dob("1980-01-01")
                .genderAtBirth("M")
                .personalIdentifiers(Arrays.asList(personalIdentifierDL, personalIdentifierSSN))
                .address(Collections.singletonList(
                        Address.builder()
                                .addressLine1("123 Main St")
                                .city("Los Angeles")
                                .state(UsState.CA)
                                .zip("90001")
                                .country("USA")
                                .build()
                ))
                .build();

        PatientCreate request = PatientCreate.builder()
                .facilityId(facilityId)
                .body(patientData)
                .build();

        var response = client.medical().patient().create(request);
        System.out.println("Received patient with ID: " + response.getId());
    }
}
