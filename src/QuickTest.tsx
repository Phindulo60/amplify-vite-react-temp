/* Generate a minimal UI to test the useOptimisticUpdates hook */
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'
Amplify.configure(outputs)

import { useState } from 'react';
import { useOptimisticUpdates,client } from "./useOptimisticUpdates";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";


export default function QuickTest() {
    return (
      <div>
        <h1>QuickTest</h1>
        <CategoryList />
      </div>
    );
}

function CategoryList() {
    const { data, create, update, delete: remove } =
        useOptimisticUpdates("Category",
            () => client.models.Category.categoriesByProjectId({ projectId: "01c449c5-66f1-4658-82be-a0f938f129d5" }),
            { filter: { projectId: { eq: "01c449c5-66f1-4658-82be-a0f938f129d5" } } });

    const [newCategoryName, setNewCategoryName] = useState("");

    const handleCreate = () => {
        if (newCategoryName) {
            create({ name: newCategoryName, projectId: "01c449c5-66f1-4658-82be-a0f938f129d5"});
            setNewCategoryName("");
        }
    };

    return (
        <div>
            <h2>Categories</h2>
            <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New Category name"
            />
            <button onClick={handleCreate}>Create Category</button>
            {data?.data ? (
                data.data.map((p: {id: string, name: string}) => (
                    <div key={p.name}>
                        {p.name}
                        <button onClick={() => update({id: p.id, name: p.name + " (updated)"})}>
                            Update
                        </button>
                        <button onClick={() => remove({id: p.id})}>Delete</button>
                    </div>
                ))
            ) : (
                "No data"
            )}
        </div>
    );
}


