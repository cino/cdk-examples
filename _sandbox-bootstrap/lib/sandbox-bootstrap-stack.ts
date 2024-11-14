import * as cdk from "aws-cdk-lib";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { HostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SandboxBootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = this.createVpc();
    this.createCloudShellSecurityGroup(vpc);
    this.createHostedZones(vpc);
  }

  private createVpc(): Vpc {
    const vpc = new Vpc(this, "VPC", {
      enableDnsSupport: true,
      vpcName: "sandbox-vpc",
      maxAzs: 2, // This is a sandbox, let reduce cost a little / minimum 2 for load balancing
    });

    return vpc;
  }

  private createCloudShellSecurityGroup(vpc: Vpc): SecurityGroup {
    // This is for testing without vpn to the vpc.
    // Creating a security group for CloudShell that allows all outbound traffic
    // necessary for CloudShell to download packages and dependencies
    const cloudShellSecurityGroup = new SecurityGroup(this, "CloudshellSG", {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
      securityGroupName: "cloud-shell-sg",
    });

    cloudShellSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.allTraffic(),
      "anywhere"
    );
    return cloudShellSecurityGroup;
  }

  private createHostedZones(vpc: Vpc): void {
    // Actually not creating as this is an existing public hosted zone
    // which I don't want to be deleted by accident here.
    // const publicHostedZone = HostedZone.fromLookup(this, "PublicHostedZone", {
    //   domainName: "cino.dev",
    //   privateZone: false,
    // });

    new HostedZone(this, "PrivateHostedZone", {
      zoneName: "cino.dev",
      vpcs: [vpc],
    });
  }
}
