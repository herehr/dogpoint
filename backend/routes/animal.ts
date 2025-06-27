import { Router } from 'express';

const router = Router();

// Sample animal list (you can later connect this to a database)
const animals = [
  { id: '1', name: 'Fluffy', species: 'Dog', age: 3 },
  { id: '2', name: 'Whiskers', species: 'Cat', age: 2 },
];

// GET /api/animals
router.get('/', (_req, res) => {
  res.json(animals);
});

export default router;