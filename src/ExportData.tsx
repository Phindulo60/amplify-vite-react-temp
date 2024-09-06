import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
import { UserContext } from "./UserContext";
import exportFromJSON from "export-from-json";


interface Image {
  key: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface Category {
  name: string;
}

interface Annotation {
  x: number;
  y: number;
  obscured: boolean;
  image: Image;
  category: Category;
  owner: string;
}

interface AnnotationsResponse {
  annotationsByAnnotationSetId: {
    items: Annotation[];
    nextToken: string | null;
  };
}

interface ExportDataProps {
  show: boolean;
  handleClose: () => void;
}

export const ExportData: React.FC<ExportDataProps> = ({ show, handleClose }) => {
  const [annotationSet, setAnnotationSet] = useState<string | undefined>(undefined);
  const { gqlSend } = useContext(UserContext)!;

  const annotationsByAnnotationSetId = `
  query AnnotationsByAnnotationSetId(
    $annotationSetId: ID!
    $sortDirection: ModelSortDirection
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        x
        y
        obscured
        image{
          key
          latitude
          longitude
          timestamp
        }
        category{
          name
        }
        owner
      }
      nextToken
    }
  }
`;

  async function handleSubmit() {
    console.log("wtf");
    handleClose();
    const fileName = "DetWebExport";
    const exportType = exportFromJSON.types.csv;
    let nextToken: string | undefined = undefined;
    let items: Annotation[] = [];
    let allItems: Annotation[] = [];
    do {
      const result = await gqlSend(annotationsByAnnotationSetId, {
        annotationSetId: annotationSet,
        nextToken,
      });
      const data = result as unknown as AnnotationsResponse;
      const { items: fetchedItems, nextToken: fetchedNextToken } = data.annotationsByAnnotationSetId;
      items = fetchedItems;
      nextToken = fetchedNextToken ?? undefined;
      allItems = allItems.concat(items);
    } while (nextToken);
    exportFromJSON({
      data: allItems.map((xx) => {
        return {
          category: xx.category.name,
          image: xx.image.key,
          timestamp: xx.image.timestamp,
          latitude: xx.image.latitude,
          longitude: xx.image.longitude,
          obscured: xx.obscured,
          objectId: xx.owner,
          x: xx.x,
          y: xx.y,
        };
      }),
      fileName,
      exportType,
    });
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Export data</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <AnnotationSetDropdown
                setAnnotationSet={setAnnotationSet}
                selectedSet={annotationSet}
              />
            </Form.Group>
            {/* <CsvDownloadButton data={[{x:1,y:2,timestamp:"Now"},{x:1,y:2,timestamp:"Now"},{x:1,timestamp:"Now"}]}>Download</CsvDownloadButton> */}
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!annotationSet}
        >
          Export
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ExportData;
