from canvas_sdk.effects import Effect
from canvas_sdk.effects.launch_modal import LaunchModalEffect
from canvas_sdk.handlers.application import Application

from metriport_app.utils.shared import (
  METRIPORT_DASH_URL,
  get_metriport_token,
  get_patient_id,
)

class MetriportApp(Application):
    """An embeddable application that can load the Metriport patient data into the canvas patient modal."""

    def on_open(self) -> Effect:
        """Handle the on_open event."""
        # To be used once Ouath flow is implemented
        #oauth_client_id = self.secrets['OUATH_CLIENT_ID']
        #canvas_domain = self.secrets['CANVAS_DOMAIN']
        metriport_token = get_metriport_token(self.secrets)
        patient_id = get_patient_id(self.context)

        return LaunchModalEffect(url=f"{METRIPORT_DASH_URL}#patient={patient_id}&access_token={metriport_token}", target=LaunchModalEffect.TargetType.RIGHT_CHART_PANE_LARGE).apply()
