const contenedorRedes = document.querySelector('#lista-redes');
const contenedorDetalle = document.querySelector('#detalle');
const botonVolver = document.querySelector('#boton-volver');
const tituloPagina = document.querySelector('#titulo-pagina');

async function cargarRedes() {
  const respuesta = await fetch('/api/redes');
  const redes = await respuesta.json();

  redes.forEach((red) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta';
    tarjeta.textContent = red.nombre;
    tarjeta.dataset.redId = red.id;
    tarjeta.dataset.redNombre = red.nombre;

    tarjeta.addEventListener('click', () => {
      verGruposDeRed(tarjeta.dataset.redId, tarjeta.dataset.redNombre);
    });

    contenedorRedes.appendChild(tarjeta);
  });
}

async function verGruposDeRed(redId, nombreRed) {
  const respuesta = await fetch('/api/redes/' + redId + '/grupos');
  const grupos = await respuesta.json();

  tituloPagina.textContent = 'Grupos de ' + nombreRed;
  contenedorDetalle.innerHTML = '';

  if (grupos.length === 0) {
    contenedorDetalle.innerHTML = '<p class="vacio">Esta red aún no tiene grupos.</p>';
  }

  grupos.forEach((grupo) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-grupo';
    tarjeta.innerHTML =
      '<strong>' + grupo.nombre + '</strong>' +
      '<span>' + grupo.dia_habitual + ' · ' + grupo.hora_habitual + '</span>' +
      '<span class="direccion">' + (grupo.ciudad || '') + '</span>';
    contenedorDetalle.appendChild(tarjeta);
  });

  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.remove('oculto');
  botonVolver.classList.remove('oculto');
}

function mostrarRedes() {
  tituloPagina.textContent = 'Nuestras Redes';
  contenedorRedes.classList.remove('oculto');
  contenedorDetalle.classList.add('oculto');
  botonVolver.classList.add('oculto');
}

botonVolver.addEventListener('click', mostrarRedes);

cargarRedes();