"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnimalById = exports.getAllAnimals = void 0;
const prisma_1 = require("../services/prisma");

const getAllAnimals = async (req, res) => {
    try {
        const animals = await prisma_1.default.animal.findMany({
            include: { galerie: true },
        });
        res.json(animals);
    } catch (err) {
        console.error('Error fetching animals:', err);
        res.status(500).json({ error: 'Failed to fetch animals' });
    }
};
exports.getAllAnimals = getAllAnimals;

const getAnimalById = async (req, res) => {
    const { id } = req.params;
    try {
        const animal = await prisma_1.default.animal.findUnique({
            where: { id },
            include: { galerie: true },
        });
        if (!animal) {
            return res.status(404).json({ error: 'Animal not found' });
        }
        res.json(animal);
    } catch (err) {
        console.error('Error fetching animal by ID:', err);
        res.status(500).json({ error: 'Failed to fetch animal' });
    }
};
exports.getAnimalById = getAnimalById;