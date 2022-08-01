// Compare object titles alphabetically (case-insensitive)
const compareByTitle = (itemA, itemB) => {
  const titleA = itemA.title.toLowerCase();
  const titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } if (titleA > titleB) {
    return 1;
  }
  return 0;
};

module.exports = {
  // return the list of todo lists sorted by completion status and title.
  sortTodoLists(todoLists) {
    const undone = todoLists.filter((todoList) => !todoList.isDone());
    const done = todoLists.filter((todoList) => todoList.isDone());
    undone.sort(compareByTitle);
    done.sort(compareByTitle);
    return [].concat(undone, done);
  },

  // sort a list of todos
  sortTodos(todoList) {
    const undone = todoList.todos.filter((todo) => !todo.isDone());
    const done = todoList.todos.filter((todo) => todo.isDone());
    undone.sort(compareByTitle);
    done.sort(compareByTitle);
    return [].concat(undone, done);
  },
};
