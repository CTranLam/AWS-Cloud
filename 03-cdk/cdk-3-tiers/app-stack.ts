import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';
import { NetworkStack } from './network-stack';
import * as fs from 'fs';
import * as path from 'path';

interface AppStackProps extends cdk.StackProps {
  network: NetworkStack;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { vpc, publicSubnets, privateSubnets, publicSecurityGroup, privateSecurityGroup } = props.network;

    // ALB
    const alb = new elbv2.CfnLoadBalancer(this, 'ALB', {
      type: 'application',
      scheme: 'internet-facing',
      subnets: publicSubnets.map(s => s.ref),
      securityGroups: [publicSecurityGroup.ref],
      tags: [{ key: 'Name', value: 'main-alb' }],
    });

    // Target Group
    const targetGroup = new elbv2.CfnTargetGroup(this, 'TargetGroup', {
      vpcId: vpc.ref,
      protocol: 'HTTP',
      port: 80,
      targetType: 'instance',
      healthCheckPath: '/health',
      healthCheckProtocol: 'HTTP',
      tags: [{ key: 'Name', value: 'main-tg' }],
    });

    // ALB Listener
    new elbv2.CfnListener(this, 'ALBListener', {
      loadBalancerArn: alb.ref,
      protocol: 'HTTP',
      port: 80,
      defaultActions: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.ref,
        },
      ],
    });

    // Launch Template
    const launchTemplate = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateData: {
        instanceType: 't3.micro',
        imageId: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        }).getImage(this).imageId,
        securityGroupIds: [privateSecurityGroup.ref],
        userData: cdk.Fn.base64(
          fs.readFileSync(path.join(__dirname, '../scripts/user-data.sh'), 'utf8')
        ),
      },
    });

    // Auto Scaling Group
    new autoscaling.CfnAutoScalingGroup(this, 'ASG', {
      minSize: '2',
      maxSize: '4',
      desiredCapacity: '2',
      vpcZoneIdentifier: privateSubnets.map(s => s.ref),
      targetGroupArns: [targetGroup.ref],
      launchTemplate: {
        launchTemplateId: launchTemplate.ref,
        version: launchTemplate.attrLatestVersionNumber,
      },
      tags: [{ key: 'Name', value: 'main-asg', propagateAtLaunch: true }],
    });
  }
}
