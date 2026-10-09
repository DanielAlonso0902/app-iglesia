const contenedorRedes = document.querySelector('#lista-redes');
const contenedorDetalle = document.querySelector('#detalle');
const botonVolver = document.querySelector('#boton-volver');
const botonAgregar = document.querySelector('#boton-agregar');
const tituloPagina = document.querySelector('#titulo-pagina');

const formularioSection = document.querySelector('#formulario-section');
const formulario = document.querySelector('#formulario-integrante');
const botonCancelar = document.querySelector('#cancelar-formulario');
const mensajeError = document.querySelector('#mensaje-error');
const campoBuscarPersona = document.querySelector('#buscar-persona');
const botonBuscarPersona = document.querySelector('#boton-buscar-persona');
const resultadosBuscarPersona = document.querySelector('#resultados-persona');
const mensajeBuscarPersona = document.querySelector('#mensaje-buscar-persona');
const sugerenciaDuplicado = document.querySelector('#sugerencia-duplicado');

const botonAgregarReunion = document.querySelector('#boton-agregar-reunion');
const formularioReunionSection = document.querySelector('#formulario-reunion-section');
const formularioReunion = document.querySelector('#formulario-reunion');
const botonCancelarReunion = document.querySelector('#cancelar-reunion');
const mensajeErrorReunion = document.querySelector('#mensaje-error-reunion');
const tituloReuniones = document.querySelector('#acordeon-reuniones');
const listaReuniones = document.querySelector('#lista-reuniones');

const formularioEditarReunionSection = document.querySelector('#formulario-editar-reunion-section');
const formularioEditarReunion = document.querySelector('#formulario-editar-reunion');
const cancelarEditarReunion = document.querySelector('#cancelar-editar-reunion');
const mensajeErrorEditarReunion = document.querySelector('#mensaje-error-editar-reunion');

const barraNavegacion = document.querySelector('#barra-navegacion');
const botonRedes = document.querySelector('#boton-redes');
const botonBuscar = document.querySelector('#boton-buscar');
const botonReportes = document.querySelector('#boton-reportes');
const seccionBusqueda = document.querySelector('#seccion-busqueda');
const formularioBusqueda = document.querySelector('#formulario-busqueda');
const campoBusqueda = document.querySelector('#campo-busqueda');
const mensajeBusqueda = document.querySelector('#mensaje-busqueda');
const resultados = document.querySelector('#resultados');

const seccionReportes = document.querySelector('#seccion-reportes');
const mensajeErrorReportes = document.querySelector('#mensaje-error-reportes');
const reporteFormacion = document.querySelector('#reporte-formacion');
const listaMisRedes = document.querySelector('#lista-mis-redes');
const reporteRed = document.querySelector('#reporte-red');

const botonAdmin = document.querySelector('#boton-admin');
const seccionAdmin = document.querySelector('#seccion-admin');
const mensajeErrorAdmin = document.querySelector('#mensaje-error-admin');
const formularioNuevaRed = document.querySelector('#formulario-nueva-red');
const formularioNuevoGrupo = document.querySelector('#formulario-nuevo-grupo');
const selectGrupoRed = document.querySelector('#grupo-red');
const listaAdminRedes = document.querySelector('#lista-admin-redes');
const listaAdminGrupos = document.querySelector('#lista-admin-grupos');
const formularioEditarGrupo = document.querySelector('#formulario-editar-grupo');
const cancelarEditarGrupo = document.querySelector('#cancelar-editar-grupo');

const formularioUsuario = document.querySelector('#formulario-usuario');
const selectUsuarioPersona = document.querySelector('#usuario-persona');
const campoPersonaNueva = document.querySelector('#campo-persona-nueva');
const selectUsuarioRol = document.querySelector('#usuario-rol');
const campoRedUsuario = document.querySelector('#campo-red-usuario');
const selectUsuarioRed = document.querySelector('#usuario-red');
const campoGrupoUsuario = document.querySelector('#campo-grupo-usuario');
const selectUsuarioGrupo = document.querySelector('#usuario-grupo');
const listaUsuarios = document.querySelector('#lista-usuarios');

const seccionCambioLiderRed = document.querySelector('#seccion-cambio-lider-red');
const formularioCambioLiderRed = document.querySelector('#formulario-cambio-lider-red');
const selectCambioRed = document.querySelector('#cambio-red');
const selectCambioLiderPersona = document.querySelector('#cambio-lider-persona');

const botonCambiarContrasena = document.querySelector('#boton-cambiar-contrasena');
const seccionCambiarContrasena = document.querySelector('#seccion-cambiar-contrasena');
const formularioCambiarContrasena = document.querySelector('#formulario-cambiar-contrasena');
const mensajeErrorContrasena = document.querySelector('#mensaje-error-contrasena');
const botonCancelarContrasena = document.querySelector('#cancelar-cambiar-contrasena');

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
let personaExpedienteId = null;
let usuarioActual = null;

const etapasFormacion = ['Discípulo S1', 'Discípulo S2', 'Discípulo S3', 'Discípulo S4', 'Bendición N1', 'Bendición N2', 'Bendición N3', 'Ministerio de la Misericordia'];

function clasePorEtapa(etapa) {
  if (etapa.indexOf('Discípulo') === 0) return 'discipulo';
  if (etapa.indexOf('Bendición') === 0) return 'bendicion';
  return 'misericordia';
}

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
  barraNavegacion.classList.add('oculto');
}

function cerrarSesionFrontend() {
  usuarioActual = null;
  pantalla = null;
  mostrarLogin();
}

function mostrarApp(usuario) {
  usuarioActual = usuario;
  loginSection.classList.add('oculto');
  areaApp.classList.remove('oculto');
  usuarioBarra.classList.remove('oculto');
  barraNavegacion.classList.remove('oculto');
  textoUsuario.textContent = 'Cédula ' + usuario.cedula + ' · ' + usuario.rol;

  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor' || usuario.rol === 'Líder de Red') {
    botonReportes.classList.remove('oculto');
  } else {
    botonReportes.classList.add('oculto');
  }

  if (usuario.rol === 'Administrador' || usuario.rol === 'Pastor') {
    botonAdmin.classList.remove('oculto');
  } else {
    botonAdmin.classList.add('oculto');
  }

  cargarRedes();
}

async function cargarRedes() {
  contenedorRedes.innerHTML = '';
  const respuesta = await fetch('/api/redes');
  const redes = await respuesta.json();

  selectCambioRed.innerHTML = redes.map((red) => '<option value="' + red.id + '">' + red.nombre + '</option>').join('');

  if (usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Pastor')) {
    const respuestaPersonas = await fetch('/api/personas');
    const personas = await respuestaPersonas.json();
    selectCambioLiderPersona.innerHTML = personas
      .map((persona) => '<option value="' + persona.id + '">' + persona.nombre_completo + '</option>')
      .join('');
    seccionCambioLiderRed.classList.remove('oculto');
  } else {
    seccionCambioLiderRed.classList.add('oculto');
  }

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
  seccionCambioLiderRed.classList.add('oculto');
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

  const puedeGestionar = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Pastor' || usuarioActual.rol === 'Líder de Red' || usuarioActual.rol === 'Líder de Grupo');
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

    fila.addEventListener('click', () => {
      pedirExpediente(persona.id, persona.nombre_completo);
    });

    if (puedeGestionar) {
      const botonRetirar = document.createElement('button');
      botonRetirar.className = 'btn btn-borde-rojo btn-mini';
      botonRetirar.textContent = 'Retirar';
      botonRetirar.addEventListener('click', (evento) => {
        evento.stopPropagation();
        retirarIntegrante(persona.id, persona.nombre_completo);
      });
      fila.appendChild(botonRetirar);
    }

    contenedorDetalle.appendChild(fila);
  });

  const puedeTransferirGrupo = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Pastor' || usuarioActual.rol === 'Líder de Red');
  if (puedeTransferirGrupo && integrantes.length > 0) {
    const bloque = document.createElement('article');
    bloque.className = 'tarjeta';
    bloque.innerHTML =
      '<h4>Transferir liderazgo del grupo</h4>' +
      '<select id="select-nuevo-lider">' +
        integrantes.map((presona) => '<option value="' + presona.id + '">' + presona.nombre_completo + '</option>').join('') +
      '</select>' +
      '<button class="btn btn-secundario">Transferir</button>';

    bloque.querySelector('button').addEventListener('click', () => {
      const nuevoLider = bloque.querySelector('select').value;
      transferirLiderGrupo(nuevoLider);
    });

    contenedorDetalle.appendChild(bloque);
  }

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
  sugerenciaDuplicado.classList.add('oculto');
  sugerenciaDuplicado.innerHTML = '';

  const datos = {
    nombre: formulario.nombre.value,
    cedula: formulario.cedula.value,
    celular: formulario.celular.value,
    direccion: formulario.direccion.value,
    rol: formulario.rol.value
  };

  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/integrantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (respuesta.status === 409 && resultado.persona) {
    const persona = resultado.persona;
    formulario.cedula.value = persona.cedula || '';
    sugerenciaDuplicado.innerHTML =
      'Ya existe: <strong>' + persona.nombre_completo + '</strong>' +
      (persona.cedula ? ' \\u00b7 Cédula ' + persona.cedula : '') +
      '<br><button type="button" class="btn btn-primario">Es esta persona, agregarla al grupo</button>';
    sugerenciaDuplicado.querySelector('button').addEventListener('click', () => {
      agregarPersonaExistente(persona.id);
    });
    sugerenciaDuplicado.classList.remove('oculto');
    return;
  }

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
  ocultarBusquedaExistente();
  formulario.nombre.focus();
}

function cerrarFormulario() {
  formularioSection.classList.add('oculto');
  botonAgregar.classList.remove('oculto');
  ocultarBusquedaExistente();
}

async function buscarPersonaParaGrupo() {
  const q = campoBuscarPersona.value.trim();

  if (!q) {
    mensajeBuscarPersona.textContent = 'Escribe una cédula o un nombre para buscar.';
    mensajeBuscarPersona.classList.remove('oculto');
    resultadosBuscarPersona.classList.add('oculto');
    resultadosBuscarPersona.innerHTML = '';
    return;
  }

  mensajeBuscarPersona.classList.add('oculto');
  resultadosBuscarPersona.innerHTML = '';

  const respuesta = await fetch('/api/personas?q=' + encodeURIComponent(q));
  const personas = await respuesta.json();

  if (!respuesta.ok) {
    mensajeBuscarPersona.textContent = personas.error || 'No se pudo buscar.';
    mensajeBuscarPersona.classList.remove('oculto');
    return;
  }

  if (personas.length === 0) {
    mensajeBuscarPersona.textContent = 'No se encontró a nadie con "' + q + '". Puedes registrarla abajo.';
    mensajeBuscarPersona.classList.remove('oculto');
    return;
  }

  personas.forEach((persona) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta-persona';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML =
      '<strong>' + persona.nombre_completo + (persona.persona_activo ? '' : ' (inactivo)') + '</strong>' +
      '<span>' + (persona.cedula ? 'Cédula ' + persona.cedula + ' · ' : '') + (persona.celular || 'sin celular') + '</span>';

    const botonAgregarExistente = document.createElement('button');
    botonAgregarExistente.className = 'btn btn-secundario';
    botonAgregarExistente.textContent = 'Agregar';
    botonAgregarExistente.addEventListener('click', () => {
      agregarPersonaExistente(persona.id);
    });

    tarjeta.appendChild(info);
    tarjeta.appendChild(botonAgregarExistente);
    resultadosBuscarPersona.appendChild(tarjeta);
  });

  resultadosBuscarPersona.classList.remove('oculto');
}

async function agregarPersonaExistente(personaId) {
  const rol = formulario.rol.value;

  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/integrantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, rol })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeBuscarPersona.textContent = resultado.error || 'No se pudo agregar.';
    mensajeBuscarPersona.classList.remove('oculto');
    return;
  }

  formulario.reset();
  cerrarFormulario();
  verIntegrantesDeGrupo();
}

function ocultarBusquedaExistente() {
  campoBuscarPersona.value = '';
  resultadosBuscarPersona.innerHTML = '';
  resultadosBuscarPersona.classList.add('oculto');
  mensajeBuscarPersona.classList.add('oculto');
  sugerenciaDuplicado.classList.add('oculto');
  sugerenciaDuplicado.innerHTML = '';
}

async function retirarIntegrante(personaId, nombre) {
  if (!window.confirm('¿Retirar a ' + nombre + ' del grupo?')) {
    return;
  }

  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/integrantes/' + personaId + '/retirar', { method: 'POST' });
  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    window.alert(resultado.error || 'No se pudo retirar.');
    return;
  }

  verIntegrantesDeGrupo();
}

async function transferirLiderGrupo(personaId) {
  const respuesta = await fetch('/api/grupos/' + grupoActual.id + '/transferir-lider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId })
  });
  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    window.alert(resultado.error || 'No se pudo transferir.');
    return;
  }

  verIntegrantesDeGrupo();
}

async function transferirLiderRed(evento) {
  evento.preventDefault();

  const respuesta = await fetch('/api/redes/' + selectCambioRed.value + '/transferir-lider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: selectCambioLiderPersona.value })
  });
  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    window.alert(resultado.error || 'No se pudo transferir.');
    return;
  }

  cargarRedes();
}

function ocultarCambiarContrasena() {
  seccionCambiarContrasena.classList.add('oculto');
  formularioCambiarContrasena.reset();
}

function mostrarOcultarCambiarContrasena() {
  mensajeErrorContrasena.classList.add('oculto');
  seccionCambiarContrasena.classList.toggle('oculto');

  if (!seccionCambiarContrasena.classList.contains('oculto')) {
    formularioCambiarContrasena.contrasena_actual.focus();
  }
}

async function cambiarContrasena(evento) {
  evento.preventDefault();
  mensajeErrorContrasena.classList.add('oculto');

  if (formularioCambiarContrasena.contrasena_nueva.value !== formularioCambiarContrasena.confirmar.value) {
    mensajeErrorContrasena.textContent = 'La contraseña nueva no coincide con la confirmación.';
    mensajeErrorContrasena.classList.remove('oculto');
    return;
  }

  const respuesta = await fetch('/api/mi-contrasena', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contrasena_actual: formularioCambiarContrasena.contrasena_actual.value,
      contrasena_nueva: formularioCambiarContrasena.contrasena_nueva.value
    })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorContrasena.textContent = resultado.error;
    mensajeErrorContrasena.classList.remove('oculto');
    return;
  }

  window.alert('Contraseña actualizada.');
  ocultarCambiarContrasena();
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

      const botonEditar = document.createElement('button');
      botonEditar.className = 'btn btn-secundario';
      botonEditar.textContent = 'Editar';
      botonEditar.addEventListener('click', () => {
        abrirFormularioEditarReunion(reunion);
      });
      tarjeta.appendChild(botonEditar);

      if (reunion.realizada) {
        const botonAnular = document.createElement('button');
        botonAnular.className = 'btn btn-borde-rojo';
        botonAnular.textContent = 'Anular';
        botonAnular.addEventListener('click', () => {
          anularReunion(reunion.id);
        });
        tarjeta.appendChild(botonAnular);
      }
    }

    listaReuniones.appendChild(tarjeta);
  });
}

function ocultarReuniones() {
  botonAgregarReunion.classList.add('oculto');
  formularioReunionSection.classList.add('oculto');
  formularioEditarReunionSection.classList.add('oculto');
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
  formularioEditarReunionSection.classList.add('oculto');
  formularioReunionSection.classList.remove('oculto');
  formularioReunion.fecha.focus();
}

function cerrarFormularioReunion() {
  formularioReunionSection.classList.add('oculto');
  botonAgregarReunion.classList.remove('oculto');
}

let reunionEnEdicion = null;

function abrirFormularioEditarReunion(reunion) {
  reunionEnEdicion = reunion;
  formularioEditarReunion.fecha.value = reunion.fecha;
  formularioEditarReunion.tipo.value = reunion.tipo;
  formularioEditarReunion.duracion.value = reunion.duracion || '';
  formularioEditarReunion.observacion.value = reunion.observacion || '';
  mensajeErrorEditarReunion.classList.add('oculto');
  formularioEditarReunionSection.classList.remove('oculto');
  formularioEditarReunion.fecha.focus();
}

function cerrarFormularioEditarReunion() {
  formularioEditarReunionSection.classList.add('oculto');
  reunionEnEdicion = null;
  formularioEditarReunion.reset();
}

async function guardarEdicionReunion(evento) {
  evento.preventDefault();
  mensajeErrorEditarReunion.classList.add('oculto');

  const respuesta = await fetch('/api/reuniones/' + reunionEnEdicion.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fecha: formularioEditarReunion.fecha.value,
      tipo: formularioEditarReunion.tipo.value,
      duracion: formularioEditarReunion.duracion.value,
      observacion: formularioEditarReunion.observacion.value
    })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorEditarReunion.textContent = resultado.error;
    mensajeErrorEditarReunion.classList.remove('oculto');
    return;
  }

  cerrarFormularioEditarReunion();
  verIntegrantesDeGrupo();
}

async function anularReunion(id) {
  if (!window.confirm('¿Anular esta reunión?')) {
    return;
  }

  const motivo = window.prompt('Motivo de la anulación (opcional):');

  const respuesta = await fetch('/api/reuniones/' + id + '/anular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo })
  });

  if (!respuesta.ok) {
    window.alert('No se pudo anular la reunión.');
    return;
  }

  verIntegrantesDeGrupo();
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

  const puedeGestionar = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Pastor' || usuarioActual.rol === 'Líder de Red' || usuarioActual.rol === 'Líder de Grupo');

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

async function pedirExpediente(personaId, nombre) {
  const respuesta = await fetch('/api/personas/' + personaId);
  const datos = await respuesta.json();

  if (!respuesta.ok) {
    tituloPagina.textContent = nombre;
    contenedorDetalle.innerHTML = '<p class="vacio">' + (datos.error || 'No tienes permiso.') + '</p>';
    return;
  }

  renderizarExpediente(datos.persona, datos.formacion);
}

function renderizarExpediente(persona, formacion) {
  pantalla = 'expediente';
  personaExpedienteId = persona.id;
  tituloPagina.textContent = persona.nombre_completo;
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');
  ocultarReuniones();

  const puedeGestionar = usuarioActual && (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Pastor' || usuarioActual.rol === 'Líder de Red' || usuarioActual.rol === 'Líder de Grupo');

  const activa = formacion.find((fila) => fila.activo === 1);
  const historial = formacion.slice().reverse();

  let html = '<section class="tarjeta tarjeta-persona">';
  html += '<strong>' + persona.nombre_completo + '</strong>';
  html += '<span>Celular: ' + (persona.celular || 'no registrado') + '</span>';
  html += '<span>' + (persona.es_nuevo ? 'Nuevo en la iglesia' : 'Miembro') + ' · ' + (persona.bautizado ? 'Bautizado' : 'Sin bautismo') + '</span>';
  if (persona.fecha_llegada_grupo) {
    html += '<span>Llegó al grupo: ' + persona.fecha_llegada_grupo + '</span>';
  }
  html += '</section>';

  html += '<h3>Formación</h3>';

  if (activa) {
    html += '<p class="tarjeta tarjeta-persona">' +
      '<span class="rol rol-etapa rol-' + clasePorEtapa(activa.etapa) + '">' + activa.etapa + '</span> ' +
      '<span>Etapa actual</span></p>';
  }

  if (historial.length > 0) {
    historial.forEach((fila) => {
      html += '<article class="tarjeta tarjeta-persona">' +
        '<strong>' + fila.etapa + '</strong>' +
        '<span>Promedio: ' + (fila.promedio === null ? '—' : fila.promedio) +
        ' · Desde ' + (fila.fecha_inicio || '?') +
        (fila.fecha_fin ? ' hasta ' + fila.fecha_fin : '') +
        (fila.activo === 1 ? ' · ACTUAL' : '') +
        '</span></article>';
    });
  } else {
    html += '<p class="vacio">Esta persona aún no inicia su formación.</p>';
  }

  if (puedeGestionar) {
    html +=
      '<form id="formulario-avance">' +
      '<h4>Avanzar etapa</h4>' +
      '<label for="etapa-avance">Nueva etapa</label>' +
      '<select id="etapa-avance">' + etapasFormacion.map((etapa) => '<option' + (activa && etapa === activa.etapa ? ' selected' : '') + '>' + etapa + '</option>').join('') + '</select>' +
      '<label for="promedio-avance">Promedio (0 a 5)</label>' +
      '<input type="number" id="promedio-avance" min="0" max="5" step="0.1" placeholder="Opcional">' +
      '<p id="mensaje-error-avance" class="alerta oculto"></p>' +
      '<div class="botones"><button type="submit" class="btn btn-primario">Guardar avance</button></div>' +
      '</form>';
  }

  contenedorDetalle.innerHTML = html;
  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.remove('oculto');
  botonVolver.classList.remove('oculto');

  if (puedeGestionar) {
    document.querySelector('#formulario-avance').addEventListener('submit', avanzarEtapa);
  }
}

async function avanzarEtapa(evento) {
  evento.preventDefault();

  const mensaje = document.querySelector('#mensaje-error-avance');
  mensaje.classList.add('oculto');

  const datos = {
    etapa: document.querySelector('#etapa-avance').value,
    promedio: document.querySelector('#promedio-avance').value
  };

  const respuesta = await fetch('/api/personas/' + personaExpedienteId + '/formacion/avanzar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensaje.textContent = resultado.error;
    mensaje.classList.remove('oculto');
    return;
  }

  pedirExpediente(personaExpedienteId, tituloPagina.textContent);
}

function volver() {
  if (pantalla === 'expediente' || pantalla === 'reunion') {
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
  ocultarCambiarContrasena();
  seccionBusqueda.classList.add('oculto');
  resultados.innerHTML = '';
  seccionReportes.classList.add('oculto');
  seccionAdmin.classList.add('oculto');
  botonAdmin.classList.remove('activo');
  botonRedes.classList.add('activo');
  botonBuscar.classList.remove('activo');
  botonReportes.classList.remove('activo');
}

function mostrarBusqueda() {
  pantalla = 'busqueda';
  tituloPagina.textContent = 'Buscar personas';
  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.add('oculto');
  botonVolver.classList.add('oculto');
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');
  ocultarReuniones();
  ocultarCambiarContrasena();
  seccionBusqueda.classList.remove('oculto');
  mensajeBusqueda.classList.add('oculto');
  resultados.innerHTML = '';
  seccionReportes.classList.add('oculto');
  seccionAdmin.classList.add('oculto');
  botonAdmin.classList.remove('activo');
  botonBuscar.classList.add('activo');
  botonRedes.classList.remove('activo');
  botonReportes.classList.remove('activo');
  campoBusqueda.focus();
}

async function buscarPersonas(evento) {
  evento.preventDefault();
  mensajeBusqueda.classList.add('oculto');
  resultados.innerHTML = '';

  const q = campoBusqueda.value.trim();
  const respuesta = await fetch('/api/personas?q=' + encodeURIComponent(q));
  const personas = await respuesta.json();

  if (!respuesta.ok) {
    mensajeBusqueda.textContent = personas.error;
    mensajeBusqueda.classList.remove('oculto');
    return;
  }

  if (personas.length === 0) {
    mensajeBusqueda.textContent = 'No se encontraron personas con "' + q + '".';
    mensajeBusqueda.classList.remove('oculto');
    return;
  }

  renderizarResultados(personas);
}

function renderizarResultados(personas) {
  resultados.innerHTML = '';

  personas.forEach((persona) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-persona';

    let contenido = '<strong>' + persona.nombre_completo + (persona.persona_activo ? '' : ' (inactivo)') + '</strong>';
    if (persona.cedula) {
      contenido += '<span>Cédula: ' + persona.cedula + '</span>';
    }
    contenido += '<span>' + (persona.celular || 'sin celular') + '</span>';
    contenido += '<div>' + persona.grupos.map((grupo) => '<span class="rol rol-' + clasePorRol(grupo.rol) + '">' + grupo.nombre + ' · ' + grupo.rol + '</span>').join('') + '</div>';

    tarjeta.innerHTML = contenido;
    resultados.appendChild(tarjeta);
  });
}

function claseParaGrafico(etapa) {
  if (etapa === 'Sin formación') return 'gris';
  return clasePorEtapa(etapa);
}

function fichaDeTotales(numeros) {
  let html = '<section class="reporte-totales">';
  html += '<div class="total total-personas"><strong>' + numeros.personas + '</strong><span>personas</span></div>';
  if (numeros.nuevos !== undefined) {
    html += '<div class="total total-nuevos"><strong>' + numeros.nuevos + '</strong><span>nuevas</span></div>';
    html += '<div class="total total-bautizados"><strong>' + numeros.bautizados + '</strong><span>bautizadas</span></div>';
  }
  html += '</section>';
  return html;
}

function barrasDeEtapas(porEtapa, totalPersonas) {
  let html = '<section class="grafico-etapas">';

  porEtapa.forEach((fila) => {
    const pct = totalPersonas === 0 ? 0 : Math.round((fila.cantidad / totalPersonas) * 100);
    html +=
      '<div class="fila-grafico">' +
      '<span class="etiqueta">' + fila.etapa + ' (' + fila.cantidad + ')</span>' +
      '<div class="barra"><div class="relleno relleno-' + claseParaGrafico(fila.etapa) + '" style="width:' + pct + '%"></div></div>' +
      '</div>';
  });

  html += '</section>';
  return html;
}

async function cargarReportes() {
  pantalla = 'reportes';
  tituloPagina.textContent = 'Reportes';
  ocultarCambiarContrasena();
  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.add('oculto');
  botonVolver.classList.add('oculto');
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');
  ocultarReuniones();
  seccionBusqueda.classList.add('oculto');
  resultados.innerHTML = '';
  seccionReportes.classList.remove('oculto');
  seccionAdmin.classList.add('oculto');
  botonAdmin.classList.remove('activo');
  mensajeErrorReportes.classList.add('oculto');
  botonReportes.classList.add('activo');
  botonRedes.classList.remove('activo');
  botonBuscar.classList.remove('activo');
  reporteRed.innerHTML = '';
  listaMisRedes.innerHTML = '';

  if (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Pastor') {
    const respuesta = await fetch('/api/reportes/formacion');
    const reporte = await respuesta.json();
    reporteFormacion.innerHTML =
      '<h3>Formación general</h3>' +
      fichaDeTotales(reporte.resumen) +
      barrasDeEtapas(reporte.porEtapa, reporte.resumen.personas);
  } else {
    reporteFormacion.innerHTML = '<h3>Formación de mi red</h3>';
  }

  const respuestaRedes = await fetch('/api/mis-redes');
  const redes = await respuestaRedes.json();

  if (redes.length === 0) {
    listaMisRedes.innerHTML = '<p class="vacio">No tienes redes asignadas.</p>';
    return;
  }

  redes.forEach((red) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-persona';
    tarjeta.innerHTML = '<strong>' + red.nombre + '</strong>';

    const boton = document.createElement('button');
    boton.className = 'btn btn-secundario';
    boton.textContent = 'Ver reporte';
    boton.addEventListener('click', () => verReporteRed(red.id));

    tarjeta.appendChild(boton);
    listaMisRedes.appendChild(tarjeta);
  });
}

async function verReporteRed(redId) {
  mensajeErrorReportes.classList.add('oculto');
  const respuesta = await fetch('/api/reportes/red/' + redId);
  const reporte = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorReportes.textContent = reporte.error;
    mensajeErrorReportes.classList.remove('oculto');
    return;
  }

  const porEtapa = reporte.formacion;
  const cuentanEtapa = porEtapa.reduce((suma, fila) => suma + fila.cantidad, 0);

  let html = '<h3>Reporte de ' + reporte.red + '</h3>';

  html += '<section class="reporte-totales">';
  html += '<div class="total total-personas"><strong>' + reporte.totalGrupos + '</strong><span>grupos</span></div>';
  html += '<div class="total total-personas"><strong>' + reporte.totalIntegrantes + '</strong><span>integrantes</span></div>';
  html += '<div class="total total-personas"><strong>' + reporte.totalReuniones + '</strong><span>reuniones</span></div>';
  html += '<div class="total total-nuevos"><strong>' + reporte.nuevos + '</strong><span>nuevos</span></div>';
  html += '<div class="total total-bautizados"><strong>' + reporte.bautizados + '</strong><span>bautizados</span></div>';
  html += '</section>';

  html += '<h3>Grupos</h3><section id="detalle">';

  reporte.porGrupo.forEach((grupo) => {
    html +=
      '<article class="tarjeta tarjeta-persona">' +
      '<strong>' + grupo.nombre + '</strong>' +
      '<span>' + grupo.integrantes + ' integrantes · ' + grupo.reuniones + ' reuniones</span>' +
      '</article>';
  });

  html += '</section>';
  html += '<h3>Etapas de formación</h3>';
  html += barrasDeEtapas(porEtapa, cuentanEtapa === 0 ? reporte.totalIntegrantes : cuentanEtapa);

  reporteRed.innerHTML = html;
}

async function cargarAdmin() {
  pantalla = 'admin';
  tituloPagina.textContent = 'Administrar';
  ocultarCambiarContrasena();
  contenedorRedes.classList.add('oculto');
  contenedorDetalle.classList.add('oculto');
  botonVolver.classList.add('oculto');
  botonAgregar.classList.add('oculto');
  formularioSection.classList.add('oculto');
  ocultarReuniones();
  seccionBusqueda.classList.add('oculto');
  resultados.innerHTML = '';
  seccionReportes.classList.add('oculto');
  seccionAdmin.classList.remove('oculto');
  mensajeErrorAdmin.classList.add('oculto');
  botonAdmin.classList.add('activo');
  botonRedes.classList.remove('activo');
  botonBuscar.classList.remove('activo');
  botonReportes.classList.remove('activo');
  await cargarListasAdmin();
}

async function cargarListasAdmin() {
  const respuestaRedes = await fetch('/api/redes');
  const redes = await respuestaRedes.json();

  const opcionesRedes = redes.map((red) => '<option value="' + red.id + '">' + red.nombre + '</option>').join('');
  selectGrupoRed.innerHTML = opcionesRedes;
  selectUsuarioRed.innerHTML = opcionesRedes;
  renderAdminRedes(redes);

  const respuestaGrupos = await fetch('/api/grupos?todas=1');
  const grupos = await respuestaGrupos.json();
  renderAdminGrupos(grupos);
  selectUsuarioGrupo.innerHTML = grupos
    .filter((grupo) => grupo.activo === 1)
    .map((grupo) => '<option value="' + grupo.id + '">' + grupo.nombre + ' (' + grupo.red + ')</option>')
    .join('');

  const respuestaPersonas = await fetch('/api/personas');
  const personas = await respuestaPersonas.json();
  selectUsuarioPersona.innerHTML =
    '<option value="">— Crear persona nueva —</option>' +
    personas
      .map((persona) => '<option value="' + persona.id + '">' + persona.nombre_completo + '</option>')
      .join('');
  actualizarCamposUsuario();

  const respuestaUsuarios = await fetch('/api/usuarios');
  const usuarios = await respuestaUsuarios.json();
  renderUsuarios(usuarios);
}

function renderAdminRedes(redes) {
  listaAdminRedes.innerHTML = '';

  if (redes.length === 0) {
    listaAdminRedes.innerHTML = '<p class="vacio">No hay redes creadas.</p>';
    return;
  }

  redes.forEach((red) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-persona';
    tarjeta.innerHTML = '<strong>' + red.nombre + '</strong>' +
      '<span>' + (red.activo === 1 ? 'Activa' : 'Inactiva') + '</span>' +
      (red.activo === 1 ? '<button class="btn btn-borde-rojo">Desactivar</button>' : '<button class="btn btn-secundario">Activar</button>');

    tarjeta.querySelector('button').addEventListener('click', () => cambiarEstadoRed(red.id, red.activo === 1 ? 0 : 1));
    listaAdminRedes.appendChild(tarjeta);
  });
}

function renderAdminGrupos(grupos) {
  listaAdminGrupos.innerHTML = '';

  if (grupos.length === 0) {
    listaAdminGrupos.innerHTML = '<p class="vacio">No hay grupos creados.</p>';
    return;
  }

  grupos.forEach((grupo) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-persona';
    tarjeta.innerHTML = '<strong>' + grupo.nombre + '</strong>' +
      '<span>' + grupo.red + (grupo.activo === 1 ? ' · Activo' : ' · Inactivo') + '</span>' +
      (grupo.activo === 1 ? '<button class="btn btn-borde-rojo">Desactivar</button>' : '<button class="btn btn-secundario">Activar</button>') +
      '<button class="btn btn-secundario">Editar</button>';

    const botones = tarjeta.querySelectorAll('button');
    if (grupo.activo === 1) {
      botones[0].addEventListener('click', () => cambiarEstadoGrupo(grupo.id, 0));
    } else {
      botones[0].addEventListener('click', () => cambiarEstadoGrupo(grupo.id, 1));
    }
    botones[1].addEventListener('click', () => abrirFormularioEditarGrupo(grupo));
    listaAdminGrupos.appendChild(tarjeta);
  });
}

let grupoEnEdicion = null;

function abrirFormularioEditarGrupo(grupo) {
  grupoEnEdicion = grupo.id;
  mensajeErrorAdmin.classList.add('oculto');

  const partesHora = (grupo.hora_habitual || '').split(' ');
  const hora = partesHora[0] || '';
  const periodo = partesHora[1] || 'PM';

  formularioEditarGrupo.nombre.value = grupo.nombre;
  formularioEditarGrupo.dia_habitual.value = grupo.dia_habitual || '';
  formularioEditarGrupo.hora_habitual.value = hora;
  formularioEditarGrupo.hora_habitual_periodo.value = periodo;
  formularioEditarGrupo.duracion_habitual.value = grupo.duracion_habitual || '';
  formularioEditarGrupo.direccion.value = grupo.direccion || '';
  formularioEditarGrupo.barrio.value = grupo.barrio || '';
  formularioEditarGrupo.ciudad.value = grupo.ciudad || '';

  formularioEditarGrupo.classList.remove('oculto');
  formularioEditarGrupo.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cerrarFormularioEditarGrupo() {
  formularioEditarGrupo.classList.add('oculto');
  formularioEditarGrupo.reset();
  grupoEnEdicion = null;
}

async function guardarEdicionGrupo(evento) {
  evento.preventDefault();
  mensajeErrorAdmin.classList.add('oculto');

  const datos = {
    nombre: formularioEditarGrupo.nombre.value,
    dia_habitual: formularioEditarGrupo.dia_habitual.value,
    hora_habitual: formularioEditarGrupo.hora_habitual.value + ' ' + formularioEditarGrupo.hora_habitual_periodo.value,
    duracion_habitual: formularioEditarGrupo.duracion_habitual.value,
    direccion: formularioEditarGrupo.direccion.value,
    barrio: formularioEditarGrupo.barrio.value,
    ciudad: formularioEditarGrupo.ciudad.value
  };

  const respuesta = await fetch('/api/grupos/' + grupoEnEdicion, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorAdmin.textContent = resultado.error;
    mensajeErrorAdmin.classList.remove('oculto');
    return;
  }

  cerrarFormularioEditarGrupo();
  await cargarListasAdmin();
}

async function cambiarEstadoRed(redId, activo) {
  await fetch('/api/redes/' + redId + '/estado', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo })
  });
  await cargarListasAdmin();
}

async function cambiarEstadoGrupo(grupoId, activo) {
  await fetch('/api/grupos/' + grupoId + '/estado', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo })
  });
  await cargarListasAdmin();
}

function renderUsuarios(usuarios) {
  listaUsuarios.innerHTML = '';

  if (usuarios.length === 0) {
    listaUsuarios.innerHTML = '<p class="vacio">No hay usuarios creados.</p>';
    return;
  }

  usuarios.forEach((usuario) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta tarjeta-persona';
    tarjeta.innerHTML = '<strong>' + (usuario.nombre_completo || 'Sin persona') + '</strong>' +
      '<span>' + usuario.rol + ' · ' + usuario.cedula + (usuario.activo === 1 ? ' · Activo' : ' · Inactivo') + '</span>' +
      (usuario.activo === 1
        ? '<button class="btn btn-borde-rojo">Desactivar</button><button class="btn btn-secundario">Cambiar contraseña</button>'
        : '<button class="btn btn-secundario">Activar</button>');

    const botonEstado = tarjeta.querySelector('button');
    if (usuario.activo === 1) {
      botonEstado.addEventListener('click', () => cambiarEstadoUsuario(usuario.id, 0));
    } else {
      botonEstado.addEventListener('click', () => cambiarEstadoUsuario(usuario.id, 1));
    }

    if (usuario.activo === 1) {
      tarjeta.querySelectorAll('button')[1].addEventListener('click', () => cambiarContrasenaUsuario(usuario.id));
    }

    listaUsuarios.appendChild(tarjeta);
  });
}

async function cambiarEstadoUsuario(usuarioId, activo) {
  const respuesta = await fetch('/api/usuarios/' + usuarioId + '/estado', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorAdmin.textContent = resultado.error;
    mensajeErrorAdmin.classList.remove('oculto');
    return;
  }

  await cargarListasAdmin();
}

async function cambiarContrasenaUsuario(usuarioId) {
  const contrasena = window.prompt('Nueva contraseña (mínimo 6 caracteres):');

  if (!contrasena) {
    return;
  }

  const respuesta = await fetch('/api/usuarios/' + usuarioId + '/contrasena', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contrasena })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorAdmin.textContent = resultado.error;
    mensajeErrorAdmin.classList.remove('oculto');
    return;
  }

  mensajeErrorAdmin.classList.add('oculto');
  window.alert('Contraseña actualizada.');
}

function actualizarCamposUsuario() {
  const rol = selectUsuarioRol.value;
  campoRedUsuario.classList.toggle('oculto', rol !== 'Líder de Red');
  campoGrupoUsuario.classList.toggle('oculto', rol !== 'Líder de Grupo');
  const esPersonaNueva = selectUsuarioPersona.value === '';
  campoPersonaNueva.classList.toggle('oculto', !esPersonaNueva);
  selectUsuarioPersona.required = !esPersonaNueva;
  formularioUsuario.nombre_persona.required = esPersonaNueva;
}

async function crearUsuario(evento) {
  evento.preventDefault();
  mensajeErrorAdmin.classList.add('oculto');

  const datos = {
    persona_id: selectUsuarioPersona.value,
    nombre_persona: formularioUsuario.nombre_persona.value,
    rol: selectUsuarioRol.value,
    red_id: selectUsuarioRed.value,
    grupo_id: selectUsuarioGrupo.value,
    cedula: formularioUsuario.cedula.value,
    contrasena: formularioUsuario.contrasena.value
  };

  const respuesta = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorAdmin.textContent = resultado.error;
    mensajeErrorAdmin.classList.remove('oculto');
    return;
  }

  formularioUsuario.reset();
  actualizarCamposUsuario();
  await cargarListasAdmin();
}

async function crearRed(evento) {
  evento.preventDefault();
  mensajeErrorAdmin.classList.add('oculto');

  const respuesta = await fetch('/api/redes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: formularioNuevaRed.nombre.value })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorAdmin.textContent = resultado.error;
    mensajeErrorAdmin.classList.remove('oculto');
    return;
  }

  formularioNuevaRed.reset();
  await cargarListasAdmin();
}

async function crearGrupo(evento) {
  evento.preventDefault();
  mensajeErrorAdmin.classList.add('oculto');

  const datos = {
    red_id: selectGrupoRed.value,
    nombre: formularioNuevoGrupo.nombre.value,
    dia_habitual: formularioNuevoGrupo.dia_habitual.value,
    hora_habitual: formularioNuevoGrupo.hora_habitual.value + ' ' + formularioNuevoGrupo.hora_habitual_periodo.value,
    direccion: formularioNuevoGrupo.direccion.value,
    barrio: formularioNuevoGrupo.barrio.value,
    ciudad: formularioNuevoGrupo.ciudad.value
  };

  const respuesta = await fetch('/api/grupos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    mensajeErrorAdmin.textContent = resultado.error;
    mensajeErrorAdmin.classList.remove('oculto');
    return;
  }

  formularioNuevoGrupo.reset();
  await cargarListasAdmin();
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
  ocultarCambiarContrasena();
  cerrarSesionFrontend();
});

botonVolver.addEventListener('click', volver);
botonAgregar.addEventListener('click', abrirFormulario);
botonBuscarPersona.addEventListener('click', buscarPersonaParaGrupo);
campoBuscarPersona.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') {
    evento.preventDefault();
    buscarPersonaParaGrupo();
  }
});
botonCancelar.addEventListener('click', cerrarFormulario);
formulario.addEventListener('submit', crearIntegrante);

botonAgregarReunion.addEventListener('click', abrirFormularioReunion);
botonCancelarReunion.addEventListener('click', cerrarFormularioReunion);
formularioReunion.addEventListener('submit', crearReunion);

formularioBusqueda.addEventListener('submit', buscarPersonas);
botonBuscar.addEventListener('click', mostrarBusqueda);
botonRedes.addEventListener('click', mostrarRedes);
botonCambiarContrasena.addEventListener('click', mostrarOcultarCambiarContrasena);
botonCancelarContrasena.addEventListener('click', ocultarCambiarContrasena);
formularioCambiarContrasena.addEventListener('submit', cambiarContrasena);
formularioEditarReunion.addEventListener('submit', guardarEdicionReunion);
cancelarEditarReunion.addEventListener('click', cerrarFormularioEditarReunion);
botonReportes.addEventListener('click', cargarReportes);
botonAdmin.addEventListener('click', cargarAdmin);
formularioNuevaRed.addEventListener('submit', crearRed);
formularioNuevoGrupo.addEventListener('submit', crearGrupo);
formularioUsuario.addEventListener('submit', crearUsuario);
selectUsuarioRol.addEventListener('change', actualizarCamposUsuario);
selectUsuarioPersona.addEventListener('change', actualizarCamposUsuario);
formularioEditarGrupo.addEventListener('submit', guardarEdicionGrupo);
cancelarEditarGrupo.addEventListener('click', cerrarFormularioEditarGrupo);
formularioCambioLiderRed.addEventListener('submit', transferirLiderRed);

const horas = [];
for (let h = 7; h <= 12; h++) {
  horas.push(h);
}
for (let h = 1; h <= 11; h++) {
  horas.push(h);
}
horas.forEach((h) => {
  ['00', '30'].forEach((minuto) => {
    const opcion = document.createElement('option');
    opcion.value = h + ':' + minuto;
    opcion.textContent = h + ':' + minuto;
    formularioNuevoGrupo.hora_habitual.appendChild(opcion);

    const opcionEditar = document.createElement('option');
    opcionEditar.value = h + ':' + minuto;
    opcionEditar.textContent = h + ':' + minuto;
    formularioEditarGrupo.hora_habitual.appendChild(opcionEditar);
  });
});

iniciar();