#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ParameterStoreSecretCustomRotationStack } from '../lib/parameter-store-secret-custom-rotation-stack';
import { SecretWithRotationStack } from '../lib/secret-with-rotation-stack';

const app = new cdk.App();

new ParameterStoreSecretCustomRotationStack(app, 'ParameterStoreSecretCustomRotationStack');
new SecretWithRotationStack(app, 'SecretWithRotationStack');

app.synth();
