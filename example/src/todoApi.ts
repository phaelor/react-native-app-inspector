import {AppInspector} from 'react-native-app-inspector';

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

const BASE = 'https://api.todos.dev';

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * A fake API client. Each call simulates latency and reports itself to the
 * inspector timeline via AppInspector.trackNetwork — exactly how a real
 * fetch/XHR interceptor would feed it.
 */
async function request<T>(
  method: string,
  path: string,
  ms: number,
  result: T,
): Promise<T> {
  const start = Date.now();
  await delay(ms);
  AppInspector.trackNetwork({
    method,
    url: `${BASE}${path}`,
    status: 200,
    durationMs: Date.now() - start,
  });
  return result;
}

let seq = 3;
const seed: Todo[] = [
  {id: '1', title: 'Set up CI', done: true},
  {id: '2', title: 'Wire the performance timeline', done: true},
  {id: '3', title: 'Ship the Todo example', done: false},
];

export const todoApi = {
  fetchTodos: (): Promise<Todo[]> => request('GET', '/todos', 600, [...seed]),
  createTodo: (title: string): Promise<Todo> => {
    const todo: Todo = {id: String(++seq), title, done: false};
    // Saving is intentionally variable so some calls land as "slow" (>1s).
    const latency = 400 + Math.floor(Math.random() * 1400);
    return request('POST', '/todos', latency, todo);
  },
  updateTodo: (todo: Todo): Promise<Todo> =>
    request('PATCH', `/todos/${todo.id}`, 300, todo),
  deleteTodo: (id: string): Promise<string> =>
    request('DELETE', `/todos/${id}`, 250, id),
};
