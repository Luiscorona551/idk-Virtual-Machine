import { spawn } from "node:child_process";
import { ENABLE_QEMU, QEMU_BINARY } from "./config.js";

const running = new Map();

export function qemuStatus() {
  return { enabled: ENABLE_QEMU, binary: QEMU_BINARY, running: [...running.keys()] };
}

export function startQemu(vm) {
  if (!ENABLE_QEMU) {
    const error = new Error("QEMU execution is disabled. Set ENABLE_QEMU=true on a dedicated VM host.");
    error.code = "QEMU_DISABLED";
    throw error;
  }
  if (running.has(vm.id)) return running.get(vm.id);

  const args = [
    "-name", vm.name,
    "-m", String(vm.ramMb),
    "-smp", String(vm.cpuCores),
    "-display", "none",
    "-nodefaults"
  ];

  const child = spawn(QEMU_BINARY, args, { stdio: "ignore" });
  const processInfo = { pid: child.pid, startedAt: new Date().toISOString() };
  running.set(vm.id, processInfo);

  child.once("exit", () => running.delete(vm.id));
  child.once("error", () => running.delete(vm.id));
  return processInfo;
}

export function stopQemu(id) {
  const info = running.get(id);
  if (!info) return false;
  try { process.kill(info.pid, "SIGTERM"); } catch {}
  running.delete(id);
  return true;
}

export function restartQemu(vm) {
  stopQemu(vm.id);
  return startQemu(vm);
}
