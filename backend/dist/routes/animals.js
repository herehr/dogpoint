"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// GET /api/animals - List all animals
router.get('/', async (_req, res) => {
    try {
        const animals = await prisma.animal.findMany({
            include: {
                galerie: true, // Include media gallery if defined in schema
            },
        });
        res.json(animals);
    }
    catch (error) {
        console.error('Error fetching animals:', error);
        res.status(500).json({ error: 'Failed to fetch animals' });
    }
});
exports.default = router;
