export function getPetImageUrl(filename) {
  if (!filename) return '/api/images/default.jpg';
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  return `/api/images/${filename}`;
}

export function getPetImageFallbackSrc() {
  return '/api/images/default.jpg';
}

export function handlePetImageError(e) {
  const fallback = getPetImageFallbackSrc();
  if (!e.target.src.includes('default.jpg')) {
    e.target.onerror = null;
    e.target.src = fallback;
  }
}
