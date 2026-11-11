import crypto from "node:crypto";

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
