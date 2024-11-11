#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AppStackWithOutputs, DataStackWithOutputs } from "../lib/stacks/example-with-stack-outputs";
import { AppStackWithSsmParameters, DataStackWithSsmParameters } from '../lib/stacks/example-with-ssm-parameters';

const app = new cdk.App();

// Example with stack outputs and imports without being aware.
const { table } = new DataStackWithOutputs(app, "DataStackWithOutputs");
new AppStackWithOutputs(app, "AppStackWithOutputs", { table });

// Example with SSM Parameters
const dataStack = new DataStackWithSsmParameters(app, "DataStackWithSsmParameters");
const appStack = new AppStackWithSsmParameters(app, "AppStackWithSsmParameters");
appStack.addDependency(dataStack);
