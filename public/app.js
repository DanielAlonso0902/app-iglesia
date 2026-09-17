const contenedorRedes = document.querySelector('#lista-redes');
const contenedorDetalle = document.querySelector('#detalle');
const botonVolver = document.querySelector('#boton-volver');
const botonAgregar = document.querySelector('#boton-agregar');
const tituloPagina = document.querySelector('#titulo-pagina');

const formularioSection = document.querySelector('#formulario-section');
const formulario = document.querySelector('#formulario-integrante');
const botonCancelar = document.querySelector('#cancelar-formulario');
const mensajeError = document.querySelector('#mensaje-error');

const botonAgregarReunion = document.querySelector('#boton-agregar-reunion');
const formularioReunionSection = document.querySelector('#formulario-reunion-section');
const formularioReunion = document.querySelector('#formulario-reunion');
const botonCancelarReunion = document.querySelector('#cancelar-reunion');
const mensajeErrorReunion = document.querySelector('#mensaje-error-reunion');
const tituloReuniones = document.querySelector('#titulo-reuniones');
const listaReuniones = document.querySelector('#lista-reuniones');

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
let reunionActual = null;
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
  ocultarReuniones();

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
    ocultarReuniones();
    return;
  }

  const integrantes = resultado;
  pantalla = 'integrantes';

  const puedeGestionar = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Líder de Grupo');
  if (puedeGestionar) {
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

  const respuestaReuniones = await fetch('/api/grupos/' + grupoActual.id + '/reuniones');
  const reuniones = respuestaReuniones.ok ? await respuestaReuniones.json() : [];
  renderizarReuniones(reuniones, puedeGestionar);

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

function renderizarReuniones(reuniones, puedeGestionar) {
  listaReuniones.innerHTML = '';

  if (puedeGestionar) {
    botonAgregarReunion.classList.remove('oculto');
  } else {
    botonAgregarReunion.classList.add('oculto');
  }

  if (reuniones.length === 0) {
    tituloReuniones.classList.add('oculto');
    return;
  }

  tituloReuniones.classList.remove('oculto');

  reuniones.forEach((reunion) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-grupo tarjeta-reunion';
    tarjeta.innerHTML =
      '<strong>' + reunion.fecha + '</strong>' +
      '<span>' + reunion.tipo + '</span>' +
      '<span>' + (reunion.realizada ? 'Realizada' : 'Cancelada') + ' · ' + (reunion.duracion || 'sin duración') + '</span>' +
      (reunion.observacion ? '<span class="direccion">' + reunion.observacion + '</span>' : '');

    if (puedeGestionar) {
      const botonAsistencia = document.createElement('button');
      botonAsistencia.className = 'btn btn-secundario';
      botonAsistencia.textContent = 'Asistencia';
      botonAsistencia.addEventListener('click', () => {
        reunionActual = { id: reunion.id };
        verDetalleReunion();
      });
      tarjeta.appendChild(botonAsistencia);
    }

    listaReuniones.appendChild(tarjeta);
  });
}

function ocultarReuniones() {
  botonAgregarReunion.classList.add('oculto');
  formularioReunionSection.classList.add('oculto');
  tituloReuniones.classList.add('oculto');
  listaReuniones.innerHTML = '';
}

async function crearReunion(evento) {
  evento.preventDefault();
  mensajeErrorReunion.classList.add('oculto');

  const datos = {
    fecha: formularioReunion.fecha.value,
    duracion: formularioReunion.duracion.value,
    observacion: formularioReunion.observacion.value
  };

  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/reuniones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorReunion.textContent = resultado.error;
    mensajeErrorReunion.classList.remove('oculto');
    return;
  }

  formularioReunion.reset();
  cerrarFormularioReunion();
  verIntegrantesDeGrupo();
}

function abrirFormularioReunion() {
  botonAgregarReunion.classList.add('oculto');
  formularioReunionSection.classList.remove('oculto');
  formularioReunion.fecha.focus();
}

function cerrarFormularioReunion() {
  formularioReunionSection.classList.add('oculto');
  botonAgregarReunion.classList.remove('oculto');
}

async function verDetalleReunion() {
  const respuesta = await fetch('/api/reuniones/' + reunionActual.id);
  const detalle = await respuesta.json();

  if (!respuesta.ok) {
    tituloPagina.textContent = 'Reunión';
    contenedorDetalle.innerHTML = '<p class="vacio">' + (detalle.error || 'No tienes permiso.') + '</p>';
    return;
  }

  pantalla = 'reunion';
  tituloPagina.textContent = 'Reunión del ' + detalle.reunion.fecha + ' · ' + detalle.reunion.tipo;
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');
  ocultarReuniones();

  const puedeGestionar = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Líder de Grupo');

  let html = '<h3>Asistencia</h3><div id="asistencia-lista">';

  if (detalle.integrantes.length === 0) {
    html += '<p class="vacio">Este grupo aún no tiene integrantes.</p>';
  }

  detalle.integrantes.forEach((integrante) => {
    const asistio = integrante.asistio === null || integrante.asistio === 1;
    html +=
      '<label class="integrante-chequeo">' +
      '<input type="checkbox" data-persona-id="' + integrante.id + '"' + (asistio ? ' checked' : '') + '>' +
      '<span class="info"><strong>' + integrante.nombre_completo + '</strong></span>' +
      '<span class="rol rol-' + clasePorRol(integrante.rol) + '">' + integrante.rol + '</span>' +
      '</label>';
  });

  html += '</div>';

  if (puedeGestionar) {
    html += '<button id="guardar-asistencia" class="btn btn-primario boton-ancho">Guardar asistencia</button>';
  }

  html += '<p id="mensaje-asistencia" class="alerta exito oculto"></p>';

  html += '<h3>Visitantes</h3><section id="visitantes-lista">';

  if (detalle.visitantes.length === 0) {
    html += '<p class="vacio">No se registraron visitantes.</p>';
  }

  detalle.visitantes.forEach((visitante) => {
    html +=
      '<article class="tarjeta tarjeta-reunion">' +
      '<strong>' + visitante.nombre + '</strong>' +
      '<span>Teléfono: ' + (visitante.telefono || 'no registrado') + '</span>' +
      (visitante.observacion ? '<span class="direccion">' + visitante.observacion + '</span>' : '') +
      '</article>';
  });

  html += '</section>';

  if (puedeGestionar) {
    html +=
      '<form id="formulario-visitante">' +
      '<h4>Registrar visitante</h4>' +
      '<label for="nombre-visitante">Nombre</label>' +
      '<input type="text" id="nombre-visitante" name="nombre" required>' +
      '<label for="telefono-visitante">Teléfono</label>' +
      '<input type="text" id="telefono-visitante" name="telefono">' +
      '<label for="observacion-visitante">Observación</label>' +
      '<textarea id="observacion-visitante" name="observacion" rows="2"></textarea>' +
      '<p id="mensaje-error-visitante" class="alerta oculto"></p>' +
      '<div class="botones"><button type="submit" class="btn btn-primario">Guardar visitante</button></div>' +
      '</form>';
  }

  contenedorDetalle.innerHTML = html;
  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.remove('oculto');
  botonVolver.classList.remove('oculto');

  if (puedeGestionar) {
    document.querySelector('#guardar-asistencia').addEventListener('click', guardarAsistencia);
    document.querySelector('#formulario-visitante').addEventListener('submit', agregarVisitante);
  }
}

async function guardarAsistencia() {
  const chequeos = document.querySelectorAll('#asistencia-lista input[type="checkbox"]');
  const mensaje = document.querySelector('#mensaje-asistencia');
  mensaje.classList.add('oculto');

  await Promise.all(Array.from(chequeos).map(async (chequeo) => {
    await fetch('/api/reuniones/' + reunionActual.id + '/asistencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personaId: Number(chequeo.dataset.personaId),
        asistio: chequeo.checked
      })
    });
  }));

  mensaje.textContent = 'Asistencia guardada.';
  mensaje.classList.remove('oculto');
}

async function agregarVisitante(evento) {
  evento.preventDefault();

  const formularioVisitante = evento.target;
  const mensajeErrorVisitante = document.querySelector('#mensaje-error-visitante');
  mensajeErrorVisitante.classList.add('oculto');

  const datos = {
    nombre: formularioVisitante.nombre.value,
    telefono: formularioVisitante.telefono.value,
    observacion: formularioVisitante.observacion.value
  };

  const respuesta = await fetch('/api/reuniones/' + reunionActual.id + '/visitantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorVisitante.textContent = resultado.error;
    mensajeErrorVisitante.classList.remove('oculto');
    return;
  }

  verDetalleReunion();
}

function clasePorRol(rol) {
  if (rol === 'Líder') return 'lider';
  if (rol === 'Apoyo') return 'apoyo';
  if (rol === 'Anfitrión') return 'anfitrion';
  return 'integrante';
}

function volver() {
  if (pantalla === 'reunion') {
    verIntegrantesDeGrupo();
  } else if (pantalla === 'integrantes') {
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
  ocultarReuniones();
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

botonAgregarReunion.addEventListener('click', abrirFormularioReunion);
botonCancelarReunion.addEventListener('click', cerrarFormularioReunion);
formularioReunion.addEventListener('submit', crearReunion);

iniciar();