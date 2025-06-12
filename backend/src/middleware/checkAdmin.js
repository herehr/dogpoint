"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAdmin = void 0;
var jwt = require("jsonwebtoken");
var checkAdmin = function (req, res, next) {
    var _a;
    var token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Missing token' });
    try {
        var decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'ADMIN')
            return res.status(403).json({ error: 'Admin access required' });
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.checkAdmin = checkAdmin;
