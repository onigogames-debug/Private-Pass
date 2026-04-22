/**
 * app.js
 * Main UI Controller for Private Pass
 */

// State
let appKey = null; // AES-GCM Key holding the unlocked vault session
let vault = []; // Array of item objects
let currentFilter = 'all';
let selectedItemId = null;

// DOM Elements
const els = {
  // Screens
  authScreen: document.getElementById('auth-screen'),
  appScreen: document.getElementById('app-screen'),
  
  // Auth
  authForm: document.getElementById('auth-form'),
  passwordInput: document.getElementById('master-password'),
  authError: document.getElementById('auth-error'),
  authSetup: document.getElementById('auth-setup'),
  btnSetup: document.getElementById('btn-setup'),
  
  // Sidebar
  navItems: document.querySelectorAll('.nav-item[data-filter]'),
  btnLock: document.getElementById('btn-lock'),
  btnExport: document.getElementById('btn-export'),
  inputImport: document.getElementById('input-import'),
  
  // List
  searchInput: document.getElementById('search-input'),
  btnAdd: document.getElementById('btn-add'),
  itemList: document.getElementById('item-list'),
  
  // Detail
  emptyState: document.getElementById('empty-state'),
  detailContent: document.getElementById('detail-content'),
  btnSave: document.getElementById('btn-save'),
  btnDelete: document.getElementById('btn-delete'),
  detailIcon: document.getElementById('detail-icon'),
  
  // Form fields
  editTitle: document.getElementById('edit-title'),
  editCategory: document.getElementById('edit-category'),
  editUsername: document.getElementById('edit-username'),
  editPassword: document.getElementById('edit-password'),
  editUrl: document.getElementById('edit-url'),
  editNotes: document.getElementById('edit-notes'),
  
  // Utils
  btnTogglePwd: document.getElementById('btn-toggle-password'),
  copyBtns: document.querySelectorAll('.copy-btn'),
  toast: document.getElementById('toast'),
  
  // New Features
  btnGeneratePwd: document.getElementById('btn-generate-password'),
  strengthBar: document.getElementById('strength-bar'),
  
  // Mobile
  btnMenu: document.getElementById('btn-menu'),
  btnBack: document.getElementById('btn-back'),
  sidebar: document.querySelector('.sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
};

// Initialization
function init() {
  const btnUnlock = document.getElementById('btn-unlock');
  if (VaultCrypto.hasVault()) {
    els.authSetup.classList.add('hidden');
    btnUnlock.classList.remove('hidden');
  } else {
    btnUnlock.classList.add('hidden');
    els.authSetup.classList.remove('hidden');
  }
}

// ----------------------------------------------------
// Auto Lock Feature
// ----------------------------------------------------
let autoLockTimer;
const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes

function resetAutoLock() {
  clearTimeout(autoLockTimer);
  if (appKey) { // only start if vault is unlocked
    autoLockTimer = setTimeout(() => {
      els.btnLock.click();
    }, AUTO_LOCK_MS);
  }
}

['mousemove', 'keydown', 'touchstart'].forEach(event => {
  document.addEventListener(event, resetAutoLock);
});

// ----------------------------------------------------
// Authentication
// ----------------------------------------------------

els.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwd = els.passwordInput.value;
  if(!pwd) return;

  try {
    els.authError.classList.add('hidden');
    const key = await VaultCrypto.deriveKey(pwd);
    
    // Attempt decryption
    const encryptedData = localStorage.getItem('pp_vault_data');
    vault = await VaultCrypto.decryptData(key, encryptedData);
    
    // Success!
    appKey = key;
    els.passwordInput.value = '';
    showApp();
    renderList();
    resetAutoLock();
  } catch(err) {
    console.error(err);
    els.authError.classList.remove('hidden');
  }
});

els.btnSetup.addEventListener('click', async () => {
  const pwd = els.passwordInput.value;
  if(!pwd || pwd.length < 4) {
    alert("Please enter a master password (min 4 chars) in the input above.");
    return;
  }
  
  // Create blank vault format
  vault = [];
  try {
    appKey = await VaultCrypto.deriveKey(pwd);
    await saveVault();
    els.passwordInput.value = '';
    showApp();
    renderList();
  } catch(e) {
    console.error(e);
    alert('Setup failed.');
  }
});

els.btnLock.addEventListener('click', () => {
  appKey = null;
  vault = [];
  selectedItemId = null;
  els.appScreen.classList.add('hidden');
  els.authScreen.classList.remove('hidden');
  init();
  els.passwordInput.value = '';
  els.passwordInput.focus();
  showEmptyState();
});

function showApp() {
  els.authScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
}

// ----------------------------------------------------
// Mobile UI Logic
// ----------------------------------------------------
els.btnMenu.addEventListener('click', () => {
  els.sidebar.classList.add('open');
  els.sidebarBackdrop.classList.add('show');
});

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.sidebarBackdrop.classList.remove('show');
}
els.sidebarBackdrop.addEventListener('click', closeSidebar);

els.btnBack.addEventListener('click', () => {
  document.body.classList.remove('view-detail');
  selectedItemId = null;
  renderList();
});

// ----------------------------------------------------
// Core Vault Operations
// ----------------------------------------------------

async function saveVault() {
  if(!appKey) return;
  try {
    const encData = await VaultCrypto.encryptData(appKey, vault);
    localStorage.setItem('pp_vault_data', encData);
  } catch(e) {
    console.error(e);
    alert('Failed to save vault!');
  }
}

// ----------------------------------------------------
// UI Logic - List Pane
// ----------------------------------------------------
els.navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    els.navItems.forEach(n => n.classList.remove('active'));
    e.currentTarget.classList.add('active');
    currentFilter = e.currentTarget.dataset.filter;
    closeSidebar();
    document.body.classList.remove('view-detail');
    renderList();
  });
});

els.searchInput.addEventListener('input', renderList);

function renderList() {
  const query = els.searchInput.value.toLowerCase();
  
  // Filter
  const filtered = vault.filter(item => {
    if(currentFilter !== 'all' && item.category !== currentFilter) return false;
    if(query) {
      return (item.title||'').toLowerCase().includes(query) || 
             (item.username||'').toLowerCase().includes(query) ||
             (item.url||'').toLowerCase().includes(query);
    }
    return true;
  });

  // Sort alphabetical
  filtered.sort((a,b) => (a.title||'').localeCompare(b.title||''));

  els.itemList.innerHTML = '';
  
  if(filtered.length === 0) {
    els.itemList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No items found.</div>`;
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement('div');
    div.className = `list-item ${selectedItemId === item.id ? 'selected' : ''}`;
    
    // Icon depends on category
    const isNotes = item.category === 'Notes';
    const iconClass = isNotes ? 'notes' : '';
    const iconHtml = isNotes ? '<i class="ph-fill ph-note"></i>' : '<i class="ph-fill ph-globe"></i>';

    const fallbackUsername = isNotes ? "Secure Note" : (item.username || "No Username");

    div.innerHTML = `
      <div class="item-icon ${iconClass}">
        ${iconHtml}
      </div>
      <div class="item-info">
        <div class="item-title">${escapeHTML(item.title) || 'Untitled'}</div>
        <div class="item-username">${escapeHTML(fallbackUsername)}</div>
      </div>
    `;
    
    div.addEventListener('click', () => selectItem(item.id));
    els.itemList.appendChild(div);
  });
}

function selectItem(id) {
  selectedItemId = id;
  const item = vault.find(i => i.id === id);
  renderList(); // highlight sidebar
  
  if(!item) {
    showEmptyState();
    return;
  }
  
  // Hydrate Details
  els.editTitle.value = item.title || '';
  els.editCategory.value = item.category || 'Logins';
  els.editUsername.value = item.username || '';
  els.editPassword.value = item.password || '';
  els.editUrl.value = item.url || '';
  els.editNotes.value = item.notes || '';
  
  els.editPassword.type = 'password';
  els.btnTogglePwd.innerHTML = '<i class="ph ph-eye"></i>';
  
  calculateStrength(item.password);
  updateDetailIcon(item.category);

  els.emptyState.classList.add('hidden');
  els.detailContent.classList.remove('hidden');
  document.body.classList.add('view-detail');
}

function updateDetailIcon(category) {
  if(category === 'Notes') {
    els.detailIcon.innerHTML = '<i class="ph-fill ph-note"></i>';
    els.detailIcon.style.background = '#10b981';
  } else {
    els.detailIcon.innerHTML = '<i class="ph-fill ph-globe"></i>';
    els.detailIcon.style.background = 'var(--primary)';
  }
}

function showEmptyState() {
  els.emptyState.classList.remove('hidden');
  els.detailContent.classList.add('hidden');
  selectedItemId = null;
}

// ----------------------------------------------------
// UI Logic - Detail Pane
// ----------------------------------------------------

els.btnAdd.addEventListener('click', () => {
  const newItem = {
    id: Date.now().toString(),
    title: 'New Item',
    category: currentFilter === 'Notes' ? 'Notes' : 'Logins',
    username: '',
    password: '',
    url: '',
    notes: '',
    created: Date.now()
  };
  vault.push(newItem);
  saveVault();
  selectItem(newItem.id);
});

els.btnSave.addEventListener('click', async () => {
  if(!selectedItemId) return;
  const idx = vault.findIndex(i => i.id === selectedItemId);
  if(idx > -1) {
    vault[idx] = {
      ...vault[idx],
      title: els.editTitle.value,
      category: els.editCategory.value,
      username: els.editUsername.value,
      password: els.editPassword.value,
      url: els.editUrl.value,
      notes: els.editNotes.value,
      updated: Date.now()
    };
    await saveVault();
    renderList();
    showToast("Item saved");
  }
});

els.btnDelete.addEventListener('click', async () => {
  if(!selectedItemId) return;
  if(confirm("Are you sure you want to delete this item?")) {
    vault = vault.filter(i => i.id !== selectedItemId);
    await saveVault();
    showEmptyState();
    renderList();
  }
});

els.editCategory.addEventListener('change', (e) => {
  updateDetailIcon(e.target.value);
});

els.btnTogglePwd.addEventListener('click', () => {
  if(els.editPassword.type === 'password') {
    els.editPassword.type = 'text';
    els.btnTogglePwd.innerHTML = '<i class="ph ph-eye-slash"></i>';
  } else {
    els.editPassword.type = 'password';
    els.btnTogglePwd.innerHTML = '<i class="ph ph-eye"></i>';
  }
});

// Password Generator
els.btnGeneratePwd.addEventListener('click', () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~";
  let pwd = "";
  const randomValues = new Uint32Array(16);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < randomValues.length; i++) {
    pwd += chars[randomValues[i] % chars.length];
  }
  els.editPassword.value = pwd;
  
  // Optional: automatically reveal so user can see it
  if(els.editPassword.type === 'password') {
    els.btnTogglePwd.click();
  }
  calculateStrength(pwd);
  showToast("Password Generated");
});

// Password Strength
els.editPassword.addEventListener('input', (e) => {
  calculateStrength(e.target.value);
});

function calculateStrength(pwd) {
  const bar = els.strengthBar;
  bar.className = 'strength-bar'; // reset to default
  if (!pwd) return;
  
  let score = 0;
  if(pwd.length >= 8) score++;
  if(pwd.length >= 12) score++;
  if(/[A-Z]/.test(pwd)) score++;
  if(/[0-9]/.test(pwd)) score++;
  if(/[^A-Za-z0-9]/.test(pwd)) score++;
  
  if(score <= 2) {
    bar.classList.add('weak');
  } else if(score <= 4) {
    bar.classList.add('medium');
  } else {
    bar.classList.add('strong');
  }
}

// Copy to clipboard
els.copyBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // We prevent focus shifting completely just in case
    e.preventDefault();
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if(input && input.value) {
      navigator.clipboard.writeText(input.value).then(() => {
        showToast("Copied to clipboard");
      });
    }
  });
});

// ----------------------------------------------------
// Import / Export
// ----------------------------------------------------
els.btnExport.addEventListener('click', () => {
  if(!appKey || vault.length === 0) {
    alert("Vault is empty or locked.");
    return;
  }
  const dataStr = JSON.stringify(vault, null, 2);
  const blob = new Blob([dataStr], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `private_pass_export_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.inputImport.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if(!Array.isArray(imported)) throw new Error("Invalid format");
      if(confirm(`Import ${imported.length} items? This will merge them with your current vault.`)) {
        
        imported.forEach(imp => {
          // ensure backwards compatibility or merge uniqueness
          imp.id = imp.id || Date.now().toString() + Math.random().toString();
          vault.push(imp);
        });

        await saveVault();
        renderList();
        showToast("Import successful");
      }
    } catch(err) {
      alert("Failed to import. Invalid JSON file.");
    }
    e.target.value = ''; // reset
  };
  reader.readAsText(file);
});

// Utils
let toastTimeout;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2000);
}

function escapeHTML(str) {
  if(!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}

// Start
init();
