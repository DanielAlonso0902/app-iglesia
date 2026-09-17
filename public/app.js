const contenedorRedes = document.querySelector('#lista-redes');
const contenedorDetalle = document.querySelector('#detalle');
const botonVolver = document.querySelector('#boton-volver');
const botonAgregar = document.querySelector('#boton-agregar');
const tituloPagina = document.querySelector('#titulo-pagina');

const formularioSection = document.querySelector('#formulario-section');
const formulario = document.querySelector('#formulario-integrante');
const botonCancelar = document.querySelector('#cancelar-formulario');
const mensajeError = document.querySelector('#mensaje-error');

const loginSection = document.querySelector('#login-section');
const areaApp = document.querySelector('#area-app');
const formularioLogin = document.querySelector('#formulario-login');
const mensajeErrorLogin = document.querySelector('#mensaje-error-login');
const usuarioBarra = document.querySelector('#usuario-barra');
const textoUsuario = document.querySelector('#texto-usuario');
const botonCerrarSesion = document.querySelector('#boton-cerrar-sesion');

let pantalla = 'redes';
let redActual = null;
let grupoActual = null;
let usuarioActual = null;

async function iniciar() {
  const respuesta = await fetch('/api/me');

  if (respuesta.ok) {
    const usuario = await respuesta.json();
    mostrarApp(usuario);
  } else {
    mostrarLogin();
  }
}

function mostrarLogin() {
  loginSection.classList.remove('oculto');
  areaApp.classList.add('oculto');
  usuarioBarra.classList.add('oculto');
}

function mostrarApp(usuario) {
  usuarioActual = usuario;
  loginSection.classList.add('oculto');
  areaApp.classList.remove('oculto');
  usuarioBarra.classList.remove('oculto');
  textoUsuario.textContent = 'Cédula ' + usuario.cedula + ' · ' + usuario.rol;
  cargarRedes();
}

async function cargarRedes() {
  contenedorRedes.innerHTML = '';
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
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');

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
  const resultado = await respuesta.json();

  tituloPagina.textContent = grupoActual.nombre;
  contenedorDetalle.innerHTML = '';

  if (!respuesta.ok) {
    pantalla = 'integrantes';
    contenedorDetalle.innerHTML = '<p class="vacio">' + (resultado.error || 'No tienes permiso.') + '</p>';
    contenedorRedes.classList.add('oculto');
    contenedorDetalle.classList.remove('oculto');
    botonVolver.classList.remove('oculto');
    botonAgregar.classList.add('oculto');
    return;
  }

  const integrantes = resultado;
  pantalla = 'integrantes';

  const puedeAgregar = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Líder de Grupo');
  if (puedeAgregar) {
    botonAgregar.classList.remove('oculto');
  } else {
    botonAgregar.classList.add('oculto');
  }

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

async function crearIntegrante(evento) {
  evento.preventDefault();
  mensajeError.classList.add('oculto');

  const datos = {
    nombre: formulario.nombre.value,
    celular: formulario.celular.value,
    rol: formulario.rol.value
  };

  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/integrantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeError.textContent = resultado.error;
    mensajeError.classList.remove('oculto');
    return;
  }

  formulario.reset();
  cerrarFormulario();
  verIntegrantesDeGrupo();
}

function abrirFormulario() {
  botonAgregar.classList.add('oculto');
  formularioSection.classList.remove('oculto');
  formulario.nombre.focus();
}

function cerrarFormulario() {
  formularioSection.classList.add('oculto');
  botonAgregar.classList.remove('oculto');
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
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');
}

formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mensajeErrorLogin.classList.add('oculto');

  const datos = {
    cedula: formularioLogin.cedula.value,
    contrasena: formularioLogin.contrasena.value
  };

  const respuesta = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorLogin.textContent = resultado.error;
    mensajeErrorLogin.classList.remove('oculto');
    return;
  }

  formularioLogin.reset();
  mostrarApp(resultado);
});

botonCerrarSesion.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  mostrarLogin();
});

botonVolver.addEventListener('click', volver);
botonAgregar.addEventListener('click', abrirFormulario);
botonCancelar.addEventListener('click', cerrarFormulario);
formulario.addEventListener('submit', crearIntegrante);

iniciar();