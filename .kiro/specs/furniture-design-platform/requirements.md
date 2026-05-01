# Requirements Document

## Introduction

FormCraft es una aplicación web de diseño paramétrico de muebles (React + TypeScript + Vite + Three.js).
Este documento especifica los requisitos para evolucionar la plataforma hacia un sistema avanzado de diseño modular con tres capacidades principales:

1. **Sistema Modular de Building Blocks** — diseño libre por arrastre de piezas con snap y validación estructural backend.
2. **Entornos Contextuales** — tres niveles de visualización en contexto (El que sea mas acorde) (escenarios predefinidos, configurador de habitación, Realidad Aumentada). 
3. **Backend Serverless (AWS Lambda)** — procesamiento de cálculos pesados de optimización y gestión de proyectos para agilizar la velocidad

El foco de detalle de este documento es el **Nivel C: Realidad Aumentada con WebXR API**, que permite proyectar el mueble diseñado sobre el espacio físico real del usuario directamente desde el navegador del móvil, sin instalar ninguna aplicación nativa.

---

## Glossary

- **FormCraft**: La aplicación web de diseño de muebles descrita en este documento.
- **AR_Viewer**: Componente React responsable de iniciar y gestionar la sesión WebXR en modo AR.
- **WebXR_Session**: Sesión de Realidad Aumentada gestionada por la WebXR Device API del navegador.
- **Hit_Test_Service**: Servicio WebXR que detecta superficies físicas (suelo, mesa) mediante raycasting contra el entorno real.
- **Furniture_Model**: Representación Three.js del mueble actualmente diseñado en FormCraft, exportable como escena 3D.
- **Reticle**: Indicador visual (anillo o cruz) que muestra dónde se colocará el mueble sobre la superficie detectada.
- **Anchor**: Punto de anclaje WebXR que fija la posición del Furniture_Model en el espacio físico real.
- **Building_Block**: Pieza modular de mueble (panel lateral, estante, cajón) que el usuario arrastra al lienzo 3D.
- **Snap_Engine**: Módulo que detecta proximidad entre Building_Blocks y aplica atracción automática para alinearlos.
- **Structural_Validator**: Servicio backend (AWS Lambda) que evalúa la integridad estructural del mueble ensamblado.
- **Room_Configurator**: Módulo de Nivel B que permite al usuario definir dimensiones y obstáculos de una habitación.
- **Scene_Preset**: Escenario 3D predefinido (cocina, dormitorio) usado en el Nivel A de entornos contextuales.
- **HTTPS_Context**: Contexto de navegación seguro (HTTPS o localhost) requerido por WebXR.
- **DOM_Overlay**: Extensión WebXR que permite renderizar elementos HTML sobre la vista de cámara AR.

---

## Requirements

---

### Requirement 1: Detección de soporte WebXR AR en el dispositivo

**User Story:** Como carpintero o cliente, quiero saber si mi dispositivo soporta AR antes de intentar activarla, para no encontrarme con errores inesperados (En caso que no soporte presentar la definicion del entorno)

#### Acceptance Criteria

1. WHEN la página del AR_Viewer se carga, THE AR_Viewer SHALL consultar `navigator.xr.isSessionSupported('immersive-ar')` para determinar si el dispositivo soporta WebXR AR.
2. IF `navigator.xr` no existe en el navegador, THEN THE AR_Viewer SHALL mostrar un mensaje indicando que el navegador no soporta WebXR AR y sugerir Chrome para Android o Safari en iOS 16+.
3. IF `navigator.xr.isSessionSupported('immersive-ar')` resuelve a `false`, THEN THE AR_Viewer SHALL mostrar un mensaje indicando que el dispositivo no soporta AR inmersiva y ofrecer la vista 3D estándar como alternativa.
4. WHEN el dispositivo soporta WebXR AR, THE AR_Viewer SHALL mostrar un botón "Ver en tu espacio" habilitado para iniciar la sesión.
5. THE AR_Viewer SHALL realizar la comprobación de soporte sin bloquear la carga del resto de la interfaz de FormCraft.

---

### Requirement 2: Inicio y gestión del ciclo de vida de la sesión WebXR AR

**User Story:** Como usuario, quiero iniciar y terminar la sesión de AR de forma controlada, para que la cámara y los recursos del dispositivo se gestionen correctamente.

#### Acceptance Criteria

1. WHEN el usuario pulsa "Ver en tu espacio", THE AR_Viewer SHALL solicitar una WebXR_Session con modo `immersive-ar` y las features `hit-test` y `dom-overlay`.
2. IF el usuario deniega el permiso de cámara, THEN THE AR_Viewer SHALL capturar el error, mostrar un mensaje explicativo y retornar a la vista 3D estándar sin lanzar excepciones no controladas.
3. WHEN la WebXR_Session se inicia correctamente, THE AR_Viewer SHALL configurar un `XRWebGLLayer` o `XRProjectionLayer` como base de renderizado y conectarlo al renderer Three.js existente.
4. WHILE la WebXR_Session está activa, THE AR_Viewer SHALL ejecutar el bucle de renderizado mediante `session.requestAnimationFrame` en lugar del bucle estándar de Three.js.
5. WHEN el usuario pulsa el botón "Salir de AR" o el sistema finaliza la sesión, THE AR_Viewer SHALL llamar a `session.end()`, restaurar el renderer Three.js al estado previo y liberar todos los recursos XR.
6. IF la WebXR_Session se interrumpe inesperadamente (llamada entrante, bloqueo de pantalla), THEN THE AR_Viewer SHALL detectar el evento `sessionend` y restaurar la interfaz estándar de FormCraft sin pérdida de datos del diseño.

---

### Requirement 3: Detección de superficies físicas mediante Hit Test

**User Story:** Como usuario, quiero que la app detecte el suelo o una mesa automáticamente para poder colocar el mueble sobre una superficie real.

#### Acceptance Criteria

1. WHEN la WebXR_Session se inicia, THE Hit_Test_Service SHALL solicitar una fuente de hit-test referenciada al espacio del visor (`viewer` reference space) usando `session.requestHitTestSource`.
2. WHILE la WebXR_Session está activa, THE Hit_Test_Service SHALL evaluar los resultados de hit-test en cada frame del bucle XR y actualizar la posición del Reticle con la pose de la superficie detectada más cercana al centro de la pantalla.
3. WHEN el Hit_Test_Service detecta al menos una superficie válida, THE AR_Viewer SHALL mostrar el Reticle como un anillo plano semitransparente de 0.3 m de diámetro sobre la superficie detectada.
4. WHEN el Hit_Test_Service no detecta ninguna superficie, THE AR_Viewer SHALL ocultar el Reticle y mostrar el texto "Apunta al suelo o a una mesa" en el DOM_Overlay.
5. THE Hit_Test_Service SHALL actualizar la posición del Reticle a una frecuencia mínima de 30 frames por segundo mientras la sesión esté activa.
6. IF la fuente de hit-test no puede crearse porque la feature `hit-test` no está disponible, THEN THE AR_Viewer SHALL permitir al usuario colocar el mueble mediante un toque en pantalla usando la pose del controlador XR como posición de referencia.

---

### Requirement 4: Colocación y anclaje del Furniture_Model en el espacio AR

**User Story:** Como usuario, quiero tocar la pantalla para colocar el mueble sobre la superficie detectada y que permanezca fijo en ese punto mientras me muevo.

#### Acceptance Criteria

1. WHEN el usuario toca la pantalla y el Reticle está visible, THE AR_Viewer SHALL crear un Anchor en la pose actual del Reticle usando `session.createAnchor` o `hitTestResult.createAnchor`.
2. WHEN el Anchor se crea correctamente, THE AR_Viewer SHALL instanciar el Furniture_Model en la posición y orientación del Anchor, alineando la base del mueble con el plano de la superficie detectada.
3. WHILE el Anchor existe, THE AR_Viewer SHALL actualizar la pose del Furniture_Model en cada frame usando `frame.getAnchorPose(anchor, referenceSpace)` para compensar la deriva del tracking.
4. WHEN el Furniture_Model está colocado, THE AR_Viewer SHALL mostrar controles en el DOM_Overlay para rotar el mueble en el eje Y en incrementos de 15 grados.
5. WHEN el usuario toca la pantalla con el Furniture_Model ya colocado, THE AR_Viewer SHALL mover el Furniture_Model a la nueva posición del Reticle, eliminando el Anchor anterior y creando uno nuevo.
6. IF `session.createAnchor` no está disponible en el dispositivo, THEN THE AR_Viewer SHALL mantener la posición del Furniture_Model relativa al espacio de referencia local sin usar Anchors, informando al usuario de que la estabilidad puede ser menor.

---

### Requirement 5: Renderizado del Furniture_Model en contexto AR

**User Story:** Como usuario, quiero ver el mueble renderizado con materiales realistas sobre la imagen de la cámara, para evaluar cómo quedará en mi espacio real.

#### Acceptance Criteria

1. WHEN el Furniture_Model se coloca en AR, THE AR_Viewer SHALL renderizarlo usando el mismo Furniture_Model Three.js activo en el diseñador, sin requerir exportación ni conversión de formato.
2. WHILE la WebXR_Session está activa, THE AR_Viewer SHALL escalar el Furniture_Model usando las dimensiones reales en milímetros del diseño, aplicando el factor de conversión 0.001 mm/m para que el mueble aparezca a escala 1:1 en el mundo real.
3. WHILE la WebXR_Session está activa, THE AR_Viewer SHALL configurar la escena Three.js con `renderer.xr.enabled = true` y usar `renderer.xr.getCamera()` como cámara activa para que la proyección coincida con la perspectiva real del dispositivo.
4. WHEN la iluminación del entorno cambia, THE AR_Viewer SHALL usar `XRLightEstimate` si está disponible para ajustar la intensidad y dirección de la luz ambiental del Furniture_Model, mejorando la integración visual.
5. WHERE la estimación de luz no está disponible, THE AR_Viewer SHALL usar una luz ambiental de intensidad 0.6 y una luz direccional de intensidad 0.8 como valores por defecto.
6. THE AR_Viewer SHALL mantener el fondo de la escena Three.js transparente (`alpha: true` en el renderer) para que la imagen de la cámara real sea visible a través del canvas WebGL.

---

### Requirement 6: Interfaz de usuario superpuesta (DOM Overlay) durante la sesión AR

**User Story:** Como usuario, quiero tener controles accesibles durante la sesión AR para gestionar el mueble y salir de AR sin perder el diseño.

#### Acceptance Criteria

1. WHILE la WebXR_Session está activa, THE AR_Viewer SHALL mostrar un panel DOM_Overlay con los controles: "Salir de AR", "Rotar izquierda", "Rotar derecha" y "Recolocar".
2. THE AR_Viewer SHALL posicionar el panel DOM_Overlay en la parte inferior de la pantalla con un mínimo de 44 × 44 px por botón táctil para garantizar usabilidad en móvil.
3. WHILE la WebXR_Session está activa, THE AR_Viewer SHALL mostrar las dimensiones del mueble (ancho × alto × profundo en cm) en el DOM_Overlay como referencia visual.
4. IF el Furniture_Model no está colocado aún, THEN THE AR_Viewer SHALL mostrar el texto de instrucción "Toca para colocar el mueble" en el DOM_Overlay.
5. WHEN el usuario pulsa "Recolocar", THE AR_Viewer SHALL eliminar el Anchor actual y volver al estado de búsqueda de superficie, mostrando el Reticle nuevamente.

---

### Requirement 7: Compatibilidad y requisitos de entorno para WebXR AR

**User Story:** Como desarrollador, quiero que el sistema AR funcione en los navegadores y dispositivos más comunes, para maximizar el alcance de la funcionalidad.

#### Acceptance Criteria

1. THE AR_Viewer SHALL funcionar en Chrome para Android 81+ con ARCore instalado, sin requerir instalación de aplicaciones adicionales.
2. THE AR_Viewer SHALL funcionar en Safari en iOS 16+ con soporte WebXR activado, usando la implementación nativa de ARKit.
3. THE FormCraft SHALL servirse exclusivamente bajo HTTPS_Context, ya que WebXR requiere un origen seguro para acceder a la cámara y los sensores del dispositivo.
4. THE AR_Viewer SHALL detectar si el contexto no es HTTPS_Context y mostrar un aviso al usuario indicando que AR requiere conexión segura.
5. WHERE el dispositivo es de escritorio o no tiene cámara trasera, THE AR_Viewer SHALL ocultar el botón "Ver en tu espacio" y mostrar únicamente la vista 3D estándar.

---

### Requirement 8: Transición entre vista 3D estándar y vista AR

**User Story:** Como usuario, quiero pasar de la vista 3D del diseñador a la AR y volver sin perder el estado del diseño.

#### Acceptance Criteria

1. WHEN el usuario activa la sesión AR, THE AR_Viewer SHALL preservar el estado completo del Furniture_Model (parámetros, piezas, materiales) tal como estaba en el diseñador 3D.
2. WHEN el usuario sale de la sesión AR, THE AR_Viewer SHALL restaurar la vista 3D estándar con el mismo Furniture_Model y los mismos parámetros sin requerir recarga de página.
3. THE AR_Viewer SHALL completar la transición de vista 3D a AR en menos de 3 segundos desde que el usuario pulsa "Ver en tu espacio" hasta que la cámara AR es visible.
4. WHILE la WebXR_Session está activa, THE AR_Viewer SHALL suspender el bucle de renderizado estándar de Three.js para evitar conflictos con el bucle XR y reducir el consumo de batería.

---

### Requirement 9: Sistema Modular de Building Blocks (Snap y Colisión)

**User Story:** Como diseñador, quiero arrastrar piezas modulares al lienzo 3D y que se alineen automáticamente, para construir muebles de forma intuitiva sin introducir coordenadas manualmente.

#### Acceptance Criteria

1. THE Snap_Engine SHALL detectar cuando dos Building_Blocks están a menos de 20 mm entre sus caras de conexión y aplicar atracción automática alineando las caras.
2. WHEN el usuario suelta un Building_Block dentro del radio de snap, THE Snap_Engine SHALL posicionar el bloque en la posición de snap más cercana y emitir un feedback visual (resaltado de la cara de conexión).
3. THE Snap_Engine SHALL prevenir la superposición de Building_Blocks aplicando detección de colisión AABB (Axis-Aligned Bounding Box) durante el arrastre.
4. WHEN dos Building_Blocks se conectan mediante snap, THE Snap_Engine SHALL registrar la conexión en el grafo de ensamblaje del Furniture_Model para su uso en la validación estructural.
5. THE Snap_Engine SHALL soportar los tipos de Building_Block: panel lateral, estante horizontal, cajón y panel trasero.

---

### Requirement 10: Validación Estructural Backend (AWS Lambda)

**User Story:** Como carpintero, quiero recibir alertas si el diseño no es estructuralmente viable, para evitar fabricar muebles que no se sostengan.

#### Acceptance Criteria

1. WHEN el usuario finaliza el ensamblaje de un Furniture_Model, THE Structural_Validator SHALL enviar el grafo de ensamblaje a una función AWS Lambda mediante una petición HTTP POST con payload JSON.
2. WHEN el espacio libre entre dos apoyos horizontales supera el límite de pandeo del material seleccionado, THE Structural_Validator SHALL retornar una alerta con la identificación de las piezas afectadas y la distancia máxima recomendada.
3. THE Structural_Validator SHALL completar la validación y retornar la respuesta en menos de 5 segundos para diseños con hasta 50 Building_Blocks.
4. IF la función AWS Lambda no está disponible, THEN THE Structural_Validator SHALL ejecutar una validación simplificada en el cliente usando las reglas básicas de pandeo y notificar al usuario que la validación completa no está disponible.
5. THE Structural_Validator SHALL soportar los materiales: melamina 18 mm, MDF 18 mm, madera maciza 20 mm, con sus respectivos límites de pandeo configurados en la función Lambda.

---

### Requirement 11: Entornos Contextuales — Nivel A (Escenarios Predefinidos)

**User Story:** Como usuario, quiero ver mi mueble dentro de una habitación 3D predefinida, para evaluar cómo encaja estéticamente en un entorno real.

#### Acceptance Criteria

1. THE FormCraft SHALL ofrecer al menos 3 Scene_Preset: cocina básica, dormitorio minimalista y salón moderno.
2. WHEN el usuario selecciona un Scene_Preset, THE AR_Viewer SHALL cargar la escena Three.js correspondiente con iluminación preconfigurada y mostrar el Furniture_Model dentro del espacio en menos de 2 segundos.
3. WHILE un Scene_Preset está activo, THE AR_Viewer SHALL permitir al usuario mover y rotar el Furniture_Model dentro del espacio usando los controles de órbita existentes.
4. THE Scene_Preset SHALL implementarse usando geometría Three.js estática o CubeMap para las paredes, suelo y techo, sin requerir carga de assets externos en el MVP.

---

### Requirement 12: Entornos Contextuales — Nivel B (Configurador de Habitación)

**User Story:** Como carpintero, quiero definir las medidas exactas de la habitación del cliente y añadir obstáculos como ventanas y puertas, para diseñar el mueble in situ con precisión.

#### Acceptance Criteria

1. THE Room_Configurator SHALL permitir al usuario introducir las dimensiones de la habitación (largo, ancho, alto en mm) mediante campos de entrada numérica.
2. WHEN el usuario introduce las dimensiones, THE Room_Configurator SHALL generar y mostrar la habitación como una escena Three.js con paredes, suelo y techo en menos de 1 segundo.
3. THE Room_Configurator SHALL permitir añadir obstáculos de tipo ventana y puerta especificando su posición en la pared (pared norte/sur/este/oeste), altura desde el suelo y dimensiones.
4. WHEN se añade un obstáculo, THE Room_Configurator SHALL verificar que el Furniture_Model no colisiona con ningún obstáculo y mostrar una alerta visual si existe colisión.
5. THE Room_Configurator SHALL permitir exportar la configuración de la habitación como JSON para guardarla y recuperarla en sesiones posteriores.

---

## Notas de Implementación AR (Referencia para Diseño)

> Esta sección es informativa y no normativa. Los detalles de implementación se desarrollarán en el documento de diseño.

### Integración con Three.js existente

El proyecto ya usa `@react-three/fiber` y `three ^0.160.0`. La integración WebXR se realiza habilitando `renderer.xr.enabled = true` en el `WebGLRenderer` de Three.js, que tiene soporte nativo para WebXR desde la versión r118. El componente `Viewer3D.tsx` existente deberá extenderse o complementarse con un nuevo componente `AR_Viewer.tsx`.

### Flujo técnico resumido de la sesión AR

```
1. navigator.xr.isSessionSupported('immersive-ar')
2. navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'light-estimation', 'anchors'] })
3. renderer.xr.setSession(session)
4. session.requestReferenceSpace('viewer') → fuente hit-test
5. session.requestReferenceSpace('local-floor') → espacio de referencia principal
6. Bucle: session.requestAnimationFrame → hit-test → actualizar Reticle → render
7. Toque → createAnchor → instanciar Furniture_Model → actualizar pose por frame
8. session.end() → restaurar renderer estándar
```

### Compatibilidad de features WebXR por plataforma

| Feature | Chrome Android (ARCore) | Safari iOS 16+ |
|---|---|---|
| `immersive-ar` | ✅ | ✅ |
| `hit-test` | ✅ | ✅ |
| `dom-overlay` | ✅ | ⚠️ Parcial |
| `light-estimation` | ✅ | ✅ |
| `anchors` | ✅ | ✅ iOS 17+ |

### Consideraciones de rendimiento

- El Furniture_Model debe usar geometría instanciada (`InstancedMesh`) para muebles con muchas piezas repetidas.
- El renderer debe configurarse con `powerPreference: 'high-performance'` en móvil.
- La sesión AR debe liberar todos los recursos XR al finalizar para evitar fugas de memoria en dispositivos con RAM limitada.
