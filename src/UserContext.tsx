import { createContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from "react";
// export const UserContext = createContext([]);
import { useProjectMemberships, useUsers } from "./useGqlCached.tsx";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  DeleteMessageCommand,
  SQSClient,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { limitConnections } from "./App.tsx";
import { gqlSend, gqlGetMany } from "./utils";
import { fetchAuthSession } from "aws-amplify/auth";
import outputs from "../amplify_outputs.json";
import type { UserProjectMembershipType, ProjectType } from "./schemaTypes";
import { useOptimisticUpdates } from "./useOptimisticUpdates";



interface UserProps {
  loggedInUser: { username: string };
  children: ReactNode;
}

interface UserType {
  id: string;
  currentProjectId: string;
  isAdmin?: boolean;
}

// Define ProjectMembership to be the same as the ProjectMembership type in Schema


export interface UserContextType {
  user: UserType | undefined;
  backend: any;
  gqlSend: typeof gqlSend;
  gqlGetMany: typeof gqlGetMany;
  sendToQueue: (config: any) => Promise<any>;
  getFromQueue: (config: any) => Promise<any>;
  refreshVisibility: (config: any) => Promise<any>;
  createQueue: (config: any) => Promise<any>;
  getQueueAttributes: (config: any) => Promise<any>;
  setCurrentProject: (projectId: string) => void;
  getQueueUrl: (config: any) => Promise<any>;
  deleteFromQueue: (config: any) => Promise<any>;
  jobsCompleted: number;
  setJobsCompleted: React.Dispatch<React.SetStateAction<number>>;
  getObject: (config: any) => Promise<any>;
  invoke: (config: any) => Promise<any>;
  s3Client: S3Client | undefined;
  lambdaClient: LambdaClient | undefined;
  region: string;
  credentials: any;
  projects: ProjectType[] | undefined;
  currentProject: ProjectType | undefined;
  currentQueue: string | undefined;
  currentPM: UserProjectMembershipType | undefined;
}


export const UserContext = createContext<UserContextType | undefined>(undefined);

export default function User({ loggedInUser, children }: UserProps) {
  const {users } = useUsers();
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const { projectMemberships } = useProjectMemberships();
  //const [user, setUser] = useState<UserType | undefined>(undefined);
  const [credentials, setCredentials] = useState<any>(undefined);
  const [currentPM, setCurrentPM] = useState<UserProjectMembershipType | undefined>(undefined);
  const [sqsClient, setSqsClient] = useState<SQSClient | undefined>(undefined);
  const [s3Client, setS3Client] = useState<S3Client | undefined>(undefined);
  const [lambdaClient, setLambdaClient] = useState<LambdaClient | undefined>(undefined);
  const region = outputs.auth.aws_region;
  const { data: { data: projects }} = useOptimisticUpdates("Project");
  
  // useEffect(()=>{
  //   const setup = async()=>{
  //     credentials = Auth.essentialCredentials(await Auth.currentCredentials())
  //     setCredentials(credentials);
  //     setLambdaClient(new LambdaClient({ region, credentials }));
  //     setS3Client(new S3Client({ region, credentials }));
  //     setCognitoClient(new CognitoIdentityProviderClient({region:cognitoRegion, credentials}))
  //     setSqsClient(new SQSClient({region, credentials}))
  //   }
  //   setup()
  // },[loggedInUser])

  useEffect(() => {
    async function refreshCredentials() {
      const { credentials } = await fetchAuthSession();
      setCredentials(credentials);
      setSqsClient(new SQSClient({ region, credentials }));
      setLambdaClient(new LambdaClient({ region, credentials }));
      setS3Client(new S3Client({ region, credentials }));
    }
    refreshCredentials();
    //const user = users?.find((user_: any) => user_.id == loggedInUser.username) as UserType | undefined;
    // if (user) {
    //   setUser({
    //     ...user,
    //     currentProjectId: user.currentProjectId || "",
    //   });
    // 
    //}
    const timer = setInterval(refreshCredentials, 30 * 60 * 1000); // Refresh credentials every 30 minutes
    return () => clearInterval(timer);
  }, [loggedInUser, users]);

  async function sqsSend(command: any) {
    return limitConnections(() => sqsClient!.send(command));
  }

  async function lambdaSend(command: any) {
    return limitConnections(() => lambdaClient!.send(command));
  }

  async function invoke(config: any) {
    return lambdaSend(new InvokeCommand(config));
  }

  async function s3Send(command: any) {
    return limitConnections(() => s3Client!.send(command));
  }

  async function getObject(config: any) {
    return s3Send(new GetObjectCommand(config));
  }

  async function sendToQueue(config: any) {
    return sqsSend(new SendMessageCommand(config));
  }

  async function getFromQueue(config: any) {
    return sqsSend(new ReceiveMessageCommand(config));
  }

  async function refreshVisibility(config: any) {
    return sqsSend(new ChangeMessageVisibilityCommand(config));
  }

  async function getQueueUrl(config: any) {
    return sqsSend(new GetQueueUrlCommand(config));
  }

  async function deleteFromQueue(config: any) {
    return sqsSend(new DeleteMessageCommand(config));
  }

  async function createQueue(config: any) {
    return sqsSend(new CreateQueueCommand(config));
  }

  async function getQueueAttributes(config: any) {
    return sqsSend(new GetQueueAttributesCommand(config));
  }

  const setCurrentProject = (projectId: string) => {
    setCurrentPM(projectMemberships?.find((pm: UserProjectMembershipType) => pm.userId == loggedInUser.username && pm.projectId == projectId));
  };


  return (
    <UserContext.Provider
      value={{
        user: {id: loggedInUser.username, currentProjectId: currentPM?.projectId||""},
        backend: outputs,
        gqlSend,
        gqlGetMany,
        sendToQueue,
        getFromQueue,
        refreshVisibility,
        createQueue,
        getQueueAttributes,
        setCurrentProject,
        getQueueUrl,
        deleteFromQueue,
        jobsCompleted,
        setJobsCompleted,
        getObject,
        invoke,
        s3Client,
        lambdaClient,
        region,
        credentials,
        projects,//tEMPORARY HACK
        currentProject: projects?.find((p: ProjectType) => p.id == currentPM?.projectId),
        currentPM,
        currentQueue: currentPM?.queueUrl || "",
      }}
    >
      {loggedInUser && credentials && children}
    </UserContext.Provider>
  );
}
