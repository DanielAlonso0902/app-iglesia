const contenedorRedes = document.querySelector('#lista-redes');
const contenedorDetalle = document.querySelector('#detalle');
const botonVolver = document.querySelector('#boton-volver');
const tituloPagina = document.querySelector('#titulo-pagina');

let pantalla = 'redes';
let redActual = null;
let grupoActual = null;

async function cargarRedes() {
  const respuesta = await fetch('/api/redes');
  const redes = await respuesta.json();

  redes.forEach((red) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta';
    tarjeta.textContent = red.nombre;

    tarjeta.addEventListener('click', () => {
      redActual = { id: red.id, nombre: red.nombre };
      verGruposDeRed();
    });

    contenedorRedes.appendChild(tarjeta);
  });
}

async function verGruposDeRed() {
  const respuesta = await fetch('/api/redes/' + redActual.id + '/grupos');
  const grupos = await respuesta.json();

  tituloPagina.textContent = 'Grupos de ' + redActual.nombre;
  contenedorDetalle.innerHTML = '';
  pantalla = 'grupos';

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

    tarjeta.addEventListener('click', () => {
      grupoActual = { id: grupo.id, nombre: grupo.nombre };
      verIntegrantesDeGrupo();
    });

    contenedorDetalle.appendChild(tarjeta);
  });

  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.remove('oculto');
  botonVolver.classList.remove('oculto');
}

async function verIntegrantesDeGrupo() {
  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/integrantes');
  const integrantes = await respuesta.json();

  tituloPagina.textContent = grupoActual.nombre;
  contenedorDetalle.innerHTML = '';
  pantalla = 'integrantes';

  if (integrantes.length === 0) {
    contenedorDetalle.innerHTML = '<p class="vacio">Este grupo aún no tiene integrantes.</p>';
  }

  integrantes.forEach((persona) => {
    const fila = document.createElement('article');
    fila.className = 'integrante';
    fila.innerHTML =
      '<div class="avatar">' + persona.nombre_completo.charAt(0) + '</div>' +
      '<div class="info"><strong>' + persona.nombre_completo + '</strong></div>' +
      '<span class="rol rol-' + clasePorRol(persona.rol) + '">' + persona.rol + '</span>';
    contenedorDetalle.appendChild(fila);
  });

  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.remove('oculto');
  botonVolver.classList.remove('oculto');
}

function clasePorRol(rol) {
  if (rol === 'Líder') return 'lider';
  if (rol === 'Apoyo') return 'apoyo';
  if (rol === 'Anfitrión') return 'anfitrion';
  return 'integrante';
}

function volver() {
  if (pantalla === 'integrantes') {
    verGruposDeRed();
  } else if (pantalla === 'grupos') {
    mostrarRedes();
  }
}

function mostrarRedes() {
  pantalla = 'redes';
  tituloPagina.textContent = 'Nuestras Redes';
  contenedorRedes.classList.remove('oculto');
  contenedorDetalle.classList.add('oculto');
  botonVolver.classList.add('oculto');
}

botonVolver.addEventListener('click', volver);

cargarRedes();