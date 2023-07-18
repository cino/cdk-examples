import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { join } from 'path';

export class ParameterStoreSecretCustomRotationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // You'll need to create an SSM parameter with the name /parameter-store-vs-secret/secret
    // by using the AWS CLI or AWS Console before deploying this stack.

    const secretParameter = StringParameter.fromSecureStringParameterAttributes(this, 'mySecretRotatingParameter', {
      parameterName: '/parameter-store-vs-secret/secret-rotating',
    });

    // It is not possible to get the output of the secret value from the AWS CDK.
    // However you can give lambda's permission to read/write the secret value.

    // In this example we will be rotating the secret every 5 minutes to demonstrate the rotation.
    const rotationLambda = new NodejsFunction(this, 'rotationLambda', {
      entry: join(__dirname, './custom-rotation/main.ts'),
      environment: {
        PARAMETER_NAME: secretParameter.parameterName,
      },
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(30),
    });

    secretParameter.grantRead(rotationLambda);
    secretParameter.grantWrite(rotationLambda);

    // Schedule the rotation every 5 minutes using a CloudWatch Event Rule.
    new Rule(this, 'rotationRule', {
      schedule: Schedule.rate(Duration.minutes(5)),
      targets: [
        new LambdaFunction(rotationLambda),
      ],
    });
  }
}
