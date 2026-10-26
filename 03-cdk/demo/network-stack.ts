import { Stack, StackProps } from "aws-cdk-lib";
import { IpAddresses, ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";


export class NetworkStack extends Stack {
    public readonly myVpc : IVpc
    public readonly webSg : ISecurityGroup
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.myVpc = new Vpc(this, 'vpc-cdk-demo', {
            ipAddresses: IpAddresses.cidr('10.10.0.0/16'),
            maxAzs: 2,
            subnetConfiguration: [
                {
                    name: "PublicSubnet",
                    subnetType: SubnetType.PUBLIC,
                    cidrMask: 24,
                    mapPublicIpOnLaunch: true
                },
                {
                    name: "PrivateSubnet",
                    subnetType: SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24
                }
            ],
            natGateways: 0
        })
        this.webSg = new SecurityGroup(this, 'websg', {
            vpc: this.myVpc,
            description: "this is a sg created by aws cdk",
            allowAllOutbound: true
        })
        this.webSg.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(80),
            "Allow HTTP traffic"
        )
    }
    
}