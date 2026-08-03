/* ============================================================
   TASKFLOW — Aplicación de Gestión de Tareas
   Evaluación Módulo 4: Programación avanzada en JavaScript
   ============================================================ */

/* ------------------------------------------------------------
   1. ORIENTACIÓN A OBJETOS EN JAVASCRIPT
   ------------------------------------------------------------ */

/**
 * Representa una única tarea del sistema.
 */
class Tarea {
  constructor(descripcion, fechaLimite = null) {
    this.id = crypto.randomUUID();
    this.descripcion = descripcion;
    this.estado = "pendiente"; // "pendiente" | "completada"
    this.fechaCreacion = new Date();
    this.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
  }

  // Cambia el estado alternando entre pendiente/completada
  cambiarEstado() {
    this.estado = this.estado === "pendiente" ? "completada" : "pendiente";
    return this.estado;
  }

  // La propia tarea sabe "eliminarse": se marca como eliminada.
  // GestorTareas es quien luego la remueve efectivamente del arreglo.
  eliminar() {
    this.eliminada = true;
    return this.eliminada;
  }

  estaCompletada() {
    return this.estado === "completada";
  }

  // Milisegundos restantes hasta la fecha límite (null si no aplica)
  tiempoRestante() {
    if (!this.fechaLimite) return null;
    return this.fechaLimite.getTime() - Date.now();
  }
}

/**
 * Administra la colección de tareas: alta, baja, cambio de estado,
 * filtros y persistencia.
 */
class GestorTareas {
  constructor() {
    this.tareas = [];
  }

  agregarTarea(descripcion, fechaLimite = null) {
    const nuevaTarea = new Tarea(descripcion, fechaLimite);
    this.tareas = [...this.tareas, nuevaTarea]; // spread para no mutar directamente
    return nuevaTarea;
  }

  eliminarTarea(id) {
    const tarea = this.tareas.find((t) => t.id === id);
    if (tarea) tarea.eliminar(); // la tarea se marca a sí misma como eliminada
    this.tareas = this.tareas.filter((t) => !t.eliminada);
  }

  cambiarEstadoTarea(id) {
    const tarea = this.tareas.find((t) => t.id === id);
    if (tarea) tarea.cambiarEstado();
    return tarea;
  }

  obtenerTareas({ filtro = "todas" } = {}) {
    if (filtro === "todas") return this.tareas;
    return this.tareas.filter((t) => t.estado === filtro);
  }

  // Reemplaza toda la colección (usado al importar/hidratar desde storage o API)
  cargarTareas(tareas) {
    this.tareas = [...tareas];
  }
}

/* Instancia global que administra el estado de la app */
const gestor = new GestorTareas();

/* ------------------------------------------------------------
   2. CARACTERÍSTICAS JAVASCRIPT ES6+ (demostración puntual)
   ------------------------------------------------------------ */

// Ejemplo de destructuring + rest al leer los campos del formulario
function leerFormulario() {
  const { value: descripcion } = document.getElementById("input-descripcion");
  const { value: fechaLimite } = document.getElementById("input-fecha-limite");
  return { descripcion: descripcion.trim(), fechaLimite: fechaLimite || null };
}

// Ejemplo de template literals + arrow function
const formatearFecha = (fecha) =>
  fecha
    ? `${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : null;

// Ejemplo de rest operator para combinar mensajes de notificación
function construirMensaje(titulo, ...detalles) {
  return `${titulo}${detalles.length ? ": " + detalles.join(" · ") : ""}`;
}

/* ------------------------------------------------------------
   3. EVENTOS Y MANIPULACIÓN DEL DOM
   ------------------------------------------------------------ */

const $form = document.getElementById("form-tarea");
const $inputDescripcion = document.getElementById("input-descripcion");
const $inputFechaLimite = document.getElementById("input-fecha-limite");
const $btnAgregar = document.getElementById("btn-agregar");
const $lista = document.getElementById("lista-tareas");
const $estadoVacio = document.getElementById("estado-vacio");
const $filtros = document.getElementById("filtros");

let filtroActivo = "todas";

function renderTareas() {
  const tareas = gestor.obtenerTareas({ filtro: filtroActivo });
  $lista.innerHTML = "";

  $estadoVacio.style.display = tareas.length ? "none" : "block";

  tareas.forEach((tarea) => {
    const $li = document.createElement("li");
    $li.className = `tarea ${tarea.estaCompletada() ? "completada" : ""}`;
    $li.dataset.id = tarea.id;

    let metaTexto = formatearFecha(tarea.fechaCreacion)
      ? `Creada: ${formatearFecha(tarea.fechaCreacion)}`
      : "";
    if (tarea.fechaLimite) {
      metaTexto += ` · Límite: ${formatearFecha(tarea.fechaLimite)}`;
    }

    $li.innerHTML = `
      <button class="tarea__check" title="Marcar como completada/pendiente"></button>
      <div class="tarea__info">
        <span class="tarea__descripcion"></span>
        <span class="tarea__meta"></span>
        <span class="tarea__contador"></span>
      </div>
      <button class="tarea__eliminar" title="Eliminar">✕</button>
    `;

    // Se asigna por textContent (no innerHTML) para evitar inyección de HTML
    $li.querySelector(".tarea__descripcion").textContent = tarea.descripcion;
    $li.querySelector(".tarea__meta").textContent = metaTexto;

    $lista.appendChild($li);

    // Pinta el contador regresivo inmediatamente (luego se actualiza cada segundo)
    if (tarea.fechaLimite) actualizarContadorDeTarea(tarea, $li);
  });
}

// Evento submit: agregar nueva tarea (con simulación de retardo asincrónico, ver sección 4)
$form.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const { descripcion, fechaLimite } = leerFormulario();
  if (!descripcion) return;

  agregarTareaConRetardo(descripcion, fechaLimite);
  $form.reset();
  $inputDescripcion.focus();
});

// Evento click delegado: completar o eliminar tareas dentro de la lista
$lista.addEventListener("click", (evento) => {
  const $tareaEl = evento.target.closest(".tarea");
  if (!$tareaEl) return;
  const { id } = $tareaEl.dataset;

  if (evento.target.classList.contains("tarea__check")) {
    gestor.cambiarEstadoTarea(id);
    renderTareas();
    guardarEnLocalStorage();
  }

  if (evento.target.classList.contains("tarea__eliminar")) {
    gestor.eliminarTarea(id);
    renderTareas();
    guardarEnLocalStorage();
    mostrarNotificacion(construirMensaje("Tarea eliminada"));
  }
});

// Evento mouseover: resaltar visualmente la tarea bajo el cursor
$lista.addEventListener("mouseover", (evento) => {
  const $tareaEl = evento.target.closest(".tarea");
  if ($tareaEl) $tareaEl.style.borderColor = "var(--accent-2)";
});
$lista.addEventListener("mouseout", (evento) => {
  const $tareaEl = evento.target.closest(".tarea");
  if ($tareaEl) $tareaEl.style.borderColor = "";
});

// Evento keyup: agregar rápidamente presionando Enter dentro del input
$inputDescripcion.addEventListener("keyup", (evento) => {
  if (evento.key === "Enter" && $inputDescripcion.value.trim()) {
    $form.requestSubmit();
  }
});

// Filtros de la lista (todas / pendientes / completadas)
$filtros.addEventListener("click", (evento) => {
  const $btn = evento.target.closest(".filtro");
  if (!$btn) return;
  filtroActivo = $btn.dataset.filtro;
  document
    .querySelectorAll(".filtro")
    .forEach((el) => el.classList.toggle("activo", el === $btn));
  renderTareas();
});

/* ------------------------------------------------------------
   4. JAVASCRIPT ASÍNCRONO
   ------------------------------------------------------------ */

// Simula un retardo (ej. llamada a un servidor) al agregar una tarea
function agregarTareaConRetardo(descripcion, fechaLimite) {
  $btnAgregar.disabled = true;
  $btnAgregar.textContent = "Agregando...";

  setTimeout(() => {
    const tarea = gestor.agregarTarea(descripcion, fechaLimite);
    renderTareas();
    guardarEnLocalStorage();

    $btnAgregar.disabled = false;
    $btnAgregar.textContent = "Agregar";

    // Notificación que aparece 2 segundos después de agregar la tarea
    setTimeout(() => {
      mostrarNotificacion(construirMensaje("Tarea creada", tarea.descripcion));
    }, 2000);
  }, 600); // retardo simulado de 600ms
}

// Muestra una notificación flotante que se autodestruye
function mostrarNotificacion(mensaje, esError = false) {
  const $contenedor = document.getElementById("notificaciones");
  const $noti = document.createElement("div");
  $noti.className = `notificacion ${esError ? "error" : ""}`;
  $noti.textContent = mensaje;
  $contenedor.appendChild($noti);

  setTimeout(() => $noti.remove(), 4000);
}

// Formatea milisegundos restantes como "Xd Xh Xm Xs" (contador regresivo real)
function formatearContador(ms) {
  if (ms <= 0) return "¡Vencida!";

  const segundosTotales = Math.floor(ms / 1000);
  const dias = Math.floor(segundosTotales / 86400);
  const horas = Math.floor((segundosTotales % 86400) / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;

  const partes = [];
  if (dias) partes.push(`${dias}d`);
  if (dias || horas) partes.push(`${horas}h`);
  if (dias || horas || minutos) partes.push(`${minutos}m`);
  partes.push(`${segundos}s`);

  return `Vence en: ${partes.join(" ")}`;
}

// Actualiza el contador regresivo de UNA tarea puntual en el DOM
function actualizarContadorDeTarea(tarea, $li) {
  const $contador = $li.querySelector(".tarea__contador");
  if (!$contador || !tarea.fechaLimite) return;

  if (tarea.estaCompletada()) {
    $contador.textContent = "";
    $contador.className = "tarea__contador";
    return;
  }

  const restante = tarea.tiempoRestante();
  $contador.textContent = formatearContador(restante);
  $contador.className = "tarea__contador";
  if (restante <= 0) $contador.classList.add("vencida");
  else if (restante < 60 * 60 * 1000) $contador.classList.add("urgente");
}

// Contador regresivo (setInterval) global: cada segundo recorre las tareas
// con fecha límite visibles en pantalla y actualiza su tiempo restante,
// sin necesidad de rehacer todo el render de la lista.
function iniciarContadorGlobal() {
  setInterval(() => {
    document.querySelectorAll(".tarea").forEach(($li) => {
      const tarea = gestor.tareas.find((t) => t.id === $li.dataset.id);
      if (tarea && tarea.fechaLimite) actualizarContadorDeTarea(tarea, $li);
    });
  }, 1000); // se actualiza cada segundo
}

/* ------------------------------------------------------------
   5. CONSUMO DE APIS CON JAVASCRIPT
   ------------------------------------------------------------ */

const API_URL = "https://jsonplaceholder.typicode.com/todos";
const STORAGE_KEY = "taskflow_tareas";

// Guarda el estado actual en localStorage
function guardarEnLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gestor.tareas));
  } catch (error) {
    console.error("Error al guardar en localStorage:", error);
    mostrarNotificacion(construirMensaje("No se pudo guardar localmente"), true);
  }
}

// Recupera tareas guardadas en localStorage y reconstruye instancias de Tarea
function cargarDeLocalStorage() {
  try {
    const datos = localStorage.getItem(STORAGE_KEY);
    if (!datos) return [];

    const crudas = JSON.parse(datos);
    return crudas.map((t) => {
      const tarea = new Tarea(t.descripcion, t.fechaLimite);
      tarea.id = t.id;
      tarea.estado = t.estado;
      tarea.fechaCreacion = new Date(t.fechaCreacion);
      return tarea;
    });
  } catch (error) {
    console.error("Error al leer localStorage:", error);
    mostrarNotificacion(construirMensaje("No se pudo leer el almacenamiento local"), true);
    return [];
  }
}

// Importa tareas de ejemplo desde una API externa (JSONPlaceholder) usando fetch + async/await
async function importarTareasDesdeAPI() {
  const $btn = document.getElementById("btn-importar-api");
  $btn.disabled = true;
  $btn.textContent = "Importando...";

  try {
    const respuesta = await fetch(`${API_URL}?_limit=5`);
    if (!respuesta.ok) throw new Error(`Respuesta HTTP ${respuesta.status}`);

    const datos = await respuesta.json();
    datos.forEach(({ title, completed }) => {
      const tarea = gestor.agregarTarea(title);
      if (completed) tarea.cambiarEstado();
    });

    renderTareas();
    guardarEnLocalStorage();
    mostrarNotificacion(construirMensaje("Tareas importadas", `${datos.length} nuevas`));
  } catch (error) {
    console.error("Error al importar desde la API:", error);
    mostrarNotificacion(construirMensaje("Error al importar de la API"), true);
  } finally {
    $btn.disabled = false;
    $btn.textContent = "Importar tareas de API";
  }
}

// Simula el envío ("sincronización") de las tareas actuales a una API remota
async function sincronizarConAPI() {
  const $btn = document.getElementById("btn-sincronizar-api");
  $btn.disabled = true;
  $btn.textContent = "Sincronizando...";

  try {
    const respuesta = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tareas: gestor.tareas }),
    });
    if (!respuesta.ok) throw new Error(`Respuesta HTTP ${respuesta.status}`);

    await respuesta.json(); // JSONPlaceholder responde con un eco simulado
    mostrarNotificacion(construirMensaje("Sincronización completa"));
  } catch (error) {
    console.error("Error al sincronizar con la API:", error);
    mostrarNotificacion(construirMensaje("Error de sincronización"), true);
  } finally {
    $btn.disabled = false;
    $btn.textContent = "Sincronizar con API";
  }
}

document.getElementById("btn-importar-api").addEventListener("click", importarTareasDesdeAPI);
document.getElementById("btn-sincronizar-api").addEventListener("click", sincronizarConAPI);

/* ------------------------------------------------------------
   INICIALIZACIÓN
   ------------------------------------------------------------ */

function iniciar() {
  const tareasGuardadas = cargarDeLocalStorage();
  gestor.cargarTareas(tareasGuardadas);
  renderTareas();
  iniciarContadorGlobal();
}

iniciar();