async function cargarRedes() {
  const respuesta = await fetch('/api/redes');
  const redes = await respuesta.json();

  const contenedor = document.querySelector('#lista-redes');

  redes.forEach((red) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta';
    tarjeta.textContent = red.nombre;
    contenedor.appendChild(tarjeta);
  });
}

cargarRedes();