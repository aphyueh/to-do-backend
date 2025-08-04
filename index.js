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
  type User { id: ID! email: String! }
  type Todo { id: ID! text: String! userId: ID! }
  type Query { todos(userId: ID!): [Todo] }
  type Mutation {
    signup(email: String!, password: String!): User
    login(email: String!, password: String!): User
    addTodo(userId: ID!, text: String!): Todo
    deleteTodo(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    todos: (_, { userId }) => db.data.todos.filter(t => t.userId === userId),
  },
  Mutation: {
    signup: (_, { email }) => {
      const exists = db.data.users.find(u => u.email === email);
      if (exists) throw new Error("User exists");
      const user = { id: nanoid(), email };
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
      const todo = { id: nanoid(), text, userId };
      db.data.todos.push(todo);
      db.write();
      return todo;
    },
    deleteTodo: (_, { id }) => {
      db.data.todos = db.data.todos.filter(t => t.id !== id);
      db.write();
      return true;
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
