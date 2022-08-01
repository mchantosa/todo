const express = require('express');
const morgan = require('morgan');
const flash = require('express-flash');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const store = require('connect-loki');
const TodoList = require('./lib/todolist');
const Todo = require('./lib/todo');
const { sortTodoLists, sortTodos } = require('./lib/sort');

const app = express();
const host = 'localhost';
const port = 3000;
const LokiStore = store(session);

app.set('views', './views');
app.set('view engine', 'pug');

app.use(morgan('common'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: '/',
    secure: false,
  },
  name: 'launch-school-todos-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'this is not very secure',
  store: new LokiStore({}),
}));

app.use(flash());

// Set up persistent session data
app.use((req, res, next) => {
  if (!('todoLists' in req.session)) {
    req.session.todoLists = [];
  }

  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Set up persistent session data
app.use((req, res, next) => {
  const todoLists = [];
  if ('todoLists' in req.session) {
    req.session.todoLists.forEach((todoList) => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;
  next();
});

// eslint-disable-next-line max-len
const loadTodoList = (todoListId, todoLists) => todoLists.find((todoList) => todoList.id === todoListId);
const loadTodo = (toDoListID, todoId, todoLists) => {
  const toDoList = loadTodoList(toDoListID, todoLists);
  if (!toDoList) return undefined;
  return toDoList.todos.find((todo) => todo.id === todoId);
};

app.get('/', (req, res) => {
  res.redirect('/lists');
});

app.get('/lists', (req, res) => {
  res.render('lists', {
    todoLists: sortTodoLists(req.session.todoLists),
  });
});

app.get('/lists/new', (req, res) => {
  res.render('new-list');
});

app.post(
  '/lists',
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('The list title is required.')
      .isLength({ max: 100 })
      .withMessage('List title must be between 1 and 100 characters.')
      .custom((title, { req }) => {
        const { todoLists } = req.session;
        const duplicate = todoLists.find((list) => list.title === title);
        return duplicate === undefined;
      })
      .withMessage('List title must be unique.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash('error', message.msg));
      res.render('new-list', {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash('success', 'The todo list has been created.');
      res.redirect('/lists');
    }
  },
);

// Render individual todo list and its todos
app.get('/lists/:todoListId', (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (todoList === undefined) {
    next(new Error('Not found.'));
  } else {
    res.render('list', {
      todoList,
      todos: sortTodos(todoList),
    });
  }
});

// toggle a todo
app.post('/lists/:todoListId/todos/:todoId/toggle', (req, res, next) => {
  const { todoListId, todoId } = { ...req.params };
  const todo = loadTodo(+todoListId, +todoId, req.session.todoLists);
  if (!todo) {
    next(new Error('Not found'));
  } else if (todo.isDone()) {
    todo.markUndone();
    req.flash('success', `${todo.title} has been marked undone`);
  } else {
    todo.markDone();
    req.flash('success', `${todo.title} has been marked done`);
  }
  res.redirect(`/lists/${todoListId}`);
});

// Remove todo
app.post('/lists/:todoListId/todos/:todoId/destroy', (req, res, next) => {
  const { todoListId, todoId } = { ...req.params };
  const todo = loadTodo(+todoListId, +todoId, req.session.todoLists);

  if (!todo) {
    next(new Error('Not found'));
  } else {
    const { title } = todo;
    const todoList = loadTodoList(+todoListId, req.session.todoLists);
    todoList.removeAt(todoList.findIndexOf(todo));
    req.flash('success', `${title} has been deleted`);
    res.redirect(`/lists/${todoListId}`);
  }
});

// Check all
app.post('/lists/:todoListId/complete_all', (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);

  if (!todoList) {
    next(new Error(`Todo list by ID: ${todoListId} not found`));
  } else {
    todoList.todos.forEach((todo) => todo.markDone());
    req.flash('success', 'All todos have been marked "done"');
    res.redirect(`/lists/${todoListId}`);
  }
});

// Make a new todo
app.post(
  '/lists/:todoListId/todos',
  [
    body('todoTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('The list title is required.')
      .isLength({ max: 100 })
      .withMessage('List title must be between 1 and 100 characters.'),
  ],
  (req, res, next) => {
    const { todoListId } = { ...req.params };
    const todoList = loadTodoList(+todoListId, req.session.todoLists);
    const title = req.body.todoTitle;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash('error', message.msg));
      res.render('list', {
        flash: req.flash(),
        todoList,
        todos: sortTodos(todoList),
      });
    } else if (!todoList) {
      next(new Error(`Not a valid todo list ID: ${todoListId}`));
    } else {
      todoList.add(new Todo(title));
      req.flash('success', `${title} added to todos`);
      res.redirect(`/lists/${todoListId}`);
    }
  },
);

// Edit a todo list
app.get('/lists/:todoListId/edit', (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error(`Todo list ID: ${todoListId} not found`));
  } else {
    res.render('edit-list', {
      todoList,
    });
  }
});

// Delete a todo list
app.post('/lists/:todoListId/destroy', (req, res, next) => {
  const { todoListId } = req.params;
  const todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error(`Todo list ID: ${todoListId} not found`));
  }

  const index = req.session.todoLists.indexOf(todoList);
  const { title } = todoList;
  if (index < 0) {
    next(new Error(`The list index for ${title} not found`));
  } else {
    req.session.todoLists.splice(index, 1);
    req.flash('success', `Todo list "${title}" was deleted`);
    res.redirect('/lists');
  }
});

// Edit todo name
app.post(
  '/lists/:todoListId/edit',
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('The todo list title is required.')
      .isLength({ max: 100 })
      .withMessage('Todo list title must be between 1 and 100 characters.')
      .custom((title, { req }) => {
        const { todoLists } = req.session;
        const duplicate = todoLists.find((list) => list.title === title);
        return duplicate === undefined;
      })
      .withMessage('List title must be unique'),
  ],
  (req, res, next) => {
    const { todoListId } = req.params;
    const todoList = loadTodoList(+todoListId, req.session.todoLists);
    const title = req.body.todoListTitle;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((message) => req.flash('error', message.msg));
      res.render('list', {
        flash: req.flash(),
        todoList,
        todos: sortTodos(todoList),
      });
    } else if (!todoList) {
      next(new Error(`Todo list ID: ${todoListId} not found`));
    } else {
      todoList.setTitle(title);
      req.flash('success', `Todo list title updated to "${title}"`);
      res.redirect(`/lists/${todoListId}`);
    }
  },
);

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});
