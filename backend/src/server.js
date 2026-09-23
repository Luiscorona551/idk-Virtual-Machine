import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "node:crypto";
import { CORS_ORIGIN, HOST, PORT } from "./config.js";
import { createVM, deleteVM, getVM, listVMs, updateVM } from "./store.js";
import { qemuStatus, restartQemu, startQemu, stopQemu } from "./qemu.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map(v => v.trim()) }));
app.use(express.json({ limit: "1mb" }));

const allowedNetworks = new Set(["nat", "bridged", "isolated"]);
const allowedDisplays = new Set(["default", "virtio", "vga"]);

function validateVM(input) {
  const name = String(input.name || "").trim();
  const cpuCores = Number(input.cpuCores);
  const ramMb = Number(input.ramMb);
  const diskGb = Number(input.diskGb);
  if (!name) return "VM name is required";
  if (!Number.isInteger(cpuCores) || cpuCores < 1 || cpuCores > 128) return "CPU cores must be 1-128";
  if (!Number.isInteger(ramMb) || ramMb < 256 || ramMb > 1048576) return "RAM must be 256-1048576 MB";
  if (!Number.isInteger(diskGb) || diskGb < 1 || diskGb > 65536) return "Disk size must be 1-65536 GB";
  if (!allowedNetworks.has(input.network || "nat")) return "Invalid network mode";
  if (!allowedDisplays.has(input.display || "default")) return "Invalid display mode";
  return null;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "idk-vm-backend", version: "0.1.0", time: new Date().toISOString() });
});

app.get("/api/host", (req, res) => {
  res.json({ ok: true, virtualization: qemuStatus() });
});

app.get("/api/vms", async (req, res) => {
  res.json({ ok: true, vms: await listVMs() });
});

app.post("/api/vms", async (req, res) => {
  const error = validateVM(req.body);
  if (error) return res.status(400).json({ ok: false, error });
  const now = new Date().toISOString();
  const vm = {
    id: crypto.randomUUID(),
    name: req.body.name.trim(),
    cpuCores: Number(req.body.cpuCores),
    ramMb: Number(req.body.ramMb),
    diskGb: Number(req.body.diskGb),
    network: req.body.network || "nat",
    display: req.body.display || "default",
    sound: req.body.sound !== false,
    iso: String(req.body.iso || "").trim(),
    status: "stopped",
    createdAt: now,
    updatedAt: now
  };
  res.status(201).json({ ok: true, vm: await createVM(vm) });
});

app.get("/api/vms/:id", async (req, res) => {
  const vm = await getVM(req.params.id);
  if (!vm) return res.status(404).json({ ok: false, error: "VM not found" });
  res.json({ ok: true, vm });
});

app.patch("/api/vms/:id", async (req, res) => {
  const current = await getVM(req.params.id);
  if (!current) return res.status(404).json({ ok: false, error: "VM not found" });
  const candidate = { ...current, ...req.body };
  const error = validateVM(candidate);
  if (error) return res.status(400).json({ ok: false, error });
  const vm = await updateVM(req.params.id, { ...candidate, updatedAt: new Date().toISOString() });
  res.json({ ok: true, vm });
});

app.delete("/api/vms/:id", async (req, res) => {
  if (await getVM(req.params.id)) stopQemu(req.params.id);
  const deleted = await deleteVM(req.params.id);
  if (!deleted) return res.status(404).json({ ok: false, error: "VM not found" });
  res.json({ ok: true });
});

app.post("/api/vms/:id/start", async (req, res) => {
  const vm = await getVM(req.params.id);
  if (!vm) return res.status(404).json({ ok: false, error: "VM not found" });
  try {
    const processInfo = startQemu(vm);
    await updateVM(vm.id, { status: "running", updatedAt: new Date().toISOString() });
    res.json({ ok: true, status: "running", process: processInfo });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message, code: error.code || "QEMU_ERROR" });
  }
});

app.post("/api/vms/:id/stop", async (req, res) => {
  const vm = await getVM(req.params.id);
  if (!vm) return res.status(404).json({ ok: false, error: "VM not found" });
  stopQemu(vm.id);
  await updateVM(vm.id, { status: "stopped", updatedAt: new Date().toISOString() });
  res.json({ ok: true, status: "stopped" });
});

app.post("/api/vms/:id/restart", async (req, res) => {
  const vm = await getVM(req.params.id);
  if (!vm) return res.status(404).json({ ok: false, error: "VM not found" });
  try {
    const processInfo = restartQemu(vm);
    await updateVM(vm.id, { status: "running", updatedAt: new Date().toISOString() });
    res.json({ ok: true, status: "running", process: processInfo });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message, code: error.code || "QEMU_ERROR" });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

app.listen(PORT, HOST, () => console.log("Idk VM backend listening on " + HOST + ":" + PORT));
