const $ = s => document.querySelector(s);
const views = { machines: $('#machines'), create: $('#create'), storage: $('#storage') };
const params = new URLSearchParams(location.search);
const configuredApi = params.get('idkApi');
const API_BASE = (configuredApi || 'http://localhost:8787/api').replace(/\/$/, '');
const API = API_BASE.endsWith('/api/vm') ? API_BASE : API_BASE + '/vm';
let machines = [];
let connected = false;
let importedIso = null;
let partitions = [{ name: 'System', sizeGb: 64, filesystem: 'Unformatted', type: 'Primary' }];

function esc(x) { return String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function show(v) {
  Object.values(views).forEach(x => x.classList.add('hidden'));
  views[v].classList.remove('hidden');
  $('#title').textContent = v === 'machines' ? 'My Machines' : v === 'create' ? 'Create VM' : 'Storage';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === v));
  if (v === 'storage') renderStorage();
}
function setBackendState(ok, message = '') {
  connected = ok;
  const badge = document.querySelector('.side-bottom');
  if (badge) badge.innerHTML = '<span class="dot"></span> Backend: ' + (ok ? 'Connected' : 'Not connected');
  document.querySelector('.pill')?.replaceChildren(document.createTextNode(ok ? 'BACKEND CONNECTED' : 'CONFIG ONLY'));
  if (message) console.warn(message);
}
async function api(path, options = {}) {
  const res = await fetch(API + path, { ...options, headers: { ...(options.body instanceof File ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'VM backend request failed');
  return data;
}
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open('idk-vm-storage', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('isos', { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function dbAll() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => { const r = db.transaction('isos').objectStore('isos').getAll(); r.onsuccess = () => resolve(r.result || []); r.onerror = () => reject(r.error); });
}
async function dbPut(item) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => { const r = db.transaction('isos','readwrite').objectStore('isos').put(item); r.onsuccess = () => resolve(item); r.onerror = () => reject(r.error); });
}
async function dbDelete(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => { const r = db.transaction('isos','readwrite').objectStore('isos').delete(id); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); });
}
function fmtBytes(n) { if (!n) return '0 B'; const units=['B','KB','MB','GB']; let i=0,v=n; while(v>=1024&&i<3){v/=1024;i++;} return v.toFixed(i?1:0)+' '+units[i]; }
function newId() { return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2); }
async function importIso(file) {
  if (!file || !/\.iso$/i.test(file.name)) return alert('Please select an ISO image.');
  const item = { id: newId(), name: file.name, size: file.size, addedAt: new Date().toISOString(), blob: file };
  await dbPut(item);
  importedIso = item;
  $('#iso').value = item.name;
  $('#isoMeta').textContent = fmtBytes(item.size) + ' • Imported into this browser.';
  if (connected) {
    try {
      await api('/isos/' + encodeURIComponent(item.id), { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'X-ISO-Name': encodeURIComponent(item.name) }, body: file });
      $('#isoMeta').textContent = fmtBytes(item.size) + ' • Imported and uploaded to the VM backend.';
    } catch (e) {
      $('#isoMeta').textContent = fmtBytes(item.size) + ' • Stored locally; backend upload failed: ' + e.message;
    }
  }
  renderStorage();
}
async function renderStorage() {
  const list = $('#isoList');
  if (!list) return;
  const isos = await dbAll();
  list.innerHTML = isos.length ? isos.map(x => '<div class="storage-item"><div><strong>'+esc(x.name)+'</strong><span>'+fmtBytes(x.size)+' • '+new Date(x.addedAt).toLocaleString()+'</span></div><div><button class="secondary" onclick="useIso(\''+esc(x.id)+'\')">Attach</button> <button class="secondary" onclick="removeIso(\''+esc(x.id)+'\')">Remove</button></div></div>').join('') : '<div class="storage-placeholder"><div class="big-icon">◫</div><strong>No ISO images imported</strong><span>Use Import ISO to choose an image from your device.</span></div>';
}
window.useIso = async id => { const x=(await dbAll()).find(v=>v.id===id); if(!x)return; importedIso=x; $('#iso').value=x.name; $('#isoMeta').textContent=fmtBytes(x.size)+' • Selected from Storage.'; show('create'); };
window.removeIso = async id => { await dbDelete(id); if(importedIso?.id===id) importedIso=null; renderStorage(); };
function networkValue() { return $('#network').value; }
function displayValue() { return $('#display').value; }
function toForm(vm) {
  $('#name').value=vm.name; $('#cpu').value=vm.cpuCores; $('#cpuModel').value=vm.cpuModel||'host'; $('#ram').value=Math.round(vm.ramMb/1024);
  $('#topology').value=vm.cpuTopology||'simple'; $('#disk').value=vm.diskGb; $('#diskBus').value=vm.diskBus||'sata'; $('#network').value=vm.network||'nat';
  $('#networkAdapter').value=vm.networkAdapter||'virtio'; $('#mac').value=vm.mac||''; $('#display').value=vm.display||'default'; $('#videoMemory').value=vm.videoMemoryMb||32;
  $('#resolution').value=vm.resolution||'1280x720'; $('#sound').value=vm.soundDevice||'hda'; $('#accel3d').value=vm.accel3d?'on':'off';
  $('#firmware').value=vm.firmware||'bios'; $('#bootDevice').value=vm.bootDevice||'disk'; $('#bootOrder').value=(vm.bootOrder||['disk','iso','network']).join(',');
  $('#iso').value=vm.isoName||vm.iso||''; $('#isoMeta').textContent=vm.isoName?'Backend ISO: '+vm.isoName:'No ISO selected'; partitions=Array.isArray(vm.partitions)&&vm.partitions.length?vm.partitions:[{name:'System',sizeGb:vm.diskGb,filesystem:'Unformatted',type:'Primary'}];
  $('#vmForm').dataset.edit=vm.id;
}
function render() {
  const grid=$('#machineGrid'); $('#empty').style.display=machines.length?'none':'block';
  grid.innerHTML=machines.map((m,i)=>{const status=m.status||'stopped'; const label=status.charAt(0).toUpperCase()+status.slice(1);
    return '<article class="machine"><div class="machine-top"><div><h2>'+esc(m.name)+'</h2><p>Virtual hardware profile</p></div><span class="status">'+label+'</span></div><div class="specs"><div class="spec"><small>CPU</small><b>'+m.cpuCores+' cores</b></div><div class="spec"><small>RAM</small><b>'+Math.round(m.ramMb/1024)+' GB</b></div><div class="spec"><small>DISK</small><b>'+m.diskGb+' GB</b></div><div class="spec"><small>DISPLAY</small><b>'+esc(m.display||'default')+'</b></div><div class="spec"><small>AUDIO</small><b>'+esc(m.soundDevice||'hda')+'</b></div><div class="spec"><small>BOOT</small><b>'+esc(m.firmware||'bios')+'</b></div></div><div class="machine-actions"><button class="secondary" onclick="editVm('+i+')">Settings</button>'+(status==='running'?'<button class="secondary" onclick="stopVm('+i+')">Stop</button>':'<button class="primary" onclick="startVm('+i+')">Start</button>')+'</div></article>';
  }).join('');
}
async function refresh(){try{const health=await api('/health');setBackendState(Boolean(health.ok));const data=await api('/vms');machines=Array.isArray(data.vms)?data.vms:[];render();}catch(e){setBackendState(false,e.message);machines=[];render();}renderStorage();}
async function startVm(i){try{const data=await api('/vms/'+encodeURIComponent(machines[i].id)+'/start',{method:'POST',body:'{}'});machines[i].status=data.status||'running';render();}catch(e){alert(e.message);}}
async function stopVm(i){try{const data=await api('/vms/'+encodeURIComponent(machines[i].id)+'/stop',{method:'POST',body:'{}'});machines[i].status=data.status||'stopped';render();}catch(e){alert(e.message);}}
async function editVm(i){toForm(machines[i]);show('create');}
window.editVm=editVm;window.startVm=startVm;window.stopVm=stopVm;
function resetForm(){delete $('#vmForm').dataset.edit;$('#vmForm').reset();$('#name').value='My Idk VM';$('#cpu').value=4;$('#ram').value=8;$('#disk').value=64;$('#diskBus').value='sata';$('#display').value='default';$('#sound').value='hda';$('#firmware').value='bios';$('#bootDevice').value='disk';$('#bootOrder').value='disk,iso,network';$('#iso').value='';$('#isoMeta').textContent='Choose an ISO from your device.';importedIso=null;partitions=[{name:'System',sizeGb:64,filesystem:'Unformatted',type:'Primary'}];}
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>show(n.dataset.view));
$('#createTop').onclick=()=>{resetForm();show('create');}; $('#createEmpty').onclick=()=>$('#createTop').click(); $('#cancel').onclick=()=>show('machines');
$('#importIso').onclick=()=>$('#isoFile').click(); $('#isoFile').onchange=e=>importIso(e.target.files[0]);
$('#storageImport').onclick=()=>$('#storageFile').click(); $('#storageFile').onchange=e=>importIso(e.target.files[0]);
function renderPartitions(){const el=$('#partitionList');el.innerHTML=partitions.map((p,i)=>'<div class="partition-row"><input value="'+esc(p.name)+'" data-p="name" data-i="'+i+'"><input type="number" min="1" value="'+p.sizeGb+'" data-p="sizeGb" data-i="'+i+'"><select data-p="filesystem" data-i="'+i+'"><option '+(p.filesystem==='Unformatted'?'selected':'')+'>Unformatted</option><option '+(p.filesystem==='NTFS'?'selected':'')+'>NTFS</option><option '+(p.filesystem==='FAT32'?'selected':'')+'>FAT32</option><option '+(p.filesystem==='ext4'?'selected':'')+'>ext4</option></select><button class="secondary" data-remove="'+i+'">Remove</button></div>').join('');el.querySelectorAll('[data-p]').forEach(x=>x.oninput=()=>{partitions[Number(x.dataset.i)][x.dataset.p]=x.type==='number'?Number(x.value):x.value;});el.querySelectorAll('[data-remove]').forEach(x=>x.onclick=()=>{partitions.splice(Number(x.dataset.remove),1);renderPartitions();});}
$('#managePartitions').onclick=()=>{show('storage');$('#partitionManager').classList.remove('hidden');renderPartitions();};
$('#closePartitions').onclick=()=>$('#partitionManager').classList.add('hidden');
$('#addPartition').onclick=()=>{partitions.push({name:'New Partition',sizeGb:10,filesystem:'Unformatted',type:'Primary'});renderPartitions();};
$('#savePartitions').onclick=()=>{const total=partitions.reduce((a,p)=>a+Number(p.sizeGb||0),0);if(total>Number($('#disk').value))return alert('Partition sizes exceed the virtual disk size.');$('#partitionManager').classList.add('hidden');alert('Partition layout saved for this VM configuration. The guest installer can format the virtual disk when installing the OS.');};
$('#vmForm').onsubmit=async e=>{e.preventDefault();const body={name:$('#name').value.trim(),cpuCores:Number($('#cpu').value),ramMb:Number($('#ram').value)*1024,diskGb:Number($('#disk').value),cpuModel:$('#cpuModel').value,cpuTopology:$('#topology').value,diskBus:$('#diskBus').value,network:networkValue(),networkAdapter:$('#networkAdapter').value,mac:$('#mac').value.trim(),display:displayValue(),videoMemoryMb:Number($('#videoMemory').value),resolution:$('#resolution').value,soundDevice:$('#sound').value,accel3d:$('#accel3d').value==='on',firmware:$('#firmware').value,bootDevice:$('#bootDevice').value,bootOrder:$('#bootOrder').value.split(',').map(x=>x.trim()).filter(Boolean),iso:importedIso?.name||$('#iso').value.trim(),isoId:importedIso?.id||'',isoName:importedIso?.name||$('#iso').value.trim(),partitions};
  try{const editId=e.target.dataset.edit;const data=editId?await api('/vms/'+encodeURIComponent(editId),{method:'PATCH',body:JSON.stringify(body)}):await api('/vms',{method:'POST',body:JSON.stringify(body)});if(editId)machines=machines.map(vm=>vm.id===editId?data.vm:vm);else machines.push(data.vm);delete e.target.dataset.edit;render();show('machines');}catch(error){alert(error.message);}};
refresh();