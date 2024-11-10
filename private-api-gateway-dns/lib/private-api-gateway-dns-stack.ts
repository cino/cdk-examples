import * as cdk from 'aws-cdk-lib';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class PrivateApiGatewayDnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'PrivateApiGatewayDnsQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // TODO: wtf
    const table = new Table(this, 'TestTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
    });
  }
}
