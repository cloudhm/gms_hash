export function openAdmin(path) {
  const url = typeof path === 'string' && path.startsWith('/') ? path : '/admin';
  window.open(url, '_blank', 'noopener,noreferrer');
}