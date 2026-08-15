export function showUnlockToast(msg: string) {
  const toast = document.getElementById('unlockToast');
  const text = document.getElementById('utText');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3400);
}
