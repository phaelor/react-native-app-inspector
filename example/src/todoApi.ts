export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

const BASE = 'https://jsonplaceholder.typicode.com';

interface RemoteTodo {
  id: number;
  title: string;
  completed: boolean;
}

/** Real API client — no inspector code; capture is automatic. */
export const todoApi = {
  fetchTodos: async (): Promise<Todo[]> => {
    const res = await fetch(`${BASE}/todos?_limit=5`);
    const list = (await res.json()) as RemoteTodo[];
    return list.map(t => ({
      id: String(t.id),
      title: t.title,
      done: t.completed,
    }));
  },
  createTodo: async (title: string): Promise<Todo> => {
    const res = await fetch(`${BASE}/todos`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title, completed: false, userId: 1}),
    });
    const created = (await res.json()) as {id: number};
    return {id: String(created.id), title, done: false};
  },
  updateTodo: async (todo: Todo): Promise<Todo> => {
    await fetch(`${BASE}/todos/${todo.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({completed: todo.done}),
    }).catch(() => {});
    return todo;
  },
  deleteTodo: async (id: string): Promise<string> => {
    await fetch(`${BASE}/todos/${id}`, {method: 'DELETE'}).catch(() => {});
    return id;
  },
};
