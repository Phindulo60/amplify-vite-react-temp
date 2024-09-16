import { defineFunction } from '@aws-amplify/backend';

export const handleS3Upload =
    //(imageTable: string, outputBucketName: string) =>
    defineFunction({
    name: 'handleS3Upload',
    entry: './app.mjs',
    runtime: 20,
    // environment: {
    //     IMAGETABLE: imageTable,
    //     OUTPUTBUCKET: outputBucketName,
    //     }
    });