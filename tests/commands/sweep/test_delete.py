import json
import os
from copy import deepcopy
from unittest.mock import MagicMock

from lightning.app.storage import Drive

from lightning_hpo.commands.sweep.delete import DeleteSweepConfig
from lightning_hpo.components.sweep import Sweep, SweepConfig
from lightning_hpo.controllers.sweep import SweepController
from lightning_hpo.utilities.enum import Stage


def test_delete_sweeps_server(monkeypatch, tmpdir):

    with open(os.path.join(os.path.dirname(__file__), "sweep_1.json"), "rb") as f:
        data = json.load(f)

    sweep_config = SweepConfig(**data[0])
    trial = deepcopy(sweep_config.experiments[0])
    trial.stage = Stage.RUNNING
    sweep_config.experiments[1] = trial
    sweep_config.logger = "streamlit"
    sweep = Sweep.from_config(config=sweep_config)

    sweep_controller = SweepController(Drive("lit://code"))
    db = MagicMock()
    sweep_controller._database = db
    sweep_controller.r[sweep_config.sweep_id] = sweep
    result = sweep_controller.delete_sweep(config=DeleteSweepConfig(sweep_id=sweep_config.sweep_id))
    assert result == "Deleted the sweep `thomas-cb8f69f0`"
    assert sweep_controller.r == {}
