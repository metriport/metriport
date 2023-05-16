from locust import HttpLocust, TaskSet, task
import base64

class UserBehavior(TaskSet):

    msg_encoded = "TVNIfF5+XCZ8TklTVCBUZXN0IExhYiBBUFB8TklTVCBMYWIgRmFjaWxpdHl8fE5JU1QgRUhSIEZhY2lsaXR5fDIwMTEwNTMxMTQwNTUxLTA1MDB8fE9SVV5SMDFeT1JVX1IwMXxOSVNULUxSSS1ORy0wMDIuMDB8VHwyLjUuMXx8fEFMfE5FfHx8fHxMUklfQ29tbW9uX0NvbXBvbmVudF5eMi4xNi44NDAuMS4xMTM4ODMuOS4xNl5JU09+TFJJX05HX0NvbXBvbmVudF5eMi4xNi44NDAuMS4xMTM4ODMuOS4xM15JU09+TFJJX1JVX0NvbXBvbmVudF5eMi4xNi44NDAuMS4xMTM4ODMuOS4xNF5JU08KUElEfDF8fFBBVElEMTIzNF5eXk5JU1QgTVBJXk1SfHxKb25lc15XaWxsaWFtXkF8fDE5NjEwNjE1fE18fDIxMDYtM15XaGl0ZV5ITDcwMDA1Ck9SQ3xSRXxPUkQ2NjY1NTVeTklTVCBFSFJ8Ui05OTExMzNeTklTVCBMYWIgRmlsbGVyfEdPUkQ4NzQyMzNeTklTVCBFSFJ8fHx8fHx8fDU3NDIyXlJhZG9uXk5pY2hvbGFzXl5eXl5eTklTVC1BQS0xXkxeXl5OUEkKT0JSfDF8T1JENjY2NTU1Xk5JU1QgRUhSfFItOTkxMTMzXk5JU1QgTGFiIEZpbGxlcnw1NzAyMS04XkNCQyBXIEF1dG8gRGlmZmVyZW50aWFsIHBhbmVsIGluIEJsb29kXkxOXjQ0NTY1NDReQ0JDXjk5VVNJXl5eQ0JDIFcgQXV0byBEaWZmZXJlbnRpYWwgcGFuZWwgaW4gQmxvb2R8fHwyMDExMDEwMzE0MzQyOC0wODAwfHx8fHx8fHx8NTc0MjJeUmFkb25eTmljaG9sYXNeXl5eXl5OSVNULUFBLTFeTF5eXk5QSXx8fHx8fDIwMTEwMTA0MTcwMDI4LTA4MDB8fHxGfHx8MTAwOTNeRGVsdWNhXk5hZGR5Xl5eXl5eTklTVC1BQS0xXkxeXl5OUEl8fHx8fHx8fHx8fHx8fHx8fHx8fHxDQ15DYXJib24gQ29weV5ITDcwNTA3Ck9CWHwxfE5NfDI2NDUzLTFeRXJ5dGhyb2N5dGVzIFsjL3ZvbHVtZV0gaW4gQmxvb2ReTE5eXl5eXl5Fcnl0aHJvY3l0ZXMgWyMvdm9sdW1lXSBpbiBCbG9vZHx8NC40MXwxMCo2L3VMXm1pbGxpb24gcGVyIG1pY3JvbGl0ZXJeVUNVTXw0LjMgdG8gNi4yfE58fHxGfHx8MjAxMTAxMDMxNDM0MjgtMDgwMHx8fHx8MjAxMTAxMDMxNjM0MjgtMDgwMHx8fHxDZW50dXJ5IEhvc3BpdGFsXl5eXl5OSVNULUFBLTFeWFheXl45ODd8MjA3MCBUZXN0IFBhcmteXkxvcyBBbmdlbGVzXkNBXjkwMDY3Xl5CfDIzNDMyNDJeS25vd3NhbG90XlBoaWxeXl5Eci5eXl5OSVNULUFBLTFeTF5eXkROCg=="
    msg_decoded = base64.b64decode(msg_encoded)

    def on_start(self):
        """ on_start is called when a Locust start before any task is scheduled """
        pass

    def on_stop(self):
        """ on_stop is called when the TaskSet is stopping """
        pass

    @task(1)
    def profile(self):
        self.client.headers.update({'content-type': 'text/plain'})
        self.client.post("/api/convert/hl7/ADT_A01.hbs", data=self.msg_decoded)
    
class WebsiteUser(HttpLocust):
    task_set = UserBehavior
    min_wait = 0
    max_wait = 1

