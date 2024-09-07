import { useContext, useEffect } from "react";
import Form from "react-bootstrap/Form";
import { useProjects, useProjectMemberships } from "./useGqlCached";
import { UserContext, UserContextType } from "./UserContext";
import { GQL_Client } from "./App";

function ProjectSelector() {
  const { user, setCurrentProject, memberships, currentProject } = useContext(UserContext) as UserContextType;
  const { projects, createProject } = useProjects();
  const { createProjectMembership } = useProjectMemberships();

  useEffect(() => {
    if (memberships?.length === 0) {
      alert(
        "You have not been added to any projects yet. You won't be able to participate until an admin adds you to one of their projects and assigns you to a work queue.",
      );
    }
    if (memberships?.length === 1) {
      setCurrentProject(memberships[0].projectId);
    }
  }, [user, memberships, setCurrentProject]);

  const onNewProject = async () => {
    const name = prompt("Please enter Project name", "");
    if (name) {
      const project = await createProject({
        name,
      });
      createProjectMembership({
        projectId: project.id!, userId: user!.id, isAdmin: true
      });
      setCurrentProject(project.id);
      await GQL_Client.mutations.addUserToGroup({
        userId: user!.id,
        groupName: project.id+'-admin',
      });
      return project.id;
    }
  };

  return (
    <>
      {(
        <Form>
          <Form.Select
            onChange={(e) => {
              if (e.target.value === "new") {
                onNewProject().then((value) => {
                  if (value) setCurrentProject(value);
                });
              } else {
                setCurrentProject(e.target.value);
              }
            }}
            value={currentProject}
          >
            {!currentProject && <option>Select a Project to work on:</option>}
            {projects?.map((project) => (
              <option value={project.id} key={project.id}>
                {projects.find(p => p.id === project.id)?.name}
              </option>
            ))}
            {<option value="new">Create a new Project</option>}
          </Form.Select>
        </Form>
      )}
    </>
  );
}

export default ProjectSelector;
