import {useCallback, useEffect, useState} from 'react';
import {AppInspector} from 'react-native-app-inspector';
import {todoApi, type Todo} from './todoApi';

export interface UseTodos {
  todos: Todo[];
  loading: boolean;
  saving: boolean;
  add: (title: string) => Promise<void>;
  toggle: (todo: Todo) => void;
  remove: (todo: Todo) => void;
}

/**
 * Owns the todo list and the API orchestration. Every mutation reports a user
 * action to the inspector and the API client reports the network call, so the
 * timeline fills up naturally as you use the app.
 */
export function useTodos(): UseTodos {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    todoApi.fetchTodos().then(list => {
      setTodos(list);
      setLoading(false);
      AppInspector.markInteractive();
    });
  }, []);

  const add = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    AppInspector.trackAction('todo_add', {title: trimmed});
    setSaving(true);
    const created = await todoApi.createTodo(trimmed);
    setTodos(prev => [created, ...prev]);
    setSaving(false);
  }, []);

  const toggle = useCallback((todo: Todo) => {
    AppInspector.trackAction('todo_toggle', {id: todo.id, done: !todo.done});
    const next = {...todo, done: !todo.done};
    setTodos(prev => prev.map(t => (t.id === todo.id ? next : t)));
    todoApi.updateTodo(next);
  }, []);

  const remove = useCallback((todo: Todo) => {
    AppInspector.trackAction('todo_delete', {id: todo.id});
    setTodos(prev => prev.filter(t => t.id !== todo.id));
    todoApi.deleteTodo(todo.id);
  }, []);

  return {todos, loading, saving, add, toggle, remove};
}
