import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { join } from 'path';

export class SecretWithRotationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const customSecret = new Secret(this, 'customSecret', {
      secretName: '/parameter-store-vs-secret/secret-rotation-custom',
    });

    customSecret.addRotationSchedule('RotationSchedule', {
      rotationLambda: new NodejsFunction(this, 'rotationLambda', {
        entry: join(__dirname, './custom-rotation-secret/main.ts'),
        architecture: Architecture.ARM_64,
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(30),
      }),
      automaticallyAfter: Duration.days(1),
    });
  }
}
