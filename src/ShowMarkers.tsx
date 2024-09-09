import { useContext, useState, useEffect } from "react";
import { UserContext } from "./UserContext";
import "./index.css";
import { isHotkeyPressed, useHotkeys } from "react-hotkeys-hook";
import { ImageContext } from "./BaseImage";
import { Marker, Tooltip } from "react-leaflet";
import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from "unique-names-generator";
import * as L from "leaflet";
import { AnnotationsContext } from "./AnnotationsContext";
import * as jdenticon from "jdenticon";
import { useMap } from "react-leaflet";
import { useCategory } from "./useGqlCached";
import type { AnnotationType, CategoryType, ExtendedAnnotationType } from "./schemaTypes";
interface ShowMarkersProps {
  activeAnnotation?: AnnotationType;
  annotations: AnnotationType[] | undefined;
}

function createIcon(
  categories: CategoryType[],
  annotation: ExtendedAnnotationType,
  activeAnnotation?: ExtendedAnnotationType
) {
  const color =
    categories?.find((category) => category.id === annotation.categoryId)
      ?.color ?? "red";
  let attributes = "";
  const id = annotation.objectId || annotation.proposedObjectId;
  const activeId =
    activeAnnotation?.objectId || activeAnnotation?.proposedObjectId;
  if (activeId && id === activeId) attributes += " selected";
  if (annotation.candidate) attributes += " candidate";
  if (annotation.obscured) attributes += " obscured";
  if (annotation.shadow) attributes += " shadow";
  let html = `<div class="marker" ${attributes}><div style="background-color: ${color}; border-color: ${
    annotation.objectId
      ? "#ffffff"
      : annotation.proposedObjectId
      ? "#888888"
      : "#000000"
  }">
       <span class="markerLabel">${id ? jdenticon.toSvg(id, 24) : ""}</svg></span></div></div>`;
  return L.divIcon({
    className: "my-custom-pin",
    iconAnchor: [0, 0],
    //labelAnchor: [0, -100],
    popupAnchor: [0, -30],
    html: html,
  });
}


export function ShowMarkers({ activeAnnotation }: ShowMarkersProps) {
  const {
    annotations,
    deleteAnnotation,
    updateAnnotation,
  } = useContext(AnnotationsContext)!;

  const { latLng2xy, xy2latLng } = useContext(ImageContext) ?? {};
  const { user, sendToQueue, createQueue, currentProject } =
    useContext(UserContext)!;
  const {categories} = useCategory(currentProject)
  const [enabled, setEnabled] = useState(true);

  useHotkeys(
    "Shift",
    () => {
      setEnabled(!isHotkeyPressed("Shift"));
    },
    { keyup: true, keydown: true }
  );

  const map = useMap();


  const handleContextMenu = (e: L.LeafletMouseEvent) => {
    e.originalEvent.preventDefault();
    const annotation = annotations?.find(
      (ann) => ann.x === e.latlng.lng && ann.y === e.latlng.lat
    );
    if (annotation && deleteAnnotation && updateAnnotation) {
      const items = getContextMenuItems(
        annotation,
        user,
        categories as CategoryType[],
        deleteAnnotation,
        updateAnnotation
      );
      showContextMenu(e.originalEvent, items);
    }
  };

  useEffect(() => {
    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      const annotation = annotations?.find(
        (ann) => ann.x === e.latlng.lng && ann.y === e.latlng.lat
      );
      if (annotation && deleteAnnotation && updateAnnotation) {
        const items = getContextMenuItems(
          annotation,
          user,
          categories ?? [],
          deleteAnnotation,
          updateAnnotation
        );
        showContextMenu(e.originalEvent, items);
      }
    };

    map.on("contextmenu", handleContextMenu);
    return () => {
      map.off("contextmenu", handleContextMenu);
    };
  }, [annotations, user, categories, deleteAnnotation, updateAnnotation, map]);

  function showContextMenu(event: MouseEvent, items: any[]) {
    const contextMenu = document.createElement("div");
    contextMenu.style.position = "absolute";
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.backgroundColor = "white";
    contextMenu.style.border = "1px solid #ccc";
    contextMenu.style.zIndex = "1000";
    contextMenu.style.padding = "10px";
    contextMenu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";

    items.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement("hr");
        contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement("div");
        menuItem.textContent = item.text;
        menuItem.style.padding = "5px 10px";
        menuItem.style.cursor = "pointer";
        menuItem.addEventListener("click", async () => {
          await item.callback();
          document.body.removeChild(contextMenu);
        });
        contextMenu.appendChild(menuItem);
      }
    });

    document.body.appendChild(contextMenu);

    const removeContextMenu = () => {
      document.body.removeChild(contextMenu);
      document.removeEventListener("click", removeContextMenu);
    };

    document.addEventListener("click", removeContextMenu);
  }

  function getContextMenuItems(
    det: AnnotationType,
    user: any,
    categories: CategoryType[],
    deleteAnnotation: (annotation: AnnotationType) => void,
    updateAnnotation: (annotation: AnnotationType) => void
  ) {
    let contextmenuItems = [];
    contextmenuItems.push({
      text: "Delete",
      index: contextmenuItems.length,
      callback: async () => {
        deleteAnnotation(det);
      },
    });
    contextmenuItems.push({
      text: det.obscured ? "Mark as visible" : "Mark as obscured",
      index: contextmenuItems.length,
      callback: async () => {
        updateAnnotation({ ...det, obscured: !det.obscured });
      },
    });
    if (det.objectId) {
      contextmenuItems.push({
        text: "Remove assigned name",
        index: contextmenuItems.length,
        callback: async () => {
          updateAnnotation({ ...det, objectId: undefined });
        },
      });
    }
    if (contextmenuItems.length) {
      contextmenuItems.push({
        separator: true,
        index: contextmenuItems.length,
      });
    }
    for (let category of categories) {
      if (det.categoryId !== category.id) {
        let item: { text: string; index: number; callback: () => Promise<void> } = {
          text: `Change to ${category.name}`,
          index: contextmenuItems.length,
          callback: async () => {
            updateAnnotation({ ...det, categoryId: category.id });
          },
        };
        contextmenuItems.push(item);
      }
    }
    if (user.isAdmin) {
      const item = {
        text: "Send message to " + det.owner,
        index: contextmenuItems.length,
        callback: async () => {
          let msg = prompt("Type the message here", "This is not an elephant");
          const { QueueUrl: url } = await createQueue({
            QueueName: `${det.owner}_${currentProject}`, // required
            Attributes: {
              MessageRetentionPeriod: "1209600", // This value is in seconds. 1209600 corresponds to 14 days and is the maximum AWS supports
            },
          });
          sendToQueue({ QueueUrl: url, MessageBody: JSON.stringify({...det, message: msg}) });
          console.log(msg);
        },
      };
      contextmenuItems.push(item);
    }
    return contextmenuItems;
  }

  const getType = (annotation: ExtendedAnnotationType) =>
    (categories?.find((category) => category.id === annotation.categoryId) as CategoryType | undefined)
      ?.name ?? "Unknown";

  if (enabled)
    return (
      <>
        {annotations?.map((annotation: ExtendedAnnotationType) => {
          const position = xy2latLng
            ? (() => {
                const latLng = xy2latLng([annotation.x, annotation.y]);
                return Array.isArray(latLng) ? latLng[0] : latLng;
              })()
            : undefined;

          return position ? (
            <Marker
              key={annotation.id || crypto.randomUUID()}
              eventHandlers={{
                dragend: (e: L.LeafletEvent) => {
                  const latLng = e.target.getLatLng();
                  if (latLng2xy && updateAnnotation) {
                    let coords = latLng2xy(latLng);
                    if (!Array.isArray(coords)) {
                      updateAnnotation({
                        ...annotation,
                        y: Math.round(coords.y),
                        x: Math.round(coords.x),
                      });
                    }
                  }
                },
                contextmenu: (e: L.LeafletMouseEvent) => {
                  handleContextMenu(e);
                },
              }}
              position={position}
              draggable={true}
              autoPan={true}
              icon={createIcon(categories ?? [], annotation, activeAnnotation)}
            >
              <Tooltip>
                Category: {getType(annotation)} <br />
                Created by : {annotation?.owner}
                <br />
                {annotation?.createdAt && (
                  <>
                    Created at : {annotation?.createdAt} <br />
                  </>
                )}
                {annotation.objectId &&
                  `Name: ${uniqueNamesGenerator({
                    dictionaries: [adjectives, names],
                    seed: annotation.objectId,
                    style: "capital",
                    separator: " ",
                  })}`}
                {!annotation.objectId &&
                  annotation.proposedObjectId &&
                  `Proposed Name: ${uniqueNamesGenerator({
                    dictionaries: [adjectives, names],
                    seed: annotation.proposedObjectId,
                    style: "capital",
                    separator: " ",
                  })}`}
              </Tooltip>
            </Marker>
          ) : null;
        })}
      </>
    );
  else {
    return null;
  }
}
