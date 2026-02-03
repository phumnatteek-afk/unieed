import jwt from "jsonwebtoken";

export const signJwt = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

export const verifyJwt = (token) =>
  jwt.verify(token, process.env.JWT_SECRET);
