import * as cdk from "aws-cdk-lib";
import { AttributeType, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class DataStackWithSsmParameters extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, "DataStackTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
    });

    new StringParameter(this, "table-arn-parameter", {
      parameterName: "/data/table-arn",
      stringValue: table.tableArn,
    });
  }
}

export class AppStackWithSsmParameters extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tableArn = StringParameter.fromStringParameterName(this, "table-arn-parameter", "/data/table-arn").stringValue;
    const table = Table.fromTableArn(this, "DataStackTable", tableArn);

    const lambdaFunction = new Function(this, "AppStackFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromInline(`
        exports.handler = async function(event, context) {
          console.log("Event: ", JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify('Hello from Lambda!'),
          };
        };
      `),
    });

    table.grantReadData(lambdaFunction);
  }
}
