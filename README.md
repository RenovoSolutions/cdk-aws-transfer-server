# Basic CDK setup for temporary SFTP Transfer Server on AWS to a single bucket
Pass any number of target clients as the `clients` context. These should be client names and public keys paired in the format `<client>:<public_key>`. Split multiple keys using a comma as shown below. In addition this code is set up to require a descriptor. This descriptor gets used in naming the stack and allowing re-use of the code to create multiple transfer servers as needed. Also seen below:

```
CDK_TRANSFER_SERVER_DESCRIPTOR='<some_descriptor>' cdk <command> -c clients='<user_name>:<public_key>,<user_name>:<public_key>'
```

By default everything uploaded expires after 30 days and files that are overwritten keep old versions for 14 days. Modify as you see fit.

Note: Transfer servers can be far more complex, but this is intended to be a short lived location to collect files from someone before its shut down. If you have a need for a permenant transfer server this code will need re-worked appropriately.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
