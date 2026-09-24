const $ = s => document.querySelector(s);
const views = { machines: $('#machines'), create: $('#create'), storage: $('#storage') };

const params = new URLSearchParams(location.search);
const configuredApi = params.get('idkApi');
const API_BASE = (configuredApi || 'http://localhost:8787/api').replace(/\/$/, '');
const API = API_BASE.endsWith('/api/vm') ? API_BASE : API_BASE + '/vm';

let machines = [];
let connected = false;

function esc(x) {
  return String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function show(v) {
  Object.values(views).forEach(x => x.classList.add('hidden'));
  views[v].classList.remove('hidden');
  $('#title').textContent = v === 'machines' ? 'My Machines' : v === 'create' ? 'Create VM' : 'Storage';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === v));
}
function setBackendState(ok, message = '') {
  connected = ok;
  const badge = document.querySelector('.side-bottom');
  if (badge) badge.innerHTML = '<span class="dot"></span> Backend: ' + (ok ? 'Connected' : 'Not connected');
  document.querySelector('.pill')?.replaceChildren(document.createTextNode(ok ? 'BACKEND CONNECTED' : 'CONFIG ONLY'));
  if (message) console.warn(message);
}
async function api(path, options = {}) {
  const res = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'VM backend request failed');
  return data;
}
function networkValue() { return $('#network').value.toLowerCase(); }
function displayValue() { return $('#display').value === 'VirtIO GPU' ? 'virtio' : $('#display').value.toLowerCase(); }
function toForm(vm) {
  $('#name').value = vm.name;
  $('#cpu').value = vm.cpuCores;
  $('#ram').value = Math.round(vm.ramMb / 1024);
  $('#disk').value = vm.diskGb;
  $('#network').value = vm.network[0].toUpperCase() + vm.network.slice(1);
  $('#iso').value = vm.iso || '';
  $('#display').value = vm.display === 'virtio' ? 'VirtIO GPU' : vm.display === 'vga' ? 'VGA' : 'Default';
  $('#sound').value = vm.sound === false ? 'Disabled' : 'Enabled';
}
function render() {
  const grid = $('#machineGrid');
  $('#empty').style.display = machines.length ? 'none' : 'block';
  grid.innerHTML = machines.map((m, i) => {
    const status = m.status || 'stopped';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<article class="machine">
      <div class="machine-top"><div><h2>${esc(m.name)}</h2><p>Virtual machine profile</p></div><span class="status">${label}</span></div>
      <div class="specs">
        <div class="spec"><small>CPU</small><b>${m.cpuCores} cores</b></div>
        <div class="spec"><small>RAM</small><b>${(m.ramMb / 1024).toFixed(0)} GB</b></div>
        <div class="spec"><small>DISK</small><b>${m.diskGb} GB</b></div>
        <div class="spec"><small>NETWORK</small><b>${esc(m.network)}</b></div>
      </div>
      <div class="machine-actions">
        <button class="secondary" onclick="editVm(${i})">Settings</button>
        ${status === 'running'
          ? '<button class="secondary" onclick="stopVm(' + i + ')">Stop</button>'
          : '<button class="primary" onclick="startVm(' + i + ')">Start</button>'}
      </div>
    </article>`;
  }).join('');
}
async function refresh() {
  try {
    const health = await api('/health');
    setBackendState(Boolean(health.ok));
    const data = await api('/vms');
    machines = Array.isArray(data.vms) ? data.vms : [];
    render();
  } catch (error) {
    setBackendState(false, error.message);
    machines = [];
    render();
  }
}
async function startVm(i) {
  try {
    const data = await api('/vms/' + encodeURIComponent(machines[i].id) + '/start', { method: 'POST', body: '{}' });
    machines[i].status = data.status || 'running';
    render();
  } catch (error) {
    alert(error.message);
  }
}
async function stopVm(i) {
  try {
    const data = await api('/vms/' + encodeURIComponent(machines[i].id) + '/stop', { method: 'POST', body: '{}' });
    machines[i].status = data.status || 'stopped';
    render();
  } catch (error) {
    alert(error.message);
  }
}
async function editVm(i) {
  const vm = machines[i];
  toForm(vm);
  $('#vmForm').dataset.edit = vm.id;
  show('create');
}
window.editVm = editVm;
window.startVm = startVm;
window.stopVm = stopVm;

document.querySelectorAll('.nav').forEach(n => n.onclick = () => show(n.dataset.view));
$('#createTop').onclick = () => {
  delete $('#vmForm').dataset.edit;
  $('#vmForm').reset();
  $('#name').value = 'My Idk VM';
  $('#cpu').value = 4;
  $('#ram').value = 8;
  $('#disk').value = 64;
  show('create');
};
$('#createEmpty').onclick = () => $('#createTop').click();
$('#cancel').onclick = () => show('machines');

$('#vmForm').onsubmit = async e => {
  e.preventDefault();
  const body = {
    name: $('#name').value.trim(),
    cpuCores: Number($('#cpu').value),
    ramMb: Number($('#ram').value) * 1024,
    diskGb: Number($('#disk').value),
    network: networkValue(),
    iso: $('#iso').value.trim(),
    display: displayValue(),
    sound: $('#sound').value === 'Enabled'
  };
  try {
    const editId = e.target.dataset.edit;
    const data = editId
      ? await api('/vms/' + encodeURIComponent(editId), { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/vms', { method: 'POST', body: JSON.stringify(body) });
    if (editId) machines = machines.map(vm => vm.id === editId ? data.vm : vm);
    else machines.push(data.vm);
    delete e.target.dataset.edit;
    render();
    show('machines');
  } catch (error) {
    alert(error.message);
  }
};

refresh();
