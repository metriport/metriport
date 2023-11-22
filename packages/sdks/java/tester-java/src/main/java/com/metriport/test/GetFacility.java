package com.metriport.test;

import io.github.cdimascio.dotenv.Dotenv;
import com.metriport.api.Metriport;
public class GetFacility {
    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        var response_all = metriport.medical().facility().list();
        System.out.println("All facilities:" + response_all);
    
        var response = metriport.medical().facility().get(dotenv.get("FACILITY_ID"));
        System.out.println("Specific facility" + response);
    }
}
