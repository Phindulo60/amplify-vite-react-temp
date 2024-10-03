import { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { getLocationsInSet } from "./gqlQueries";
import { QueueDropdown } from "./QueueDropDown";
import { useUpdateProgress } from "./useUpdateProgress";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
import { LocationSetDropdown } from "./LocationSetDropDown";
import { GlobalContext, ManagementContext, UserContext, ProjectContext } from "./Context";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { aws_elasticloadbalancingv2_targets } from "aws-cdk-lib";
import { publishError } from './ErrorHandler';
import { retryOperation } from './utils/retryOperation';

interface LaunchTaskProps {
  show: boolean;
  handleClose: () => void;
  selectedTasks: string[];
  setSelectedTasks: React.Dispatch<React.SetStateAction<string[]>>;
}

interface ObservationsResponse {
  data: {
    observationsByLocationId: {
      items: { id: string }[];
    };
  };
}

function LaunchTask({ show, handleClose, selectedTasks, setSelectedTasks }: LaunchTaskProps) {
  const { client } = useContext(GlobalContext)!;
  const { sqsClient } = useContext(UserContext)!;
  const { queuesHook: { data: queues } } = useContext(ManagementContext)!;
  const [queueId, setQueueId] = useState<string | null>(null);
  const [url2, setUrl2] = useState<string | null>(null);
  const [annotationSet, setAnnotationSet] = useState<string | undefined>(undefined);
  const [filterObserved, setFilterObserved] = useState(false);
  const [secondaryQueue, setSecondaryQueue] = useState(false);
  const userContext = useContext(UserContext);
  if (!userContext) {
    return null;
  }

  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Launch task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName: "Enqueueing locations",
    stepFormatter: (count)=>`${count} locations`,
  });


  async function handleSubmit() {
    try {
      handleClose();
      let promises = []
      const allLocations = await Promise.all(selectedTasks.map(async (task) => {
        let prevNextToken: String | undefined = undefined;
        let allData = [];
        do {
          const result = await retryOperation(
            () => client.models.Location.locationsBySetId({ 
              setId: task, 
              nextToken: prevNextToken,
              selectionSet: ['id','x','y','width','height','confidence','image.id','image.width','image.height'] 
            }),
            { retryableErrors: ['Network error', 'Connection timeout'] }
          );
          const { data, nextToken } = result;
          prevNextToken = nextToken;
          allData = allData.concat(data);
        } while (prevNextToken)
        return allData;
      })).then(arrays => arrays.flat());
      
      setStepsCompleted(0);
      setTotalSteps(allLocations.length);
      let queueUrl = queues?.find(q => q.id == queueId)?.url;
      
      if (!queueUrl) {
        throw new Error("Queue URL not found");
      }

      for (let i = 0; i < allLocations.length; i++) {
        const location = allLocations[i];
        if (filterObserved) {
          const { data } = await retryOperation(
            () => client.models.Observation.observationsByLocationId({ locationId: location.id }),
            { retryableErrors: ['Network error', 'Connection timeout'] }
          );
          if (data.length > 0) {
            setStepsCompleted((fc: any) => fc + 1);
            continue;
          }
        }
        location.annotationSetId = annotationSet;
        await retryOperation(
          () => sqsClient.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify(location)
            })
          ),
          { retryableErrors: ['Network error', 'Connection timeout'] }
        );
        setStepsCompleted((s: number) => s + 1);

        // Publish progress update
        await client.graphql({
          query: `mutation Publish($channelName: String!, $content: String!) {
            publish(channelName: $channelName, content: $content) {
              channelName
              content
            }
          }`,
          variables: {
            channelName: 'taskProgress/launchTask',
            content: JSON.stringify({
              type: 'progress',
              total: allLocations.length,
              completed: i + 1,
              taskName: 'Launch Task'
            })
          }
        });
      }

      // Publish completion message
      await client.graphql({
        query: `mutation Publish($channelName: String!, $content: String!) {
          publish(channelName: $channelName, content: $content) {
            channelName
            content
          }
        }`,
        variables: {
          channelName: 'taskProgress/launchTask',
          content: JSON.stringify({
            type: 'completion',
            taskName: 'Launch Task'
          })
        }
      });

    } catch (error) {
      console.error('Error in LaunchTask handleSubmit:', error);
      const errorDetails = {
        error: error instanceof Error ? error.stack : String(error),
        selectedTasks,
        queueId,
        annotationSet,
        filterObserved
      };
      if (error instanceof Error) {
        publishError('taskProgress/launchTask', `Error launching task: ${error.message}`, errorDetails);
      } else {
        publishError('taskProgress/launchTask', `Error launching task: ${String(error)}`, errorDetails);
      }
    }
  }

 
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Launch Task</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Location Set</Form.Label>
              <LocationSetDropdown
                setTasks={setSelectedTasks}
                selectedTasks={selectedTasks}
              />
              {/* <Form.Select onChange={(e)=>{setLocationSet(e.target.value)}} value={locationSet}>  
      {locationSet =="none" && <option>Select a location set to process:</option>}
      {locationSets?.map( q => <option key={q.id} value={q.id} >{q.name}</option>)}
      </Form.Select>   */}
            </Form.Group>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <AnnotationSetDropdown
                setAnnotationSet={setAnnotationSet}
                selectedSet={annotationSet}
              />
              <Form.Check
                type="switch"
                label="Unobserved only"
                checked={filterObserved}
                onChange={(x) => setFilterObserved(x.target.checked)}
              />
              {/* <Form.Select onChange={(e)=>{if (e.target.value=="new"){onNewAnnotationSet().then(set=>setAnnotationSet(set))} else setAnnotationSet(e.target.value)}} value={annotationSet}>  
      {annotationSet=="none" && <option>Select an annotation set to apply the processing to:</option>}<option value="new">Add new Annotation Set</option>
      {annotationSets?.map( q => <option key={q.id} value={q.id} >{q.name}</option>)}
      </Form.Select>  */}
            </Form.Group>
            <Form.Group>
              <Form.Label>Target Queue</Form.Label>
              <QueueDropdown setQueue={setQueueId} currentQueue={queueId} />
            </Form.Group>
            <Form.Group>
              <Form.Check // prettier-ignore
                type="switch"
                id="custom-switch"
                label="Send Detections to secondary queue"
                checked={secondaryQueue}
                onChange={(x) => {
                  setSecondaryQueue(x.target.checked);
                }}
              />
              {secondaryQueue && (
                <Form.Group>
                  <Form.Label>Secondary queue</Form.Label>
                  <QueueDropdown setQueue={setUrl2} currentQueue={url2} />
                </Form.Group>
              )}
            </Form.Group>
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selectedTasks.length || !annotationSet || !queueId}
        >
          Submit
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}


export default LaunchTask;