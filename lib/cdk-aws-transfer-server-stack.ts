import * as cdk from '@aws-cdk/core';
import * as transfer from '@aws-cdk/aws-transfer';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { assert } from 'console';

export class CdkAwsTransferServerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const transferLoggingRole = new iam.Role(this, 'transferLoggingRole', {
      assumedBy: new iam.ServicePrincipal('transfer.amazonaws.com'),
      description: 'Temporary transfer server role for ' + process.env.CDK_TRANSFER_SERVER_DESCRIPTOR
    })

    const transferServer = new transfer.CfnServer(this, 'transferServer', {
      identityProviderType: "SERVICE_MANAGED",
      endpointType: "PUBLIC",
      loggingRole: transferLoggingRole.roleArn
    })

    const uploadBucket = new s3.Bucket(this, 'uploadBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true,
      lifecycleRules: [{
        enabled: true,
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        expiration: cdk.Duration.days(30),
        noncurrentVersionExpiration: cdk.Duration.days(14)
      }],
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    })

    assert(uploadBucket.encryptionKey == null);

    // Create role to scope perms for the transfer service users
    const transferUserRole = new iam.Role(this, 'transferUserRole', {
      assumedBy: new iam.ServicePrincipal('transfer.amazonaws.com'),
      description: 'Temporary transfer user role for ' + process.env.CDK_TRANSFER_SERVER_DESCRIPTOR
    })

    // reference for policies: https://docs.aws.amazon.com/transfer/latest/userguide/users-policies.html
    const transferUserRolePolicyAllowListingStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      sid: 'AllowListingOfFolders',
      resources: [
        uploadBucket.bucketArn
      ],
      actions: [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ]
    });

    const transferUserRolePolicyAllowHomeDirAccessStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      sid: 'AllowFolderObjectAccess',
      resources: [
        uploadBucket.bucketArn + "/*"
      ],
      actions: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",              
        "s3:DeleteObjectVersion",
        "s3:GetObjectVersion",
        "s3:GetObjectACL",
        "s3:PutObjectACL"
      ]
    });

    const transferUserRolePolicy = new iam.Policy(this, 'uploadBucketAccessPolicy', {
      statements: [transferUserRolePolicyAllowListingStatement, transferUserRolePolicyAllowHomeDirAccessStatement]
    });

    const transferUserRolePolicyAttachment = transferUserRole.attachInlinePolicy(transferUserRolePolicy);

    const transferClientPolicyListingStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      sid: 'AllowListingOfUserFolder',
      resources: [
        "arn:aws:s3:::${transfer:HomeBucket}"
      ],
      actions: [
        "s3:ListBucket"
      ],
      conditions: {
        "StringLike": {
          "s3:prefix": [
            "${transfer:HomeFolder}/*",
            "${transfer:HomeFolder}"
          ]
        }
      }
    });

    const transferClientPolicyHomeAccess = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      sid: 'HomeDirObjectAccess',
      resources: [
        "arn:aws:s3:::${transfer:HomeDirectory}*"
      ],
      actions: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObjectVersion",
        "s3:DeleteObject",
        "s3:GetObjectVersion",
        "s3:GetObjectACL",
        "s3:PutObjectACL"
      ]
    })

    const transferClientPolicy = new iam.Policy(this, 'transferClientPolicy', {
      statements: [transferClientPolicyListingStatement, transferClientPolicyHomeAccess]
    })

    // Create transfer user with further scoped limits
    const clientsContext:string = this.node.tryGetContext('clients')
    let clients = clientsContext.split(/\s*,\s*/).map(chunk => chunk.split(":"));

    for (let [client, pubKey] of clients) {
      let transferUser = new transfer.CfnUser(this, 'transferUser' + client, {
        role: transferUserRole.roleArn,
        serverId: transferServer.attrServerId,
        userName: client,
        homeDirectory: "/" + uploadBucket.bucketName + "/" + client,
        policy: JSON.stringify(transferClientPolicy.document, null, 2),
        sshPublicKeys: [pubKey]
      });
    };
  }
}
