// A tiny todo list. Lists are plain arrays and every function returns a new array.

export function addTodo(list, title) {
  return [...list, { id: list.length + 1, title, done: false }];
}

export function completeTodo(list, id) {
  return list.map((todo) => (todo.id === id ? { ...todo, done: true } : todo));
}

export function listOpen(list) {
  return list.filter((todo) => !todo.done);
}
