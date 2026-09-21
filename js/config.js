// Configuración de la tienda. Cambiar aquí y listo.
const SITE_CONFIG = {
  nombreMarca: "Root's",
  whatsapp: '50431910999',        // +504 3191-0999
  moneda: 'L',
  // Menú vivo (Vercel Blob). Se completa al conectar el Blob (Tarea 9).
  // Si está vacío o falla, se usa data/products.js como respaldo.
  menuUrl: 'https://r1hjuawv9xclv7pc.public.blob.vercel-storage.com/menu.json',
  categorias: [
    { key: 'todos', label: 'Todos' },
    { key: 'condimentos', label: 'Condimentos y especias' },
    { key: 'salsas', label: 'Salsas y vinagres' },
    { key: 'sacos', label: 'Sacos' },
    { key: 'conservas', label: 'Conservas' },
  ],
  contacto: {
    telefono: '+504 3191-0999',
    correo: 'sac@rootshn.com',
    instagram: 'https://www.instagram.com/fooodroots',
    facebook: 'https://www.facebook.com/profile.php?id=61556355161124',
    tiktok: 'https://www.tiktok.com/@foodsroots',
    web: 'https://foodsroots.com',
  },
};
