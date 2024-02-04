/*
In this file, we determine how the amount should be.
*/
const Joi = require("joi");

const createPayment = {
  body: Joi.object().keys({
    amount: Joi.number().integer().min(10000).max(1000000).required(), // Here, the type of amount must be int & it should not be less than 10,000 & more than 1,000,000
  }),
};

module.exports = {
  createPayment,
};
