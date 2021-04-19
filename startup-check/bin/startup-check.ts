#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { StartupCheckStack } from '../lib/startup-check-stack';
import * as config from "../app.config.json";

const app = new cdk.App();
const startupStack = new StartupCheckStack(app, 'StartupCheckStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? config.accountID,
    region: process.env.CDK_DEFAULT_REGION ?? config.region
  }
});

cdk.Tags.of(startupStack).add("Environment", "production");
cdk.Tags.of(startupStack).add("Project", "startup-checks");