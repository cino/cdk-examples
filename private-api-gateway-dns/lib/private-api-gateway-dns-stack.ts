import * as cdk from "aws-cdk-lib";
import {
  AuthorizationType,
  EndpointType,
  MockIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointAwsService,
  IVpc,
  Port,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  TargetType,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { IpTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import {
  AccountPrincipal,
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export class PrivateApiGatewayDnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiFqn = "api.cino.dev";

    // Step 1: Retrieve vpc / hosted zones
    const [vpc, publicHostedZone, privateHostedZone] = this.getNetwork();

    // Step 2: Create API Gateway VPC Endpoint
    const apiGatewayVpcEndpoint = this.createApiGatewayVpcEndpoint(vpc);

    // Step 3: Create certificate for the API Gateway / ALB
    const acmCertificate = this.createCertificate(apiFqn, publicHostedZone);

    // Step 3: Create ALB
    const alb = this.createApplicationLoadBalancer(vpc, apiGatewayVpcEndpoint);

    // Step 4: Create API Gateway
    this.createApiGateway(apiFqn, acmCertificate, apiGatewayVpcEndpoint);

    // Step 5: Create ALB Listener for API Gateway VPC Endpoint
    this.createApiGatewayVpcEndpointListener(
      acmCertificate,
      vpc,
      alb,
      apiGatewayVpcEndpoint
    );

    // Step 6 Create Route53 records pointing towards
    // the Application Load Balancer
    this.createDnsRecords(privateHostedZone, alb, apiFqn);
  }

  private getNetwork(): [IVpc, IHostedZone, IHostedZone] {
    const vpc = Vpc.fromLookup(this, "Vpc", {
      isDefault: false,
      vpcName: "sandbox-vpc",
    });

    const publicHostedZone = HostedZone.fromLookup(this, "PublicHostedZone", {
      domainName: "cino.dev",
      privateZone: false,
    });

    const privateHostedZone = HostedZone.fromLookup(this, "PrivateHostedZone", {
      domainName: "cino.dev",
      privateZone: true,
    });

    return [vpc, publicHostedZone, privateHostedZone];
  }

  private createApiGatewayVpcEndpoint(vpc: IVpc): InterfaceVpcEndpoint {
    const vpcEndpoint = new InterfaceVpcEndpoint(this, `VpcEndpoint`, {
      vpc: vpc,
      service: InterfaceVpcEndpointAwsService.APIGATEWAY,
      privateDnsEnabled: true,
    });

    return vpcEndpoint;
  }

  private createApiGateway(
    apiFqn: string,
    acmCertificate: Certificate,
    vpcEndpoint: InterfaceVpcEndpoint
  ): RestApi {
    const api = new RestApi(this, "PrivateApiGateway", {
      restApiName: "private-api-gateway",
      description: "Private API Gateway",
      deployOptions: {
        stageName: "test",
      },
      endpointTypes: [EndpointType.PRIVATE],
      policy: new PolicyDocument({
        statements: [
          // For this demo allow anyone to invoke the api when access via vpce.
          // Obviously you would limit this down to specific needs.
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["execute-api:Invoke"],
            principals: [new AnyPrincipal()],
            resources: ["execute-api:/*"],
          }),
          new PolicyStatement({
            effect: Effect.DENY,
            principals: [new AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
            conditions: {
              "ForAllValues:StringNotEquals": {
                "aws:SourceVpce": vpcEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      }),
      domainName: {
        certificate: acmCertificate,
        domainName: apiFqn,
        endpointType: EndpointType.REGIONAL,
      },
    });

    // Add a new resource to the API
    const helloResource = api.root.addResource("hello",);

    // Define a mock integration
    const testIntegration = new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseTemplates: {
            "application/json": JSON.stringify({ message: "Hello World!" }),
          },
        },
      ],
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    });

    // Add a GET method to the resource with the mock integration
    helloResource.addMethod("GET", testIntegration, {
      methodResponses: [{ statusCode: "200" }],
      authorizationType: AuthorizationType.NONE,
    });

    return api;
  }

  private createApplicationLoadBalancer(vpc: IVpc, vpcEndpoint: InterfaceVpcEndpoint): ApplicationLoadBalancer {
    const alb = new ApplicationLoadBalancer(this, "ALB", {
      vpc: vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      deletionProtection: false,
    });

    // Allow traffic to flow towards the VPC Endpoint
    alb.connections.allowTo(
      vpcEndpoint,
      Port.tcp(443),
    );

    return alb;
  }

  private createCertificate(
    apiFqn: string,
    publicHostedZone: IHostedZone
  ): Certificate {
    return new Certificate(this, "PrivateApiGatewayCertificate", {
      certificateName: `alb-private-apigateway-certificate`,
      domainName: apiFqn,
      validation: CertificateValidation.fromDns(publicHostedZone),
    });
  }

  private createApiGatewayVpcEndpointListener(
    acmCertificate: Certificate,
    vpc: IVpc,
    alb: ApplicationLoadBalancer,
    apiGatewayVpcEndpoint: InterfaceVpcEndpoint
  ): void {
    const ipAddresses = this.getVpcEndpointIpAddresses(
      vpc,
      apiGatewayVpcEndpoint
    );

    const targets = ipAddresses.map((ip) => new IpTarget(ip));
    const apiGatewayTargetGroup = new ApplicationTargetGroup(
      this,
      `PrivateApiGatewayTargetGroup`,
      {
        vpc: vpc,
        targetType: TargetType.IP,
        targetGroupName: `priv-apigw-tg`,
        targets,
        protocol: ApplicationProtocol.HTTPS,
      }
    );

    apiGatewayTargetGroup.configureHealthCheck({
      path: `/test/hello`,
      healthyHttpCodes: "200,400,403",
      port: "443",
    });

    alb.addListener("PrivateApiGatewayListener", {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [acmCertificate],
      defaultTargetGroups: [apiGatewayTargetGroup],
    });
  }

  private getVpcEndpointIpAddresses(
    vpc: IVpc,
    vpcEndpoint: InterfaceVpcEndpoint
  ): string[] {
    const vpcEndpointProps = new AwsCustomResource(this, "VpcEndpointEnis", {
      onUpdate: {
        service: "EC2",
        action: "describeVpcEndpoints",
        parameters: {
          Filters: [
            {
              Name: "vpc-endpoint-id",
              Values: [vpcEndpoint.vpcEndpointId],
            },
          ],
        },
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const vpcEndpointIps = new AwsCustomResource(
      this,
      "vpc-endpoint-ip-lookup",
      {
        onUpdate: {
          service: "EC2",
          action: "describeNetworkInterfaces",
          outputPaths: vpc.availabilityZones.map((_, index) => {
            return `NetworkInterfaces.${index}.PrivateIpAddress`;
          }),
          parameters: {
            NetworkInterfaceIds: vpc.availabilityZones.map((_, index) => {
              return vpcEndpointProps.getResponseField(
                `VpcEndpoints.0.NetworkInterfaceIds.${index}`
              );
            }),
          },
          physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      }
    );

    return vpc.availabilityZones.map((_, index) => {
      return vpcEndpointIps.getResponseField(
        `NetworkInterfaces.${index}.PrivateIpAddress`
      );
    });
  }

  private createDnsRecords(
    privateHostedZone: IHostedZone,
    alb: ApplicationLoadBalancer,
    apiFqn: string
  ): void {
    new ARecord(this, "ALBRecord", {
      zone: privateHostedZone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
      recordName: apiFqn,
    });
  }
}
