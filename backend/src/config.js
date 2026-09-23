import path from "node:path";

export const PORT = Number(process.env.PORT || 8787);
export const HOST = process.env.HOST || "0.0.0.0";
export const DATA_DIR = process.env.IDK_VM_DATA_DIR || path.resolve(process.cwd(), "data");
export const VM_DATA_FILE = path.join(DATA_DIR, "vms.json");
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
export const QEMU_BINARY = process.env.QEMU_BINARY || "qemu-system-x86_64";
export const ENABLE_QEMU = process.env.ENABLE_QEMU === "true";
