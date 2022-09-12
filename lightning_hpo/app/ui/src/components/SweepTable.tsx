import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Typography } from '@mui/material';
import { Box, Button, IconButton, Link, Stack, Table } from 'lightning-ui/src/design-system/components';
import Status, { StatusEnum } from 'lightning-ui/src/shared/components/Status';
import React from 'react';
import { AppClient, SweepConfig, TensorboardConfig, TrialConfig } from '../generated';
import useClientDataState from '../hooks/useClientDataState';
import { getAppId } from '../utilities';
import UserGuide, { UserGuideBody, UserGuideComment } from './UserGuide';

const appClient = new AppClient({
  BASE:
    window.location != window.parent.location
      ? document.referrer.replace(/\/$/, '').replace('/view/undefined', '')
      : document.location.href.replace(/\/$/, '').replace('/view/undefined', ''),
});

const statusToEnum = {
  not_started: StatusEnum.NOT_STARTED,
  pending: StatusEnum.PENDING,
  running: StatusEnum.RUNNING,
  pruned: StatusEnum.DELETED,
  succeeded: StatusEnum.SUCCEEDED,
  failed: StatusEnum.FAILED,
  stopped: StatusEnum.STOPPED,
} as { [k: string]: StatusEnum };

function trialToRows(trials: Record<string, TrialConfig>) {
  return Object.entries(trials).map(entry => [
    <Status status={entry[1].stage ? statusToEnum[entry[1].stage] : StatusEnum.NOT_STARTED} />,
    entry[0],
    String(entry[1].best_model_score),
    ...Object.entries(entry[1].params.params).map(value => String(value[1])),
    entry[1].exception,
  ]);
}

function generateTrialHeader(trialHeader: string[], params) {
  const paramsHeader = Object.entries(params).map(entry => entry[0]);
  return trialHeader.concat(paramsHeader).concat(['Exception']);
}

function createLoggerUrl(url?: string) {
  const cell = url ? (
    <Link href={url} target="_blank" underline="hover">
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <OpenInNewIcon sx={{ fontSize: 20 }} />
        <Typography variant="subtitle2">Open</Typography>
      </Stack>
    </Link>
  ) : (
    <Box>{StatusEnum.NOT_STARTED}</Box>
  );

  return cell;
}

function stopTensorboard(tensorboardConfig?: TensorboardConfig) {
  appClient.appCommand.stopTensorboardCommandStopTensorboardPost({ sweep_id: tensorboardConfig.sweep_id });
}

function runTensorboard(tensorboardConfig?: TensorboardConfig) {
  appClient.appCommand.runTensorboardCommandRunTensorboardPost({
    id: tensorboardConfig.id,
    sweep_id: tensorboardConfig.sweep_id,
    shared_folder: tensorboardConfig.shared_folder,
    stage: StatusEnum.RUNNING.toLowerCase(),
    desired_stage: StatusEnum.RUNNING.toLowerCase(),
    url: undefined,
  });
}

function createLoggerControl(tensorboardConfig?: TensorboardConfig) {
  const status = tensorboardConfig?.stage ? statusToEnum[tensorboardConfig.stage] : StatusEnum.NOT_STARTED;
  if (status == StatusEnum.RUNNING) {
    return tensorboardConfig.url ? <Button onClick={_ => stopTensorboard(tensorboardConfig)} text="Stop" /> : null;
  } else if (status == StatusEnum.STOPPED) {
    return <Button onClick={_ => runTensorboard(tensorboardConfig)} text="Run" />;
  } else {
    return <Status status={status} />;
  }
}

export function Sweeps() {
  const tensorboards = useClientDataState('tensorboards') as TensorboardConfig[];
  const sweeps = useClientDataState('sweeps') as SweepConfig[];

  if (sweeps.length == 0) {
    return (
      <UserGuide title="Want to start a hyper-parameter sweep?" subtitle="Use the commands below">
        <UserGuideComment>Connect to the app</UserGuideComment>
        <UserGuideBody>{`lightning connect ${getAppId()} --yes`}</UserGuideBody>
        <UserGuideComment>Download example script</UserGuideComment>
        <UserGuideBody>
          {
            'wget https://raw.githubusercontent.com/Lightning-AI/lightning-hpo/master/examples/scripts/train.py > train.py'
          }
        </UserGuideBody>
        <UserGuideComment>Run a sweep</UserGuideComment>
        <UserGuideBody>
          lightning run sweep train.py --n_trials=10 --simultaneous_trials=3 --cloud_compute=cpu-medium
          --model.lr="log_uniform(0.001, 0.1)" --model.gamma="uniform(0.5, 0.8)" --data.batch_size="categorical([32,
          64])"
        </UserGuideBody>
      </UserGuide>
    );
  }

  const sweepHeader = [
    'Status',
    'Name',
    'Number of trials',
    'Number of trials done',
    'Framework',
    'Cloud Compute',
    'Direction',
    'Logger URL',
    'Logger Control',
    'More',
  ];

  const baseTrialHeader = ['Status', 'Name', 'Best model score'];
  const tensorboardIdsToStatuses = Object.fromEntries(
    tensorboards.map(e => {
      return [e.sweep_id, e];
    }),
  );

  /* TODO: Merge the Specs */
  const rows = sweeps.map(sweep => {
    const tensorboardConfig =
      sweep.sweep_id in tensorboardIdsToStatuses ? tensorboardIdsToStatuses[sweep.sweep_id] : null;

    return [
      <Status status={sweep.stage ? statusToEnum[sweep.stage] : StatusEnum.NOT_STARTED} />,
      sweep.sweep_id,
      sweep.n_trials,
      sweep.trials_done,
      sweep.framework,
      sweep.cloud_compute,
      sweep.direction,
      createLoggerUrl(tensorboardConfig ? tensorboardConfig.url : sweep.logger_url),
      tensorboardConfig ? createLoggerControl(tensorboardConfig) : null,
      <IconButton id={sweep.sweep_id + '-button'}>
        <MoreHorizIcon sx={{ fontSize: 16 }} />
      </IconButton>,
    ];
  });

  const rowDetails = sweeps.map(sweep => (
    <Stack>
      <Table
        header={generateTrialHeader(baseTrialHeader, sweep.trials[0].params.params)}
        rows={trialToRows(sweep.trials)}
      />
    </Stack>
  ));

  return <Table header={sweepHeader} rows={rows} rowDetails={rowDetails} />;
}
