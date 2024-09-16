// import {Form} from "react-bootstrap"
// import { useContext } from "react"
// import { UserContext } from "./UserContext"
// import { useImageSets } from "./useGqlCached"

// export function ImageSetDropdown({setImageSet,selectedSet}){
//     const {currentProject}=useContext(UserContext)
//     const {imageSets}=useImageSets(currentProject)

//     const onSelect = (e)=>{
//         setImageSet(e.target.value)
//     }

//     return  <Form.Select value={selectedSet || "none"} onChange={onSelect}>
//                 {!selectedSet && <option value="none">Select an image set</option>}
//                 {imageSets?.map(q=><option key={q.name} value={q.name}>{q.name}</option>)}
//             </Form.Select>
// }

import { Form } from "react-bootstrap";
import { useContext } from "react";
import { ProjectContext } from "./Context";
import Select, { MultiValue, Options  } from "react-select";

interface OptionType {
  label: string;
  value: string;
}

interface ImageSetDropdownProps {
  selectedSets: string[] | undefined;
  setImageSets: (selected: string[]) => void;
}

export function ImageSetDropdown({ selectedSets, setImageSets }: ImageSetDropdownProps) {
  const {imageSetsHook:{data:imageSets}} = useContext(ProjectContext)!;
  const options: Options<OptionType> | undefined = imageSets
    ?.map((x) => ({
      label: x.name,
      value: x.name,
    }))
    .sort((a, b) => (a.label > b.label ? 1 : -1));

  function handleChange(selectedOptions: MultiValue<OptionType>) {
    setImageSets(selectedOptions.map((option) => option.label));
  }
  

  console.log("imageSets");
  console.log(options);

  return (
    <Form.Group>
      <Select
        value={selectedSets?.map((set) => ({ label: set, value: set }))}
        onChange={handleChange}
        isMulti
        name="Image sets"
        options={options}
        className="basic-multi-select"
        classNamePrefix="select"
        closeMenuOnSelect={false}
      />
    </Form.Group>
  );
  // <Form.Select value={selectedSet || "none"} onChange={onSelect}>
  //             {!selectedSet && <option value="none">Select an annotation set</option>}
  //             {categories?.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}
  //         </Form.Select>
}
