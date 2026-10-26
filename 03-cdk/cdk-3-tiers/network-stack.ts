import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackOutputs {
  vpc: ec2.CfnVPC;
  publicSubnets: ec2.CfnSubnet[];
  privateSubnets: ec2.CfnSubnet[];
  publicSecurityGroup: ec2.CfnSecurityGroup;
  privateSecurityGroup: ec2.CfnSecurityGroup;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.CfnVPC;
  public readonly publicSubnets: ec2.CfnSubnet[];
  public readonly privateSubnets: ec2.CfnSubnet[];
  public readonly publicSecurityGroup: ec2.CfnSecurityGroup;
  public readonly privateSecurityGroup: ec2.CfnSecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    this.vpc = new ec2.CfnVPC(this, 'VPC', {
      cidrBlock: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: [{ key: 'Name', value: 'main-vpc' }],
    });

    const azs = ['a', 'b'];

    // Public Subnets
    this.publicSubnets = azs.map((az, i) =>
      new ec2.CfnSubnet(this, `PublicSubnet${i + 1}`, {
        vpcId: this.vpc.ref,
        cidrBlock: `10.0.${i}.0/24`,
        availabilityZone: `${this.vpc.region}${az}`,
        mapPublicIpOnLaunch: true,
        tags: [{ key: 'Name', value: `public-subnet-${i + 1}` }],
      })
    );

    // Private Subnets
    this.privateSubnets = azs.map((az, i) =>
      new ec2.CfnSubnet(this, `PrivateSubnet${i + 1}`, {
        vpcId: this.vpc.ref,
        cidrBlock: `10.0.${i + 2}.0/24`,
        availabilityZone: `${this.vpc.region}${az}`,
        tags: [{ key: 'Name', value: `private-subnet-${i + 1}` }],
      })
    );

    // Internet Gateway
    const igw = new ec2.CfnInternetGateway(this, 'IGW', {
      tags: [{ key: 'Name', value: 'main-igw' }],
    });
    new ec2.CfnVPCGatewayAttachment(this, 'IGWAttachment', {
      vpcId: this.vpc.ref,
      internetGatewayId: igw.ref,
    });

    // NAT Gateway (in first public subnet)
    const eip = new ec2.CfnEIP(this, 'NatEIP', { domain: 'vpc' });
    const natGw = new ec2.CfnNatGateway(this, 'NatGW', {
      subnetId: this.publicSubnets[0].ref,
      allocationId: eip.attrAllocationId,
      tags: [{ key: 'Name', value: 'main-nat-gw' }],
    });

    // Public Route Table
    const publicRt = new ec2.CfnRouteTable(this, 'PublicRT', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: 'public-rt' }],
    });
    new ec2.CfnRoute(this, 'PublicDefaultRoute', {
      routeTableId: publicRt.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.ref,
    });
    this.publicSubnets.forEach((subnet, i) =>
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicRTAssoc${i + 1}`, {
        subnetId: subnet.ref,
        routeTableId: publicRt.ref,
      })
    );

    // Private Route Table
    const privateRt = new ec2.CfnRouteTable(this, 'PrivateRT', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: 'private-rt' }],
    });
    new ec2.CfnRoute(this, 'PrivateDefaultRoute', {
      routeTableId: privateRt.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGw.ref,
    });
    this.privateSubnets.forEach((subnet, i) =>
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateRTAssoc${i + 1}`, {
        subnetId: subnet.ref,
        routeTableId: privateRt.ref,
      })
    );

    // Public Security Group (ALB)
    this.publicSecurityGroup = new ec2.CfnSecurityGroup(this, 'PublicSG', {
      vpcId: this.vpc.ref,
      groupDescription: 'Allow HTTP and HTTPS from internet',
      securityGroupIngress: [
        { ipProtocol: 'tcp', fromPort: 80, toPort: 80, cidrIp: '0.0.0.0/0' },
        { ipProtocol: 'tcp', fromPort: 443, toPort: 443, cidrIp: '0.0.0.0/0' },
      ],
      tags: [{ key: 'Name', value: 'public-sg' }],
    });

    // Private Security Group (EC2 + Aurora)
    this.privateSecurityGroup = new ec2.CfnSecurityGroup(this, 'PrivateSG', {
      vpcId: this.vpc.ref,
      groupDescription: 'Allow traffic from public security group only',
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 0,
          toPort: 65535,
          sourceSecurityGroupId: this.publicSecurityGroup.ref,
        },
      ],
      tags: [{ key: 'Name', value: 'private-sg' }],
    });
  }
}
