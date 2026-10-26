import { Stack, StackProps } from "aws-cdk-lib";
import { AmazonLinuxCpuType, Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { NetworkStack } from "./network-stack";

interface AppProps extends StackProps{
    myVpc : NetworkStack['myVpc'],
    webSg : NetworkStack['webSg']
}

export class AppStack extends Stack{
    constructor(scope: Construct, id: string, props?: AppProps) {
        super(scope, id, props);
            
        const myApp = new Instance(this, 'my-app', {
            vpc: props!.myVpc,
            instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
            machineImage: MachineImage.latestAmazonLinux2023({
                cpuType: AmazonLinuxCpuType.ARM_64
            }),
            
            securityGroup: props?.webSg,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            }
        })
        myApp.addUserData(
            'yum update -y',
            'yum install -y httpd',
            'systemctl start httpd',
            'systemctl enable httpd',
            'echo "<h1>Hello from AWS CDK!</h1>" > /var/www/html/index.html'
        )
    }
}