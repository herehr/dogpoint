"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var moderatorController_1 = require("../controllers/moderatorController");
var checkAdmin_1 = require("../middleware/checkAdmin");
var router = express.Router();
router.get('/', checkAdmin_1.checkAdmin, moderatorController_1.getAllModerators);
exports.default = router;
