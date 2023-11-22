package com.metriport.test;

import io.github.cdimascio.dotenv.Dotenv;
import com.metriport.api.Metriport;
import com.metriport.api.resources.medical.facility.types.BaseFacility;
import com.metriport.api.resources.commons.types.UsState;
import com.metriport.api.resources.commons.types.Address;

public class CreateFacility {
    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        Address address = Address.builder()
            .addressLine1("2261 Market Street")
            .city("San Francisco")
            .state(UsState.CA)
            .zip("12345")
            .country("USA")
            .addressLine2("#4818")
            .build();

        BaseFacility newFacility = BaseFacility.builder()
            .name("New Facility")
            .npi("1234567893")
            .address(address)
            .build();

        var response = metriport.medical().facility().create(newFacility);
        System.out.println("Created new facility!" + response);
    }
}