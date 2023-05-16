⚠ **This document applies to the Handlebars engine. Follow [this](https://github.com/microsoft/FHIR-Converter/tree/dotliquid) link for the documentation of Liquid engine.** <br></br>

# Web UI Auto-Update Issue

This is a known issue for old installation(v1.0.0) users that the converter UI gets updated to v2.0.0 version automatically and users' previous templates are no longer visible.

# Cause

This issue is caused by the `latest` tag of the docker image in the deployment template file. After v2.0.0 is released, the `latest` image is updated to the v2.0.0 version that supports C-CDA files and is not compatible with the previous v1.0.0. When you restart the converter service, it will stop the current container and pull the updated docker image to restart. As a result, the UI of old deployments is updated to new UI automatically.

# Solution

If you encounter this issue, the solution is to rollback the container image. Since all the templates data are stored in a [persistent shared storage](https://docs.microsoft.com/en-us/azure/app-service/containers/configure-custom-container#use-persistent-shared-storage), rolling back the container image will restore your previous templates.

## Rollback via Azure CLI

Log in to **Azure CLI**, and type the following command

```powershell
az webapp config container set --name [ConverterAppServiceName] --resource-group [ResourceGroupName] --docker-custom-image-name "healthplatformregistry.azurecr.io/fhirconverter:v1.0.0" --enable-app-service-storage true
```

Then restart the container, you will see the old UI back.

## Rollback via Azure Portal

1. Sign in to **Azure Portal** and navigate to your converter service.
2. Select **Container settings**.
3. Change **Image source** to **Docker Hub** tab, then enter the **Full Image Name and Tag** and **Startup File**. In this case, the value should be `healthplatformregistry.azurecr.io/fhirconverter:v1.0.0` and `./deploy/webapp.sh`.
4. Click **Save** button.
5. The converter service will restart automatically. Wait 3-5 minutes, you will see the old UI back.

![change container image](./images/change-container-image-tag.png)
