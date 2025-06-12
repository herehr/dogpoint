"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var authController_1 = require("../controllers/authController");
var router = express.Router();
router.post('/login', authController_1.login);
exports.default = router;
