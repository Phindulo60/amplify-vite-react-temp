import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

type HandleUploadProps = {
  layers: lambda.LayerVersion[];
  role: iam.Role;
  buckets: s3.Bucket[];
  graphqlEndpoint: string;
  graphqlApiKey: string;
};

export const createHandleUpload = (
  scope: Construct,
  props: HandleUploadProps,
) => {
  const handleUploadFunc = new lambda.Function(scope, "s3TriggerLambda", {
    runtime: lambda.Runtime.NODEJS_18_X,
    role: props.role,
    code: lambda.Code.fromAsset("./lib/lambdas/handleS3Upload"),
    layers: props.layers,
    handler: "main.handler",
    timeout: cdk.Duration.seconds(30),
    memorySize: 2048,
    environment: {
      OUTPUTBUCKET: props.buckets[1].bucketName,
      API_DETWEB_GRAPHQLAPIENDPOINTOUTPUT: props.graphqlEndpoint,
      API_DETWEB_GRAPHQLAPIKEYOUTPUT: props.graphqlApiKey,
    },
  });

  /*      const lambdaFunction = new lambda.Function(this, 'Function', {
        code: lambda.Code.fromAsset('src'),
        handler: 'index.handler',
        functionName: 'BucketPutHandler',
        runtime: lambda.Runtime.NODEJS_12_X,
      });*/

  props.buckets[0].grantRead(handleUploadFunc);
  props.buckets[1].grantReadWrite(handleUploadFunc);

  const myPutEventSource = new lambdaEventSources.S3EventSource(
    props.buckets[0],
    {
      events: [s3.EventType.OBJECT_CREATED],
    },
  );
  handleUploadFunc.addEventSource(myPutEventSource);

  return handleUploadFunc;
};
