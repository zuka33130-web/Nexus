# EVO BROWSER — Propuesta Técnica, Arquitectura y Plan de Implementación

EVO BROWSER es un navegador de Internet completo de alto rendimiento que integra de manera nativa un motor de mediación bidireccional inteligente y la arquitectura de memoria persistente EVO MEMORY. Transforma la navegación web convencional en un entorno operativo donde las interacciones entre el usuario y las IA (ChatGPT, Claude, Gemini, Ollama y APIs) son interceptadas, analizadas, enriquecidas y protegidas contra bucles, errores y pérdida de contexto en tiempo real.

> [!IMPORTANT]
> **Decisiones Clave Confirmadas en la Fase de Clarificación:**
> - **Entorno de Ejecución y Motor**: Arquitectura dual: navegador full-stack web con proxy inverso dinámico de despojo de cabeceras (X-Frame-Options / CSP bypass) + especificación de empaquetado nativo de escritorio basado en Chromium/Electron.
> - **Mecanismo de Interceptación**: Enfoque híbrido que combina inyección de Content Scripts DOM en tiempo de ejecución con proxy de red HTTP/WebSocket para decodificar streams SSE/JSON en tiempo real.
> - **Nivel de Autonomía por Defecto**: Modo Asistencia (Asistencia con previsualización interactiva de mejoras antes del envío y validación de respuestas al recibir), configurable a Observación, Mediación o Intervención Autónoma.

---

## 1. Investigación de Viabilidad Técnica y Selección Tecnológica

### A. Diagnóstico de Viabilidad Técnica para Navegación Real de IA
1. **Barreras de Seguridad Web Estándar (`X-Frame-Options`, `Content-Security-Policy`)**:
   - Plataformas como ChatGPT (`chatgpt.com`), Claude (`claude.ai`) y Gemini (`gemini.google.com`) configuran cabeceras estrictas `frame-ancestors 'none'` y `X-Frame-Options: DENY`. Un navegador web puro en sandbox de iframe no puede cargarlas directamente sin un motor de mediación proxy.
   - **Solución Técnica Viable**: El servidor Express actúa como un *Dynamic Streaming Reverse Proxy* (`/api/proxy/browse?url=...`). Este motor descarga la página remota, neutraliza las directivas obstructivas de CSP y `X-Frame-Options`, reescribe URLs relativas (imágenes, scripts, CSS) para enrutarlas por el proxy, e inyecta el script de instrumentación EVO (`evo-runtime-bridge.js`).
2. **Interceptación de Solicitudes y Respuestas Asíncronas (Fetch, XHR, SSE, WebSockets)**:
   - ChatGPT y Claude utilizan Server-Sent Events (`text/event-stream`) y payloads protobuf o JSON fragmentados.
   - **Solución Técnica Viable**: Inyección en el contexto de página de un gancho (`window.fetch` y `XMLHttpRequest` patch) que lee los flujos de lectura en modo bifurcación (*Tee ReadableStream*), enviando un espejo binario al canal de eventos local de EVO sin interferir con la latencia percibida por la interfaz web original.

### B. Selección de Pila Tecnológica
| Componente | Tecnología Seleccionada | Justificación Técnica |
| :--- | :--- | :--- |
| **Shell & UI del Navegador** | React 19 + Tailwind CSS v4 + Motion | Renderizado a 60fps de pestañas, Omnibox, HUD de mediación y canvas web. |
| **Motor de Proxy Web / Backend** | Node.js + Express + Cheerio + Http-Proxy-Middleware | Despojo de CSP/CORS, reescritura de hipervínculos, inyección de bridge y gestión de cookies de sesión aisladas. |
| **Motor de Mediación & Antibucle** | Node.js Server SDK `@google/genai` (Gemini 3.8 Flash) | Análisis ultrarrápido (<250ms) de intención de prompt, detección de circularidad semántica y optimización de tokens. |
| **Base de Datos & EVO MEMORY** | Local IndexedDB (Dexie/idb) + LocalStorage Vault + SQLite/FS en backend | Persistencia local offline-first de proyectos, historial de navegación, árboles de decisión y restricciones estrictas. |
| **Adaptadores de IA** | Arquitectura Plug & Play (Web Injected + REST/Ollama Fallback) | ChatGPT (Web/API), Claude (Web/API), Gemini (Web/API), Ollama (Localhost:11434). |
| **Empaquetado Desktop (Evolutivo)** | Arquitectura compatible Electron / Chromium Shell | Misma base de código web exportable a binario nativo con `webviewTag` y `webRequest` API. |

---

## 2. Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       EVO BROWSER                                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Tabs Manager: Tab 1 (ChatGPT) | Tab 2 (Claude) | Tab 3 (Docs) | + New Tab ]  [Dock]  │
│ [ ◄  ►  ⟳ ]  [ 🔒 https://chatgpt.com/c/active-thread                     ★ ] [Shield] │
├────────────────────────────────────────────────────────────┬───────────────────────────┤
│                                                            │     PANEL LATERAL EVO     │
│                   CANVAS DE NAVEGACIÓN WEB                 ├───────────────────────────┤
│                                                            │ 🧠 EVO MEMORY             │
│   ┌────────────────────────────────────────────────────┐   │  - Proyecto Activo        │
│   │ [Sitio Web Real Cargado / Proxy Interactivo]      │   │  - Objetivos Fijos        │
│   │                                                    │   │  - Restricciones Estricta │
│   │                                                    │   ├───────────────────────────┤
│   │ Interfaz Original de ChatGPT / Claude / Gemini     │   │ 🛡️ MONITOR & MEDIACIÓN    │
│   │ (Sin sustitución ni imitaciones cosméticas)        │   │  - Nivel: [ Asistencia  ] │
│   │                                                    │   │  - Estado: Interceptando  │
│   │ ── Injected EVO Runtime Bridge ──────────────────  │   │  - Tokens Ahorrados: 38%  │
│   │  * Hook en textarea / submit                       │   ├───────────────────────────┤
│   │  * Tee de Streams SSE / Fetch / XHR                │   │ 🔄 DETECTOR DE BUCLES     │
│   │                                                    │   │  - Entropía: Normal       │
│   │                                                    │   │  - Soluciones Previas: 4  │
│   │                                                    │   ├───────────────────────────┤
│   │                                                    │   │ 📝 INSPECTOR DE MENSAJES  │
│   │                                                    │   │  [Original vs Optimizado] │
│   └────────────────────────────────────────────────────┘   │  [Previsualizar y Enviar] │
├────────────────────────────────────────────────────────────┴───────────────────────────┤
│   STATUS BAR: Modo Asistencia Activo · Aislamiento de Cookies: Activo · Memoria: 12KB  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Diagrama de Flujo de Mediación Bidireccional

```
[Usuario escribe en la IA] 
           │
           ▼
[Runtime Bridge Intercepta submit] ────► [¿Nivel = Asistencia o Mediación?]
           │                                          │
           │ No (Observación)                         │ Sí
           │                                          ▼
           │                         [EVO Engine: Recupera EVO MEMORY]
           │                         [Verifica Restricciones y Objetivos]
           │                         [Elimina Redundancia & Optimiza Tokens]
           │                         [Muestra Propuesta de Prompt Mejorado]
           │                                          │
           │                             (Usuario Aprueba / Auto-Dispatch)
           ▼                                          │
[Envío del Mensaje al Servidor de la IA] ◄────────────┘
           │
           ▼ (Streaming SSE / Fragmentos)
[Runtime Bridge Clona Stream de Respuesta en Tiempo Real]
           │
           ├──► [Renderizado en la Interfaz Web de la IA Original]
           │
           └──► [Motor Antibucle EVO]
                     │
                     ├── [¿Detecta bucle circular / repetición de fallo?]
                     │        ├── SÍ: Alerta inmediata + Sugerencia de corte + Fork de contexto
                     │        └── NO: Almacena en Memoria Episódica EVO
                     │
                     └── [¿Detecta incumplimiento de restricciones?]
                              └── Marca advertencia visual con opción de reintento automático
```

---

## 3. Especificación Detallada de Módulos

### 1. Motor del Navegador Web (Core Browser)
- **Omnibox Inteligente**: Reconocimiento automático de URLs vs búsquedas en motores (DuckDuckGo, Google, Bing).
- **Gestión de Pestañas y Sesiones**: Pestañas concurrentes con almacenamiento de estado, favicon extraction, suspensión en segundo plano para ahorrar memoria RAM y restauración ante caídas.
- **Proxy Streamer & Bypass de Cabeceras**: Servidor proxy Express con reescritura de cookies de sesión, headers de referer, compresión gzip/brotli y pasarela HTTPS limpia.
- **Herramientas de Navegación**: Historial de navegación local, favoritos/marcadores categorizados, administrador de descargas y panel de configuración de privacidad y permisos (cámara, micro, almacenamiento).

### 2. Motor de Interceptación Bidireccional
- **Interceptación de Entrada**:
  - Captura eventos de entrada en elementos `contenteditable`, `textarea` y botones de envío de las principales interfaces de IA.
  - Extrae el texto sin procesar, contexto visible inmediato e intención antes de la mutación de red.
  - Capacidad de pausar el evento de envío para mostrar la ventana de mediación contextual (en modo Asistencia).
- **Interceptación de Salida**:
  - `EventSource` y `ReadableStream` interceptor para capturar tokens a medida que llegan.
  - Reensamblador de fragmentos: une bloques SSE de ChatGPT (`data: {"choices": [...]}`), Claude y Gemini, generando un documento completo y trazable.
  - Registro de regeneraciones, paradas abruptas y códigos de error HTTP de la plataforma.

### 3. Motor Inteligente de Mediación y Antibucle
- **Comprobación de Intención y Restricciones**: Analiza si el prompt del usuario olvida directivas fundamentales definidas en el proyecto (ej: "lenguaje TypeScript", "sin librerías externas", "formato JSON estricto").
- **Detección de Razonamiento Circular y Bucles**:
  - Mantiene un buffer de los últimos $N$ turnos y un árbol de fallos conocidos.
  - Algoritmo de similitud semántica y hash de soluciones: si la IA propone una solución que ya falló en un turno previo, EVO dispara una alerta visual: *"La IA ha entrado en un ciclo repitiendo una solución previamente rechazada"*.
  - Generador de *Break-the-Loop*: Inyecta automáticamente una directiva de reseteo estratégico: *"La solución propuesta es idéntica al intento fallido #2. Cambiemos de enfoque: analicemos la causa raíz desde X perspectiva"*.

### 4. EVO MEMORY: Persistencia y Continuidad
- **Espacio de Proyectos**: Permite al usuario definir el proyecto actual (ej: "Migración de Base de Datos", "Diseño de Arquitectura").
- **Objetivos Permanentes y Restricciones Estrictas**: Reglas invariables que EVO inyecta de forma condensada y optimizada en los prompts para que la IA nunca pierda el rumbo.
- **Historial de Decisiones**: Registro cronológico de decisiones tomadas ("Decidimos usar Express en vez de Fastify porque..."), accesible instantáneamente.
- **Recuperación Semántica de Contexto**: Búsqueda contextual sobre sesiones anteriores para no tener que re-explicar el contexto al abrir una nueva pestaña o cambiar de ChatGPT a Claude.

### 5. Optimización de Tokens y Presupuesto
- **Poda de Redundancia**: Filtra preámbulos conversacionales innecesarios ("Como modelo de lenguaje...", "Por supuesto, con gusto te ayudo...").
- **Compresión de Contexto**: Resúmenes densos de código y turnos previos generados por Gemini 3.8 Flash antes de transferir contexto a un modelo con ventana más reducida.
- **Medidor de Tokens**: Monitor en tiempo real del tamaño de los prompts y estimación del gasto/consumo de contexto de la sesión.

### 6. Adaptadores de IA Modulares
- **Adaptador ChatGPT**: Identificadores de DOM (`#prompt-textarea`), rutas de streaming de OpenAI, soporte de modelos GPT-4o / o1 / o3.
- **Adaptador Claude**: Selectores de chat de Anthropic, streaming de artefactos de código y detección de pausas de pensamiento.
- **Adaptador Gemini**: Selectores de la web de Gemini, soporte de subida multimodal.
- **Adaptador Ollama / Local AI**: Conexión directa a `http://localhost:11434` para usuarios que ejecutan modelos locales (Llama 3, DeepSeek, Mistral, Qwen) sin salir del navegador.
- **Adaptador API Directa**: Pasarela de emergencia directa con claves API para casos donde las webs sufran cambios de DOM o bloqueos temporales.

---

## 4. Análisis de Seguridad, Privacidad y Consumo

### Seguridad y Privacidad
- **Almacenamiento Local Primero (Local-First)**: Toda la memoria EVO, historial y configuraciones residen en el navegador/servidor local del usuario.
- **Aislamiento de Sesiones**: Cookies y datos de navegación de cada sitio se mantienen en contenedores estrictamente separados.
- **Sin Fuga de Credenciales**: Las contraseñas y tokens de autenticación de las cuentas de usuario en OpenAI/Anthropic/Google nunca son enviados al motor de mediación; el agente mediador solo observa el contenido de los prompts y respuestas de chat explícitamente autorizados.
- **Transparencia Total**: Registro de auditoría visual que muestra qué se interceptó, qué se modificó y qué se envió.

### Consumo de Hardware y Rendimiento
- **Sobrecarga de Latencia**: El proxy local añade <15ms de latencia de red. La intervención de mediación asistida es inmediata (<200ms para análisis local de heurísticas y <500ms si se invoca optimización profunda con Gemini Flash).
- **Consumo de Memoria**: La interfaz utiliza virtualización de DOM para hilos extensos de conversación y gestión de ciclo de vida de pestañas para mantener el consumo de RAM por debajo de 350MB en el contenedor.

---

## 5. Criterios de Aceptación y Plan de Pruebas Reales

| # | Prueba / Criterio | Validación Real Esperada |
| :--- | :--- | :--- |
| **P-1** | **Navegación Web Real** | Navegación exitosa a sitios web estándar (Wikipedia, HackerNews, GitHub, blogs técnicos) mediante la barra de direcciones con navegación adelante/atrás/recarga. |
| **P-2** | **Acceso a Plataformas de IA** | Carga de ChatGPT, Claude o Gemini a través del proxy sin errores de `X-Frame-Options` o CSP bloqueante. |
| **P-3** | **Interceptación de Entrada** | Al redactar un prompt en la plataforma de IA, el HUD lateral de EVO detecta el contenido del mensaje antes del envío. |
| **P-4** | **Mediación en Modo Asistencia** | EVO sugiere mejoras de contexto basadas en los objetivos guardados en EVO MEMORY y permite al usuario aceptar o rechazar la optimización. |
| **P-5** | **Interceptación de Salida en Streaming** | A medida que la IA responde en streaming, el Monitor de Conversaciones de EVO recibe y ensambla los fragmentos progresivamente en tiempo real. |
| **P-6** | **Detección Antibucle** | Si se simula o produce una respuesta repetida o un error recurrente, el indicador de bucles se activa en el panel con propuesta de corrección. |
| **P-7** | **Persistencia EVO MEMORY** | Definir un proyecto con restricciones, recargar el navegador y verificar que las directivas persisten y se vinculan automáticamente. |

---

## 6. Fases de Desarrollo Planificadas

1. **Fase 1: Shell del Navegador y Proxy Inverso Dinámico**
   - Implementar el layout del navegador: barra de navegación (Omnibox), pestañas interactivas, controles de navegación (Atrás, Adelante, Recargar, Home), historial y marcadores.
   - Desarrollar el servidor proxy `/api/proxy` que elimina cabeceras CSP/X-Frame-Options, reescribe recursos e inyecta el `evo-runtime-bridge.js`.
2. **Fase 2: Motor EVO MEMORY y Almacén Persistente**
   - Estructura de datos para Proyectos, Objetivos, Restricciones y Memoria Episódica en IndexedDB.
   - Panel lateral desplegable con gestión de proyectos y selector de nivel de autonomía (Observación, Asistencia, Mediación).
3. **Fase 3: Runtime Bridge e Interceptación Bidireccional**
   - Script de inyección que detecta cajas de texto de ChatGPT, Claude, Gemini y formularios genéricos de IA.
   - Canal de comunicación bidireccional (PostMessage / WebSocket / SSE) entre el marco de navegación y el Shell de EVO.
4. **Fase 4: Motor de Mediación Inteligente y Antibucle**
   - Conector con el SDK `@google/genai` (modelo `gemini-3.8-flash` en servidor) para análisis de intención, enriquecimiento de prompts y detección de bucles.
   - Interfaz de previsualización de diferencias (Diff view) para comparar el prompt original y el optimizado.
5. **Fase 5: Adaptadores de IA & Conectividad Local (Ollama)**
   - Adaptador específico para Ollama en localhost con detección automática de modelos instalados.
   - Consola de tokens y optimización de contexto.
6. **Fase 6: Pruebas de Integración y Pulido de Experiencia de Usuario**
   - Verificación de los 7 criterios de aceptación en vivo.
   - Optimización de rendimiento y atajos de teclado del navegador.
