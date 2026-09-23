import { promises as fs } from "node:fs";
import { DATA_DIR, VM_DATA_FILE } from "./config.js";

const defaults = [];

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(VM_DATA_FILE); }
  catch { await fs.writeFile(VM_DATA_FILE, JSON.stringify(defaults, null, 2)); }
}

export async function listVMs() {
  await ensureStore();
  return JSON.parse(await fs.readFile(VM_DATA_FILE, "utf8"));
}

export async function saveVMs(vms) {
  await ensureStore();
  const temp = VM_DATA_FILE + ".tmp";
  await fs.writeFile(temp, JSON.stringify(vms, null, 2));
  await fs.rename(temp, VM_DATA_FILE);
}

export async function getVM(id) {
  return (await listVMs()).find(vm => vm.id === id) || null;
}

export async function createVM(vm) {
  const vms = await listVMs();
  vms.push(vm);
  await saveVMs(vms);
  return vm;
}

export async function updateVM(id, patch) {
  const vms = await listVMs();
  const index = vms.findIndex(vm => vm.id === id);
  if (index === -1) return null;
  vms[index] = { ...vms[index], ...patch, id };
  await saveVMs(vms);
  return vms[index];
}

export async function deleteVM(id) {
  const vms = await listVMs();
  const next = vms.filter(vm => vm.id !== id);
  if (next.length === vms.length) return false;
  await saveVMs(next);
  return true;
}
