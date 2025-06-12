"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var animalController_1 = require("../controllers/animalController");
var router = express.Router();
router.get('/', animalController_1.getAllAnimals);
router.get('/:id', animalController_1.getAnimalById);
exports.default = router;
