// ============================================================
// SIMBINWAS GLOBAL APPLICATION SCRIPT (app.js)
// ============================================================

function injectLogoutModal() {
  if (document.getElementById('modal-logout-confirm')) return;

  const modalHtml = `
    <div id="modal-logout-confirm" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center p-4 z-[9999] transition-opacity duration-200">
      <div class="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 text-center space-y-4">
        <div class="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold shadow-sm">
          <i class="fa-solid fa-right-from-bracket"></i>
        </div>
        <div>
          <h3 class="text-base font-extrabold text-slate-900">Konfirmasi Keluar</h3>
          <p class="text-xs text-slate-500 mt-1">Apakah Anda yakin ingin keluar dari sistem SIMBINWAS?</p>
        </div>
        <div class="flex items-center gap-3 pt-2">
          <button type="button" onclick="closeLogoutModal()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition">
            Batal
          </button>
          <button type="button" onclick="confirmLogoutProcess()" class="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-200 transition">
            Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleLogout() {
  injectLogoutModal();
  const modal = document.getElementById('modal-logout-confirm');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeLogoutModal() {
  const modal = document.getElementById('modal-logout-confirm');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function confirmLogoutProcess() {
  localStorage.clear();
  window.location.href = '/login.html';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectLogoutModal);
} else {
  injectLogoutModal();
}