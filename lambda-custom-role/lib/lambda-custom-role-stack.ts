import { Stack, StackProps } from 'aws-cdk-lib';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class LambdaCustomRoleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create your custom IAM Role
    const customRole = new Role(this, 'CustomRole', {
      roleName: 'CustomRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    // create smallest lambda function possible and assign the custom role.
    const lambdaFunction = new NodejsFunction(this, 'Function', {
      entry: './dist/function.js',
      role: customRole,
    });

    // Create an inline policy which only allows the role to write logs to the log group
    // that is automatically created by the lambda function.
    customRole.attachInlinePolicy(
      new Policy(this, 'loggingPolicy', {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              'logs:CreateLogGroup',
            ],
            resources: ['*'],
          }),
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ],
            resources: [
              lambdaFunction.logGroup.logGroupArn,
            ],
          }),
        ],
      }),
    );
  }
}
