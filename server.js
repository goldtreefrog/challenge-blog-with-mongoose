"use strict";

const bodyParser = require("body-parser");
const express = require("express");
const mongoose = require("mongoose");

// use built in es6 promises rather than Mongoose ones
mongoose.Promise = global.Promise;

// use config file
const { PORT, DATABASE_URL } = require("./config");
// use models
const { Blog } = require("./models");

const app = express();
app.use(bodyParser.json());

// GET requests to /blogs => return all blog posts
app.get("/blogs", (req, res) => {
  Blog.find()
    // we could limit but db is very small.
    // .limit(10)
    // success callback: for each blog we get back, we'll
    // call the `.serialize` instance method we've created in
    // models.js in order to only expose the data we want the API return.
    .then(blogs => {
      res.json({
        blogs: blogs.map(blog => blog.serialize())
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    });
});

// GET request by single ID
app.get("/blogs/:id", (req, res) => {
  Blog
    // this is a convenience method Mongoose provides for searching
    // by the object _id property
    .findById(req.params.id)
    .then(blog => res.json(blog.serialize()))
    .catch(err => {
      console.error(err);
      // res.status(500).json({ message: "Internal server error" });
      if (err.name === "CastError") {
        res.status(410).json({ message: `Id (${req.params.id}) not found` });
      }
      res.status(404).json({ message: "Internal server error: " + err });
    });
});

// Create a new blog record.
// Note: For author, I allow firstName to be missing but require lastName. (Some authors only have one name.)
app.post("/blogs", (req, res) => {
  const requiredFields = ["title", "author", "content"];
  requiredFields.forEach(function(field) {
    if (!(field in req.body) || req.body[field].length === 0) {
      const errMessage = `The field '${field}' is required and cannot be blank. Please add.`;
      console.error(errMessage);
      return res.status(400).send(errMessage);
    } else if (field === "author") {
      if (!req.body.author.lastName || req.body.author.lastName.length === 0) {
        const errMessage =
          "The author fields must include lastName. Please add. (If the author has but one name, put it in the lastName field and leave out the firstName field.)";
        console.error(errMessage);
        return res.status(400).send(errMessage);
      }
    }
  });

  Blog.create({
    title: req.body.title,
    author: { firstName: req.body.author.firstName || "", lastName: req.body.author.lastName },
    content: req.body.content
  })
    .then(function(blog) {
      res.status(201).json(blog.serialize());
    })
    .catch(function(err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error. Record not created." });
    });
});

app.put("/blogs/:id", (req, res) => {
  // ensure that the id in the request path and the one in request body match and both are present
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    const errMessage = `Error: Request path ID (${req.params.id}) and request body ID (${req.body.id}) must match (and not be missing)`;
    console.error(errMessage);
    return res.status(400).json({ message: errMessage });
  }

  const toUpdate = {};
  const updateableFields = ["title", "author", "content"];
  updateableFields.forEach(field => {
    if (field in req.body) {
      if (field === "author") {
        if (!req.body.author.lastName) {
          const errMessage = "To update 'author,' you must include 'lastName.' Record not updated.";
          console.error(errMessage);
          return res.status(400).json({ message: errMessage });
        } // NOTE: You also need to deal with a missing first name. If there was one before but not now, it will be obliterated and replaced with "undefined." Seriously, nesting can be a bad idea...
      }
      toUpdate[field] = req.body[field];
    }
  });

  Blog.findByIdAndUpdate(req.params.id, { $set: toUpdate })
    .then(function(blog) {
      res.status(200).json("Update successful.");
      // res.status(204).json("Hi there!");
      // .end();  //Blog.findById(req.params.id).serialize
    })
    .catch(err => res.status(500).json("Internal server error probably prevented update, but you had better check the data."));
});

app.delete("/blogs/:id", (req, res) => {
  Blog.findByIdAndRemove(req.params.id)
    .then(blog => res.status(200).json({ message: `Record (id:${req.params.id}) successfully deleted` }))
    // .then(blog => res.status(204).end())
    .catch(err => res.status(500).json({ message: "Internal server error" }));
});

// catch-all endpoint if client makes request to non-existent endpoint
app.use("*", function(req, res) {
  res.status(404).json({ message: "Not Found" });
});

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl, port = PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, { useMongoClient: true }, err => {
      if (err) {
        return reject(err);
      }
      server = app
        .listen(port, () => {
          console.log(`Your app is listening on port ${port}`);
          resolve();
        })
        .on("error", err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log("Closing server");
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };
