import * as cdk from "aws-cdk-lib";
import { AttributeType, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class DataStackWithOutputs extends cdk.Stack {
  readonly table: ITable;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.table = new Table(this, "DataStackTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
    });
  }
}

interface AppStackProps extends cdk.StackProps {
  table: ITable;
}

export class AppStackWithOutputs extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

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

    props.table.grantReadData(lambdaFunction);
  }
}
