import os
import time
from subprocess import Popen
from uuid import uuid4

from lightning import LightningWork
from lightning.app.storage import Drive
from lightning.app.storage.path import filesystem


class Tensorboard(LightningWork):
    def __init__(self, *args, component_name: str, drive: Drive, sleep: int = 5, **kwargs):
        super().__init__(*args, **kwargs)
        self.component_name = component_name
        self.drive = drive
        self.sleep = sleep

    def run(self):
        local_folder = f"./tensorboard_logs/{uuid4()}"
        self.drive.component_name = self.component_name

        os.makedirs(local_folder, exist_ok=True)

        # Note: Used tensorboard built-in sync methods but it doesn't seem to work.
        cmd = f"tensorboard --logdir={local_folder} --host {self.host} --port {self.port}"
        self._process = Popen(cmd, shell=True, env=os.environ)

        fs = filesystem()

        while True:
            fs.get(str(self.drive.root), local_folder)
            time.sleep(self.sleep)

    def on_exception(self, exception):
        self._process.kill()
        super().on_exception(exception)

    @property
    def updates(self):
        return []
