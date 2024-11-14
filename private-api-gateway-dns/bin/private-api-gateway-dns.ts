#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PrivateApiGatewayDnsStack } from '../lib/private-api-gateway-dns-stack';

const app = new cdk.App();

new PrivateApiGatewayDnsStack(app, 'PrivateApiGatewayDnsStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  }
});
