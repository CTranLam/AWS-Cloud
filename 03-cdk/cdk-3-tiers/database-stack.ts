import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { NetworkStack } from './network-stack';

interface DatabaseStackProps extends cdk.StackProps {
  network: NetworkStack;
}

export class DatabaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc, privateSubnets, privateSecurityGroup } = props.network;

    // DB Credentials Secret
    const dbSecret = new secretsmanager.CfnSecret(this, 'DBSecret', {
      name: 'aurora-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    // DB Security Group (allows PostgreSQL from private SG only)
    const dbSecurityGroup = new ec2.CfnSecurityGroup(this, 'DBSecurityGroup', {
      vpcId: vpc.ref,
      groupDescription: 'Allow Aurora PostgreSQL access from private security group',
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 5432,
          toPort: 5432,
          sourceSecurityGroupId: privateSecurityGroup.ref,
        },
      ],
      tags: [{ key: 'Name', value: 'db-sg' }],
    });

    // DB Subnet Group
    const dbSubnetGroup = new rds.CfnDBSubnetGroup(this, 'DBSubnetGroup', {
      dbSubnetGroupDescription: 'Aurora subnet group using private subnets',
      subnetIds: privateSubnets.map(s => s.ref),
      tags: [{ key: 'Name', value: 'aurora-subnet-group' }],
    });

    // Aurora PostgreSQL Cluster
    const auroraCluster = new rds.CfnDBCluster(this, 'AuroraCluster', {
      engine: 'aurora-postgresql',
      engineVersion: '16.2',
      dbClusterIdentifier: 'main-aurora-cluster',
      masterUsername: cdk.Fn.sub(
        '{{resolve:secretsmanager:${Secret}:SecretString:username}}',
        { Secret: dbSecret.ref }
      ),
      masterUserPassword: cdk.Fn.sub(
        '{{resolve:secretsmanager:${Secret}:SecretString:password}}',
        { Secret: dbSecret.ref }
      ),
      dbSubnetGroupName: dbSubnetGroup.ref,
      vpcSecurityGroupIds: [dbSecurityGroup.ref],
      storageEncrypted: true,
      deletionProtection: false,
      tags: [{ key: 'Name', value: 'main-aurora-cluster' }],
    });

    // Aurora DB Instance (defines the instance class)
    new rds.CfnDBInstance(this, 'AuroraInstance', {
      dbInstanceClass: 'db.t4g.medium',
      dbClusterIdentifier: auroraCluster.ref,
      engine: 'aurora-postgresql',
      dbSubnetGroupName: dbSubnetGroup.ref,
      tags: [{ key: 'Name', value: 'main-aurora-instance' }],
    });
  }
}
