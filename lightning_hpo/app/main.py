import os
import re

from lightning import LightningFlow
from lightning.app.storage import Drive
from lightning.app.storage.path import filesystem, shared_storage_path

from lightning_hpo.commands.artefacts.show import ShowArtefactsCommand, ShowArtefactsConfig
from lightning_hpo.commands.notebook import RunNotebookConfig
from lightning_hpo.commands.sweep.run import SweepConfig
from lightning_hpo.components.servers.db.server import Database
from lightning_hpo.components.servers.db.visualization import DatabaseViz
from lightning_hpo.components.servers.file_server import FileServer
from lightning_hpo.controllers.notebook import NotebookController
from lightning_hpo.controllers.sweeper import SweepController


class MainFlow(LightningFlow):
    def __init__(self, debug: bool = False):
        super().__init__()
        self.debug = debug

        # 1: General managers
        self.drive = Drive("lit://code")
        self.file_server = FileServer(self.drive)
        self.db = Database(models=[SweepConfig, RunNotebookConfig])

        if self.debug:
            self.db_viz = DatabaseViz()

        # 2: Controllers
        self.sweep_controller = SweepController(self.drive)
        self.notebook_controller = NotebookController()

    def run(self):
        # 1: Start the servers.
        self.file_server.run()
        self.db.run()
        if self.debug:
            self.db_viz.run()

        # 2: Wait for the servers to be alive
        if not (self.file_server.alive() and (self.db.alive() if self.debug else True)):
            return

        # 3: Run the controllers
        self.sweep_controller.run(self.db.url)
        self.notebook_controller.run(self.db.url)

    def configure_layout(self):
        tabs = [{"name": "Dashboard", "content": self.sweep_controller}]
        if self.debug:
            tabs += [{"name": "Database Viz", "content": self.db_viz}]
        for sweep in self.sweep_controller.sweeps.values():
            if sweep.show:
                tabs += sweep.configure_layout()
        return tabs

    def show_artefacts(self, config: ShowArtefactsConfig):
        fs = filesystem()
        paths = []
        if config.filter_regex:
            pattern = re.compile(config.filter_regex)

        shared_storage = shared_storage_path()
        for root_dir, _, files in fs.walk(shared_storage):
            root_dir = str(root_dir).replace(str(shared_storage), "").replace("/artifacts/root.", "root/")
            for f in files:
                path = os.path.join(root_dir, f)
                if config.filter_regex:
                    if len(pattern.findall(path)):
                        paths.append(path)
                else:
                    paths.append(path)
        return paths

    def configure_commands(self):
        controller_commands = self.sweep_controller.configure_commands() + self.notebook_controller.configure_commands()
        controller_commands += [{"show artefacts": ShowArtefactsCommand(self.show_artefacts)}]
        return controller_commands
