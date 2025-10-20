from canvas_sdk.effects import Effect
from canvas_sdk.effects.launch_modal import LaunchModalEffect
from canvas_sdk.handlers.application import Application

METRIPORT_DASH_URL = "https://ehr.metriport.com/canvas/app"
METRIPORT_TOKEN_SECRET = "METRIPORT_MODAL_TOKEN"

class MetriportApp(Application):
    """An embeddable application that can load the Metriport patient data into the canvas patient modal."""

    def on_open(self) -> Effect:
        """Handle the on_open event."""
        metriport_token = self.secrets[METRIPORT_TOKEN_SECRET]
        if (metriport_token is None):
          raise Exception("Metriport token not set")
        if (metriport_token == ""):
          raise Exception("Metriport token is empty")
        patient_id = self.context['patient']['id']
        practitioner_id = self.context['user']['id']
        url = f"{METRIPORT_DASH_URL}#patient={patient_id}&practitioner={practitioner_id}&access_token={metriport_token}"
        return LaunchModalEffect(url=url, target=LaunchModalEffect.TargetType.RIGHT_CHART_PANE_LARGE).apply()
