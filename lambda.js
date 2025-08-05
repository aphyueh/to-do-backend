// lambda.js
const { ApolloServer, gql } = require('apollo-server-lambda');
const AWS = require('aws-sdk');
const { nanoid } = require('nanoid');

// S3 setup for database storage
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET;
const FILE_KEY = 'database.json';

// Database helper functions
const readDatabase = async () => {
  try {
    const result = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: FILE_KEY
    }).promise();
    return JSON.parse(result.Body.toString());
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      // Initialize with default data if file doesn't exist
      const defaultData = { users: [], todos: [] };
      await writeDatabase(defaultData);
      return defaultData;
    }
    throw error;
  }
};

const writeDatabase = async (data) => {
  await s3.putObject({
    Bucket: BUCKET_NAME,
    Key: FILE_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  }).promise();
};

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
    users: [User]
    hello: String
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
    hello: () => 'Hello from AWS Lambda GraphQL!',
    users: async () => {
      const db = await readDatabase();
      return db.users;
    },
    todos: async (_, { userId }) => {
      const db = await readDatabase();
      return db.todos.filter(t => t.userId === userId);
    },
  },
  Mutation: {
    signup: async (_, { name, email }) => {
      const db = await readDatabase();
      const exists = db.users.find(u => u.email === email);
      if (exists) throw new Error("User already exists");
      
      const user = { id: nanoid(), name, email };
      db.users.push(user);
      await writeDatabase(db);
      return user;
    },
    login: async (_, { email }) => {
      const db = await readDatabase();
      const user = db.users.find(u => u.email === email);
      if (!user) throw new Error("User not found");
      return user;
    },
    addTodo: async (_, { userId, text }) => {
      const db = await readDatabase();
      const todo = { id: nanoid(), text, userId, completed: false };
      db.todos.push(todo);
      await writeDatabase(db);
      return todo;
    },
    deleteTodo: async (_, { id }) => {
      const db = await readDatabase();
      db.todos = db.todos.filter(t => t.id !== id);
      await writeDatabase(db);
      return true;
    },
    toggleTodoCompleted: async (_, { id }) => {
      const db = await readDatabase();
      const todo = db.todos.find(t => t.id === id);
      if (!todo) throw new Error("Todo not found");

      todo.completed = !todo.completed;
      await writeDatabase(db);
      return todo;
    },
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true,
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return error;
  }
});

// Export Lambda handler
exports.handler = server.createHandler({
  cors: {
    origin: true,
    credentials: true,
  },
});