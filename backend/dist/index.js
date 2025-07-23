"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const animals_1 = __importDefault(require("./routes/animals"));
const auth_1 = __importDefault(require("./routes/auth")); // ✅ Import auth routes
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Mount routes
app.use('/api/animals', animals_1.default);
app.use('/api/auth', auth_1.default); // ✅ Add this line
app.get('/', (_req, res) => {
    res.send('Dogpoint backend is running.');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
