import os
import json
import sys

def count_compressable_resources(directory):
    resource_counts = {}
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                file_path = os.path.join(root, file)
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    if not isinstance(data, dict):
                        print(f"Skipping file {file_path} as it contains a JSON array at the top level.")
                        continue
                    for entry in data.get("entry", []):
                        resource = entry.get("resource")
                        resource_type = resource.get("resourceType")
                        resource_id = resource.get("id")
                        index = f"{resource_type}_{resource_id}"
                        resource_counts[index] = resource_counts.get(index, 0) + 1
    return resource_counts


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)
    directory = sys.argv[1]
    compressed_resources_count = count_compressable_resources(directory)
    sorted_resources = sorted(compressed_resources_count.items(), key=lambda x: x[1], reverse=True)[:100]

    for resource_type, count in sorted_resources:
        print(f"{resource_type}: {count}")


    
# Practitioner_b67ddb71-ba3d-332d-9b76-d648d14ed9bc: 3844 - device identifier one
# Practitioner_f51476d1-6292-3891-a38c-41e383e85b2f: 2429 - random practitioner
# Practitioner_c774746b-9264-3992-badf-94403b104709: 2294 - device identifier one
# Practitioner_fdbe0f4d-c327-397b-8518-79148e4c047d: 2080 - device identifier one

# Observation_51a59484-6a1f-3b67-a62f-cdd78596cfa2: 1088 - empty sexual history 
# Observation_df6ab7b4-9ec7-35ee-8ed2-d888300bee46: 987 - empty gender identity
# Observation_daf0fdd4-7393-3e51-adb4-e6de0222d361: 631 
# Observation_f95d5bea-a340-394f-a122-99268d03774b: 629

# Organization_57b4926d-9f48-3b11-a772-fdee1e9c13b7: 610
# Observation_1fc83e98-6816-34ca-8eaf-122ffe809265: 570
# Practitioner_d3c48d95-3882-35cc-94ed-01ce6fdef92b: 567
# Organization_10da5724-b4bd-31e3-bb8d-ebde24051c11: 488
# Organization_873dcb1e-e88a-31dc-b325-e8d920a05624: 484
# Practitioner_a3ce0216-dfbe-3617-a716-d9cb0199a5c6: 473
# Practitioner_fb8d3676-a106-39f1-a5be-7fd974ae54b0: 446
# Observation_e5a91e43-de13-3352-b67e-83b42a3900e0: 422
# Practitioner_8b88a588-9a4e-3b93-a1e8-57fbf3134231: 395
# Organization_58b1e690-88e4-3d06-8e4e-f76b9bb0f8a2: 392
# RelatedPerson_91e2f0f2-2dd9-32cd-a108-2a1e397898c1: 389
# Observation_33a576b3-6279-338b-9395-969e97e4cf37: 387
# Practitioner_63d41487-b422-37b3-a697-abb394dabed0: 380
# Organization_21b19d5a-a092-371b-aadd-875a3aeae10d: 364
# Observation_45689f4b-cf63-3ba8-aa26-81044ec62350: 335
# Organization_8eff9c99-36c0-3733-ac7d-3529abd3f93e: 334
# RelatedPerson_9daad78d-4325-3a2e-a840-57286e226379: 334
# Practitioner_4fb99af7-940c-3309-8121-9818c7ad95b8: 327
# Organization_fd670c96-b377-3514-ad06-3775218410f2: 308
# Observation_57870a97-222c-3dc8-881f-32717643f17f: 297
# Observation_c2abe42e-623d-3846-bd81-45c9e45d7e3c: 288
# Organization_1a0e391e-1809-34d9-a083-44a34b41d281: 285
# Organization_ce3a741b-da72-3727-9244-0273b7efb1f0: 264
# RelatedPerson_296c702e-cda5-354b-b5b4-6974fd58c19a: 261
# RelatedPerson_93e58502-8c9b-306d-8df4-fcafd08b60a7: 261
# RelatedPerson_e79f95d3-c5b7-31bb-befb-6ee03909e0e5: 261
# RelatedPerson_0321dff5-152d-37b1-84d0-bf63a241f8d0: 261
# Practitioner_d3c58aa0-2492-3a15-95c9-476ae3333b30: 261
# Practitioner_2fd549aa-8ad1-36a7-a723-fc6eb87a932e: 254
# Observation_974c8b80-958f-3152-a680-74dde85f1450: 253
# Practitioner_584accd7-0ef9-34e3-9aa3-c3c808da74da: 252
# Observation_928eaf8b-9195-3748-9ac9-38dde48d8eab: 246
# RelatedPerson_897630af-d71c-3d56-b63c-77874884e395: 240
# RelatedPerson_2a941270-6e82-37d7-9911-4823626335c5: 240
# Observation_9f8bd985-896c-3353-a243-7da4e96e5201: 240
# Observation_3481db4e-d264-3634-91d7-7cdfc6263de9: 240
# Observation_86a87761-0c25-3b75-ad49-ac3acf30c66c: 240
# Observation_7ae7bc4c-3232-3cae-86f0-a910c504d0ab: 240
# Observation_69cd1d03-b13d-38b0-b073-7f81c62e039d: 240
# Observation_39b61c41-cd62-3d14-89ac-c41fa2ed9c6d: 240
# Observation_67c1f746-4a7b-32df-bd47-28a72721bc2d: 240
# Observation_38e13ba2-4ee9-3711-856b-3961748b38bb: 240
# Observation_2231cf28-46c4-37cf-9f54-b0677367d00a: 230
# Practitioner_a1b49392-b964-392e-b273-d72e1fd9869f: 215
# Organization_2b9bb124-3332-342a-ae9a-ce9980dbb74c: 215
# Observation_6098cfc5-7ace-36a4-8a48-73befb23f00d: 215
# RelatedPerson_629cf3e0-d29b-37e8-bcb9-ba5bb56bc867: 214
# RelatedPerson_d5628c5b-09a9-35f2-b344-53af08fdefa6: 214
# Organization_10d0d6bf-58cf-38fb-9a2a-b59d6205e60e: 212
# Observation_9a293f47-bdd5-35a9-b352-c630e0575f63: 205
# Observation_f67e5462-6805-3bae-abec-6d44b6f3ca6c: 204
# Observation_f309d1c3-2f52-38e0-bcb4-1dee34116cda: 202
# Organization_7e750b7b-3027-3b2d-a8e5-f578210e868c: 201
# RelatedPerson_eb184d73-8d67-342c-b635-ac5a811bd1b9: 201
# Observation_62045fd3-4b5f-3718-acc0-d8a17f341136: 201
# Observation_2042f1ad-a8d1-36ba-8620-44c310a59264: 201
# Observation_30671f15-4cc0-3066-8f63-7680a21adfc0: 201
# Observation_dd103a15-eff1-37e5-bcfe-f979721517aa: 201
# Observation_f7594797-ecb4-35b9-ae04-f5d68776c289: 201
# Observation_2ceb517d-c42d-3698-99dd-b81aa7b2a39e: 201
# Observation_1246fa50-57f7-36af-8975-b9f93b0973f6: 201
# Observation_3a3895f5-2bac-3e2f-a4df-79bf403180c5: 201
# RelatedPerson_d466a815-daef-3a11-9a8c-48d32ca0294c: 201
# RelatedPerson_a27cea92-aef7-38a1-8ed9-56cf31c11269: 201
# Organization_a98832ef-c503-3bc8-b744-4fa994fc67a8: 200
# RelatedPerson_b01f1ca9-322c-38d3-b999-ae18d9d05c31: 200
# Observation_aa3e6d15-be32-3c7b-913a-0a3cd5f75fcf: 199
# Organization_5c2c4124-4ff4-348e-8b94-8abe60c48be1: 198
# Practitioner_cf7dd8e2-d632-3bbd-acd4-12511d9999fa: 197
# RelatedPerson_ef771f39-4e5b-3acb-9be7-0f727621baa9: 194
# RelatedPerson_09cfb610-2b7b-3930-aadf-e6d051127ecc: 191
# RelatedPerson_fc31d1f9-ba01-3926-b235-3cc729164224: 191
# Practitioner_45db62cb-1b4f-3f0e-b23c-97419aebb583: 186
# Organization_d518ec32-5067-3080-9c9e-55a66f1ef9c6: 186
# Practitioner_f3400e35-f0fa-3fb6-976d-b7e86a194a30: 181
# Organization_a176b01f-a1bc-32ad-8682-abe086fe0ded: 181
# Practitioner_a2e4acc7-53f7-37ef-ace1-2f3bb022f608: 181
# Organization_ff58871d-1e8e-3167-8b50-40dcca64c715: 181
# Practitioner_44db9bf8-15a6-3643-8a67-d5a8fd45f4c7: 180
# Organization_5a9ebd48-346d-3e4e-9e94-995607657ff0: 180
# RelatedPerson_2b299839-0602-3254-9720-a000f1a38a1f: 175
# Observation_991aa3ed-8d52-3711-807f-b69ebf04d8c0: 172
# Organization_4d1bb494-309a-34fb-9eb1-e0152c46d7bc: 170
# Practitioner_6bdfc4e1-005c-3714-970e-a695d29aaaa6: 166
# Observation_a9ef3c81-8fce-3822-be0e-e10f5cdb1c0e: 166
# Location_c54dc9a7-930c-39f1-858c-f569e1868e39: 161
# Organization_ef849d72-35aa-3e5a-8103-e4f6735e5506: 161
# Practitioner_c872aab8-e39e-3bec-98ee-a26b575ddd02: 155
# Observation_98ba6261-899c-329c-be15-ad8b43a38b62: 155
# Observation_a1dd692f-295a-3254-a671-39b1d90f2df5: 155
# Organization_bd0576b4-8297-3bce-8059-57a35980ecdb: 152
# Practitioner_bb63da02-e041-360d-9fa2-3c84001a03ea: 152