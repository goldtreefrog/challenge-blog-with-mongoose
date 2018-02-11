"use strict";

const mongoose = require("mongoose");

// schema to represent a blog
const blogSchema = mongoose.Schema({
  title: { type: String, required: true },
  author: {
    firstName: String,
    lastName: { type: String, required: true }
  },
  content: { type: String, required: true }
});

// virtual to show full name as if a single fields
blogSchema.virtual("authorName").get(function() {
  return `${this.author.firstName} ${this.author.lastName}`.trim();
});

// generic instance method
blogSchema.methods.serialize = function() {
  return {
    id: this._id,
    title: this.title,
    author: this.authorName,
    content: this.content
  };
};

// Define instance methods and virtual properties on our schema
const Blog = mongoose.model("Blog", blogSchema);

module.exports = { Blog };
