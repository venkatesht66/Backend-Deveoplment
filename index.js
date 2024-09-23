const express = require('express');
const app = express();
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

app.use(express.json());

const dbPath = path.join(__dirname, 'index.db');
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        name TEXT,
        password TEXT
      );
      CREATE TABLE IF NOT EXISTS Address (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        street TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        FOREIGN KEY (user_id) REFERENCES User(id)
      );
    `);
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000');
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post('/register/', async (request, response) => {
  const { username, name, password, street, city, state, zip } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const getUserQuery = `SELECT * FROM User WHERE username = '${username}';`;
    const getUser = await db.get(getUserQuery);

    if (getUser !== undefined) {
      response.status(400);
      response.send('User already exists');
    } else {
      if (password.length < 5) {
        response.status(400);
        response.send('Password is too short');
      } else {
        const insertUserQuery = `
          INSERT INTO User (username, name, password)
          VALUES ('${username}', '${name}', '${hashedPassword}');
        `;
        const result = await db.run(insertUserQuery);
        const userId = result.lastID;

        const insertAddressQuery = `
          INSERT INTO Address (user_id, street, city, state, zip)
          VALUES (${userId}, '${street}', '${city}', '${state}', '${zip}');
        `;
        await db.run(insertAddressQuery);

        response.status(200);
        response.send('User and address created successfully');
      }
    }
  } catch (error) {
    response.status(500);
    response.send('Internal Server Error');
  }
});

module.exports = app;
