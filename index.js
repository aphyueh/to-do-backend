import { ApolloServer, gql } from 'apollo-server';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

// Setup LowDB with JSONFile
const adapter = new JSONFile('db.json');
const defaultData = { users: [], todos: [] };
const db = new Low(adapter, defaultData);
await db.read();
db.data ||= { users: [], todos: [] };

const typeDefs = gql`
  type User { 
    id: ID! 
    name: String!
    email: String! 
  }
  type Todo { 
    id: ID! 
    text: String! 
    userId: ID! 
    completed: Boolean!
  }
  type Query { 
    todos(userId: ID!): [Todo] 
  }
  type Mutation {
    signup(name: String!, email: String!, password: String!): User
    login(email: String!, password: String!): User
    addTodo(userId: ID!, text: String!): Todo
    deleteTodo(id: ID!): Boolean
    toggleTodoCompleted(id: ID!): Todo
  }
`;

const resolvers = {
  Query: {
    todos: (_, { userId }) => db.data.todos.filter(t => t.userId === userId),
  },
  Mutation: {
    signup: (_, { name , email }) => {
      const exists = db.data.users.find(u => u.email === email);
      if (exists) throw new Error("User already exists");
      const user = { id: nanoid(), name,  email };
      db.data.users.push(user);
      db.write();
      return user;
    },
    login: (_, { email }) => {
      const user = db.data.users.find(u => u.email === email);
      if (!user) throw new Error("User not found");
      return user;
    },
    addTodo: (_, { userId, text }) => {
      const todo = { id: nanoid(), text, userId, completed: false  };
      db.data.todos.push(todo);
      db.write();
      return todo;
    },
    deleteTodo: (_, { id }) => {
      db.data.todos = db.data.todos.filter(t => t.id !== id);
      db.write();
      return true;
    },
    toggleTodoCompleted: (_, { id }) => {
      const todo = db.data.todos.find(t => t.id === id);
      if (!todo) throw new Error("Todo not found");

      todo.completed = !todo.completed;
      db.write();
      return todo;
    },
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
