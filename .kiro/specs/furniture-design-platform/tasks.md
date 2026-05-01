# Implementation Plan: Furniture Design Platform

## Overview

Evolución de FormCraft desde un configurador paramétrico de estanterías hacia una plataforma completa de diseño modular de muebles con Building Blocks, entornos contextuales (Scene Presets, Room Configurator, AR WebXR) y validación estructural serverless en AWS Lambda.

La implementación sigue un orden de dependencias: primero los tipos y modelos base, luego los módulos de dominio (SnapEngine, AssemblyGraph, StructuralValidator, nesting, CutList), después los componentes de UI (ScenePresets, RoomConfigurator, ARViewer) y finalmente la integración en `Index.tsx` y `Viewer3D.tsx`.

## Tasks

- [x] 1. Definir tipos y modelos de datos base
  - Crear `src/lib/types.ts` con las interfaces: `BuildingBlock`, `BlockType`, `EdgeBandingConfig`, `EdgeBandingFace`, `FaceName`, `ConnectionEdge`, `AABB`, `AssemblyGraph`, `AssemblyGraphPayload`, `FurnitureModel`, `MaterialType`, `MaterialSpec`, `CutListItem`, `EdgeBandingCorrection`, `NestingConfig`, `RoomDimensions`, `WallSide`, `RoomObstacle`, `RoomConfiguration`, `RoomConfigurationExport`, `ScenePreset`, `PresetId`, `ValidationResult`, `ValidationAlert`, `SpanValidationResult`, `LambdaRequest`, `LambdaResponse`
  - Exportar la constante `MATERIAL_SPECS` con los límites de pandeo para `melamine-18` (800 mm), `mdf-18` (700 mm) y `solid-wood-20` (1000 mm)
  - Exportar `DEFAULT_NESTING_CONFIG` con `sawKerfMm: 3.2` y la primera hoja estándar
  - Exportar la función pura `blockToAABB(block: BuildingBlock): AABB`
  - Exportar los colores de validación `VALIDATION_COLORS`
  - _Requirements: 9.1, 9.3, 9.4, 10.2, 10.5, 12.1_

- [ ] 2. Implementar SnapEngine
  - [x] 2.1 Crear `src/lib/snap/snapEngine.ts` con `computeSnap`, `checkAABBCollision` y `registerConnection`
    - `computeSnap` detecta si la distancia mínima entre caras de conexión es < `SNAP_THRESHOLD_MM` (20 mm) y retorna `SnapResult` con `targetPosition` y `highlightFace`
    - `checkAABBCollision` usa `blockToAABB` para detectar intersección de volumen > 0 entre dos bloques
    - `registerConnection` añade un `ConnectionEdge` al `AssemblyGraph` sin duplicados
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 2.2 Añadir `getChildren` y `propagateMovement` a `snapEngine.ts`
    - `getChildren(blockId, blocks)` retorna todos los bloques con `parentId === blockId`
    - `propagateMovement(parentId, delta, blocks)` aplica el delta de posición al padre y a todos sus descendientes de forma recursiva; retorna el array de bloques actualizado
    - **Rendimiento**: `propagateMovement` es una función pura que opera sobre el array de bloques fuera del ciclo de renderizado de Three.js. Durante el drag-and-drop, el resultado se almacena en un ref mutable (`useRef`) y se aplica al estado React solo al soltar el bloque (`onDragEnd`), evitando re-renders en cada frame. Si se detecta lag con > 30 piezas, migrar el estado de bloques a **Zustand** para actualizaciones fuera del ciclo de React sin causar re-renders innecesarios.
    - La jerarquía se establece automáticamente cuando un bloque hace snap a un `side-panel` (el `side-panel` pasa a ser `parentId`)
    - _Requirements: 9.1, 9.2_

  - [x] 2.3 Escribir test de propiedad P7: Snap triggers iff distance < 20 mm
    - **Property 7: Snap triggers if and only if distance < 20 mm**
    - **Validates: Requirements 9.1**
    - Usar `fc.record({ posA, posB, sizeA, sizeB })` con `fc.float`; verificar que `computeSnap` retorna `snapped: true` si y solo si la distancia mínima entre caras es < 20 mm
    - _Archivo: `src/test/snapEngine.test.ts`_

  - [x] 2.4 Escribir test de propiedad P8: Snap positions block at nearest valid snap point
    - **Property 8: Snap positions block at nearest valid snap point**
    - **Validates: Requirements 9.2**
    - Verificar que `targetPosition` es la posición de snap más cercana (alineación cara a cara), no una posición intermedia

  - [x] 2.5 Escribir test de propiedad P9: AABB collision prevents block overlap
    - **Property 9: AABB collision prevents block overlap**
    - **Validates: Requirements 9.3**
    - Usar `fc.array(fc.record({ block }), { minLength: 2 })`; verificar que tras cualquier secuencia de drag-and-drop ningún par de bloques tiene AABB con volumen de intersección > 0

  - [x] 2.6 Escribir test de propiedad P17: Parent movement propagates to all children
    - **Property 17: Parent movement propagates to all children**
    - **Validates: Punto 4 — Jerarquía Padre-Hijo**
    - Usar `fc.record({ parent: blockArb, children: fc.array(blockArb, { minLength: 1 }), delta: vec3Arb })`; verificar que cada hijo se desplaza exactamente el mismo delta que el padre

- [ ] 3. Implementar AssemblyGraph
  - [x] 3.1 Crear `src/lib/snap/assemblyGraph.ts` con la estructura `AssemblyGraph` (Map de nodos + array de aristas) y las funciones `addNode`, `removeNode`, `addEdge`, `removeEdge`, `serialize` (produce `AssemblyGraphPayload`) y `deserialize`
    - `removeNode` debe ser atómico: eliminar el nodo del Map **y** filtrar del array de aristas todas las `ConnectionEdge` donde `fromBlockId === id` o `toBlockId === id` en una sola operación, antes de retornar el nuevo grafo. Nunca debe quedar una arista huérfana apuntando a un ID inexistente, ya que el `StructuralValidator` fallaría al recorrer el grafo.
    - `serialize` incluye `sawKerfMm` del `NestingConfig` activo en el payload
    - `deserialize` reconstruye el `AssemblyGraph` desde un `AssemblyGraphPayload`
    - _Requirements: 9.4, 10.1_

  - [x] 3.2 Escribir test de propiedad P10: Snap connections are recorded in assembly graph
    - **Property 10: Snap connections are recorded in assembly graph**
    - **Validates: Requirements 9.4**
    - Usar `fc.record({ blockA, blockB, faceA, faceB })`; verificar que tras `registerConnection` el grafo contiene exactamente una arista con los IDs y caras correctos

- [x] 4. Checkpoint — Verificar módulos de snap y grafo
  - Asegurarse de que todos los tests pasan con `npm test`. Consultar al usuario si surgen dudas sobre el comportamiento esperado del snap o la jerarquía.

- [ ] 5. Implementar StructuralValidator
  - [x] 5.1 Crear `src/lib/validation/structuralValidator.ts` con `validate` (asíncrono, llama a Lambda vía HTTP POST) y `validateSpanLocally` (síncrono, sin llamada a red)
    - `validate` envía `LambdaRequest` a la URL de Lambda, parsea `LambdaResponse` y retorna `ValidationResult` con `source: 'lambda'`; en caso de error (timeout, 5xx, respuesta malformada) ejecuta la lógica de fallback cliente y retorna `source: 'client-fallback'`
    - `validateSpanLocally` calcula el span libre entre el bloque y sus vecinos horizontales, compara con `MATERIAL_SPECS[material].maxSpanMm`, retorna `SpanValidationResult` y actualiza `block.visualValidationStatus`; si `spanMm <= 0` retorna `status: 'ok'`; si vecinos vacíos retorna `status: 'ok'` con `spanMm: 0`
    - Aplicar colores `VALIDATION_COLORS` al `MeshStandardMaterial` del bloque Three.js según el status
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 5.2 Escribir test de propiedad P11: Structural validator alerts when span exceeds material limit
    - **Property 11: Structural validator alerts when span exceeds material limit**
    - **Validates: Requirements 10.2, 10.5**
    - Usar `fc.record({ span: fc.nat(), material: fc.constantFrom('melamine-18', 'mdf-18', 'solid-wood-20') })`; verificar que se genera alerta si y solo si `span > maxSpanMm` para el material

  - [x] 5.3 Escribir test de propiedad P18: Local span validation status matches span vs. limit
    - **Property 18: Local span validation status matches span vs. limit**
    - **Validates: Punto 5 — Feedback Visual Preventivo**
    - Usar `fc.record({ block: blockArb, neighbors: fc.array(blockArb), material: materialArb })`; verificar que `status === 'ok'` iff `span <= maxSpanMm` y que `visualValidationStatus` del bloque se actualiza al valor retornado

- [ ] 6. Actualizar `nesting.ts` con `sawKerfMm` y `grainDirection`
  - [x] 6.1 Modificar `src/lib/nesting.ts` para aceptar `NestingConfig` en lugar de `SheetSize` directamente
    - Reemplazar la constante `KERF = 4` por `nestingConfig.sawKerfMm` en el cálculo de espaciado entre piezas
    - Si `sawKerfMm <= 0`, usar el valor por defecto `3.2` y loguear advertencia
    - Añadir lógica de `grainDirection`: si `grainDirection !== 'none'`, la pieza NO puede rotarse 90° durante la optimización; si no cabe sin rotar, marcarla como `unplaceable: true` y excluirla del layout
    - _Requirements: 9.1 (nesting), Punto 2 — Saw Kerf, Punto 3 — Sentido de Veta_

  - [x] 6.2 Escribir test de propiedad P15: Nesting spacing always includes saw kerf
    - **Property 15: Nesting spacing always includes saw kerf**
    - **Validates: Punto 2 — Saw Kerf**
    - Usar `fc.record({ items: fc.array(cutItemArb), sawKerfMm: fc.float({ min: 0.1, max: 10 }) })`; verificar que para cada par de piezas adyacentes en la misma placa el gap es >= `sawKerfMm`

  - [x] 6.3 Escribir test de propiedad P16: Grain direction constraint is respected in nesting
    - **Property 16: Grain direction constraint is respected in nesting**
    - **Validates: Punto 3 — Sentido de Veta**
    - Usar `fc.record({ block: blockWithGrainArb, sheet: sheetArb })`; verificar que la pieza colocada mantiene su orientación original (width y height no intercambiados)

- [ ] 7. Implementar `generateCutList` con compensación de tapacanto
  - [x] 7.1 Crear `src/lib/cutList.ts` con la función `generateCutList(blocks: BuildingBlock[], nestingConfig: NestingConfig): CutListItem[]`
    - Para cada bloque, calcular `cutLengthMm` y `cutWidthMm` restando las correcciones de tapacanto por cara (`EdgeBandingCorrection[]`)
    - `nominalLengthMm` y `nominalWidthMm` permanecen sin modificar — el `Viewer3D` siempre renderiza con las dimensiones nominales; el descuento de tapacanto solo existe en `CutListItem` y en el payload enviado a Lambda o a la sierra de corte
    - Si `edgeBanding.thicknessMm > dimensión nominal`, retornar error de validación y no generar el `CutListItem`
    - _Requirements: Punto 1 — Compensación de Tapacantos_

  - [x] 7.2 Escribir test de propiedad P14: Edge banding compensation reduces cut dimensions correctly
    - **Property 14: Edge banding compensation reduces cut dimensions correctly**
    - **Validates: Punto 1 — Compensación de Tapacantos**
    - Usar `fc.record({ block: buildingBlockArb, edgeBanding: edgeBandingArb })`; verificar que `cutLengthMm === nominalLengthMm - sum(corrections affecting length)` y `cutWidthMm === nominalWidthMm - sum(corrections affecting width)`

- [x] 8. Checkpoint — Verificar módulos de dominio
  - Asegurarse de que todos los tests pasan con `npm test`. Consultar al usuario si surgen dudas sobre las reglas de tapacanto o saw kerf.

- [x] 9. Implementar ScenePresets
  - Crear `src/lib/scene/scenePresets.ts` con la constante `SCENE_PRESETS` que define los 3 presets requeridos: `kitchen` (Cocina básica), `bedroom` (Dormitorio minimalista) y `living-room` (Salón moderno)
  - Cada preset incluye: `id`, `labelEs`, `ambientIntensity`, `directionalIntensity`, `directionalPosition`, `wallColor`, `floorColor` y `roomDimensions`
  - La geometría de cada preset se construye con primitivas Three.js estáticas (BoxGeometry para paredes, suelo y techo); sin carga de assets externos
  - Exportar la función `buildPresetScene(presetId: PresetId): THREE.Group` que retorna el grupo Three.js listo para añadir a la escena
  - _Requirements: 11.1, 11.2, 11.4_

- [ ] 10. Implementar RoomConfigurator
  - [x] 10.1 Crear `src/components/RoomConfigurator.tsx` con campos de entrada numérica para dimensiones (largo, ancho, alto en mm) y generación de la escena Three.js con paredes, suelo y techo en < 1 segundo
    - Validar que las dimensiones sean > 0; mostrar error en el campo si no
    - _Requirements: 12.1, 12.2_

  - [x] 10.2 Añadir gestión de obstáculos (ventana/puerta) al `RoomConfigurator`
    - Formulario para añadir obstáculos: tipo, pared (norte/sur/este/oeste), altura desde el suelo, dimensiones y offset desde la izquierda
    - Validar que el obstáculo no excede los límites de la pared seleccionada
    - Detectar colisión AABB entre el `FurnitureModel` y cada obstáculo; mostrar alerta visual si existe colisión
    - _Requirements: 12.3, 12.4_

  - [x] 10.3 Añadir exportación e importación JSON al `RoomConfigurator`
    - Botón "Exportar configuración" que descarga `RoomConfigurationExport` (versión `'1.0'`, `createdAt` ISO 8601, dimensiones, obstáculos y snapshot del mueble)
    - Botón "Importar configuración" que parsea el JSON y restaura el estado; mostrar error si el JSON es malformado sin modificar el estado actual
    - _Requirements: 12.5_

  - [x] 10.4 Escribir test de propiedad P12: Room obstacle collision detection is correct
    - **Property 12: Room obstacle collision detection is correct**
    - **Validates: Requirements 12.4**
    - Usar `fc.record({ furnitureAABB, obstacles: fc.array(obstacleArb) })`; verificar que la función retorna `true` iff el AABB del mueble intersecta con algún AABB de obstáculo

  - [x] 10.5 Escribir test de propiedad P13: Room configuration JSON round-trip
    - **Property 13: Room configuration JSON round-trip**
    - **Validates: Requirements 12.5**
    - Usar `fc.record({ dimensions: dimensionsArb, obstacles: fc.array(obstacleArb) })`; verificar que exportar a JSON y parsear produce una configuración profundamente igual a la original

- [x] 11. Implementar HitTestService
  - Crear `src/lib/ar/hitTestService.ts` con la interfaz `HitTestService` y su implementación
  - `initialize(session, viewerSpace)` solicita la fuente de hit-test con `session.requestHitTestSource({ space: viewerSpace })`; si la feature `hit-test` no está disponible, loguear advertencia y no lanzar excepción
  - `getClosestHit(frame)` evalúa `frame.getHitTestResults(hitTestSource)` y retorna el resultado más cercano al centro de pantalla, o `null` si no hay resultados
  - `dispose()` cancela la fuente de hit-test activa
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [ ] 12. Implementar ARViewer
  - [x] 12.1 Crear `src/components/ARViewer.tsx` con detección de soporte WebXR y botón "Ver en tu espacio"
    - Al montar el componente, llamar `navigator.xr?.isSessionSupported('immersive-ar')` de forma asíncrona sin bloquear el render
    - Si `navigator.xr` no existe: mostrar mensaje con sugerencia de Chrome Android / Safari iOS 16+
    - Si `isSessionSupported` → `false`: mostrar mensaje y ofrecer vista 3D estándar
    - Si el contexto no es HTTPS (y no es localhost): mostrar aviso "AR requiere conexión segura (HTTPS)"
    - En escritorio o sin cámara trasera: ocultar el botón y mostrar solo la vista 3D
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.3, 7.4, 7.5_

  - [x] 12.2 Implementar inicio y gestión del ciclo de vida de la sesión WebXR
    - Al pulsar "Ver en tu espacio": `navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'light-estimation', 'anchors'] })`
    - Configurar `renderer.xr.enabled = true`, `renderer.setClearColor(0x000000, 0)` (`alpha: true`) y `renderer.xr.setSession(session)`
    - Ejecutar el bucle de renderizado con `session.requestAnimationFrame`; suspender el bucle estándar de Three.js mientras la sesión esté activa
    - Escuchar el evento `sessionend` para restaurar el renderer estándar y preservar el estado del diseño
    - Si el usuario deniega el permiso de cámara (`NotAllowedError`): capturar el error, mostrar mensaje explicativo y retornar a vista 3D sin excepción no controlada
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.1, 8.2, 8.3, 8.4_

  - [x] 12.3 Implementar Reticle y colocación del FurnitureModel con Anchor
    - Integrar `HitTestService` en el bucle XR: actualizar posición del Reticle (anillo plano semitransparente de 0.3 m de diámetro) con la pose del hit más cercano a >= 30 fps
    - Si no hay superficie detectada: ocultar Reticle y mostrar "Apunta al suelo o a una mesa" en el DOM Overlay
    - Al tocar la pantalla con Reticle visible: crear Anchor con `hitTestResult.createAnchor()` (o `session.createAnchor()`) e instanciar el `FurnitureModel` en la pose del Anchor con escala `dimensions * 0.001`
    - En cada frame: actualizar la pose del `FurnitureModel` con `frame.getAnchorPose(anchor, referenceSpace)`
    - Si `createAnchor` no disponible: mantener posición relativa al espacio de referencia local y notificar al usuario
    - Al tocar con modelo ya colocado: eliminar Anchor anterior, crear nuevo Anchor en la nueva posición del Reticle
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.5, 4.6, 5.1, 5.2, 5.3_

  - [x] 12.4 Implementar DOM Overlay y estimación de luz
    - Panel DOM Overlay en la parte inferior de la pantalla con botones táctiles (mínimo 44 × 44 px): "Salir de AR", "Rotar izquierda" (−15°), "Rotar derecha" (+15°) y "Recolocar"
    - Mostrar dimensiones del mueble en cm (W/10 × H/10 × D/10) mientras la sesión está activa
    - Mostrar "Toca para colocar el mueble" si el modelo no está colocado aún
    - "Recolocar": eliminar Anchor actual y volver al estado de búsqueda de superficie
    - Usar `XRLightEstimate` si está disponible para ajustar luz ambiental e intensidad direccional; si no, usar valores por defecto (ambiental 0.6, direccional 0.8)
    - _Requirements: 4.4, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 12.5 Escribir test de propiedad P1: Reticle tracks closest hit-test surface
    - **Property 1: Reticle tracks closest hit-test surface**
    - **Validates: Requirements 3.2**
    - Usar `fc.array(fc.record({ position: vec3Arb, orientation: quatArb }), { minLength: 1 })`; verificar que la posición del Reticle tras procesar cada frame es igual a la pose del hit más cercano retornado por `getClosestHit`

  - [x] 12.6 Escribir test de propiedad P2: Furniture model placed at anchor pose with correct scale
    - **Property 2: Furniture model placed at anchor pose with correct scale**
    - **Validates: Requirements 4.2, 5.2**
    - Usar `fc.record({ pose: positionArb, dimensions: { w: fc.nat({ max: 3000 }), h: fc.nat({ max: 3000 }), d: fc.nat({ max: 1000 }) } })`; verificar que la posición Three.js coincide con la pose del Anchor y la escala es `dimensions * 0.001`

  - [x] 12.7 Escribir test de propiedad P3: Furniture model tracks anchor pose each frame
    - **Property 3: Furniture model tracks anchor pose each frame**
    - **Validates: Requirements 4.3**
    - Usar `fc.array(fc.record({ pose: positionArb }), { minLength: 1 })`; verificar que el transform del modelo coincide con `frame.getAnchorPose` en cada frame

  - [x] 12.8 Escribir test de propiedad P4: Model repositioning moves to new reticle position
    - **Property 4: Model repositioning moves to new reticle position**
    - **Validates: Requirements 4.5**
    - Usar `fc.record({ oldPos: vec3Arb, newPos: vec3Arb })`; verificar que el modelo queda en `newPos`, el Anchor anterior se elimina y se crea uno nuevo

  - [x] 12.9 Escribir test de propiedad P5: AR session preserves furniture state (round-trip)
    - **Property 5: AR session preserves furniture state (round-trip)**
    - **Validates: Requirements 8.1, 8.2**
    - Usar `fc.record({ params: shelfParamsArb, blocks: fc.array(blockArb), material: materialArb })`; verificar que el estado del mueble tras entrar y salir de AR es profundamente igual al original

  - [x] 12.10 Escribir test de propiedad P6: DOM Overlay displays correct furniture dimensions
    - **Property 6: DOM Overlay displays correct furniture dimensions**
    - **Validates: Requirements 6.3**
    - Usar `fc.record({ w: fc.nat({ max: 5000 }), h: fc.nat({ max: 5000 }), d: fc.nat({ max: 2000 }) })`; verificar que el DOM Overlay muestra `W/10 × H/10 × D/10 cm`

- [x] 13. Checkpoint — Verificar módulos AR y entornos contextuales
  - Asegurarse de que todos los tests pasan con `npm test`. Consultar al usuario si surgen dudas sobre el comportamiento del ciclo de vida WebXR o los fallbacks.

- [x] 14. Implementar función AWS Lambda para validación estructural
  - Crear `lambda/structural-validator/index.js` (Node.js) con el handler que recibe `LambdaRequest`, evalúa el grafo de ensamblaje aplicando las reglas de pandeo por material (`melamine-18`: 800 mm, `mdf-18`: 700 mm, `solid-wood-20`: 1000 mm) y retorna `LambdaResponse`
  - Crear `lambda/structural-validator/package.json` con las dependencias mínimas necesarias
  - La función debe completar la validación en < 5 segundos para diseños con hasta 50 Building Blocks
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [ ] 15. Integrar todos los módulos en `Index.tsx` y `Viewer3D.tsx`
  - [x] 15.1 Actualizar `src/pages/Index.tsx` para gestionar el estado `FurnitureModel` (modo `'parametric'` | `'blocks'`, `blocks`, `assemblyGraph`, `selectedMaterial`) y añadir tabs o secciones para Scene Presets, Room Configurator y AR Viewer
    - Conectar `SnapEngine` al canvas de Building Blocks: eventos de drag-and-drop, snap visual, propagación de movimiento padre-hijo
    - Conectar `StructuralValidator`: llamar a `validateSpanLocally` durante el arrastre y a `validate` al soltar el bloque
    - Conectar `generateCutList` para que la lista de corte refleje las compensaciones de tapacanto
    - Conectar `nestPieces` con `NestingConfig` (incluyendo `sawKerfMm` y `grainDirection`)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.4, 11.1, 11.2, 11.3, 12.1_

  - [x] 15.2 Actualizar `src/components/Viewer3D.tsx` para soportar el modo Building Blocks
    - Renderizar `BuildingBlock[]` además de `Piece[]` existentes
    - Aplicar `VALIDATION_COLORS` al `MeshStandardMaterial` de cada bloque según `visualValidationStatus`
    - Integrar `ScenePresets`: cuando hay un preset activo, añadir el grupo de geometría estática a la escena
    - Integrar `RoomConfigurator`: cuando hay una configuración de habitación activa, renderizar paredes, suelo, techo y obstáculos
    - _Requirements: 10.2, 11.2, 11.3, 12.2, 12.4_

- [x] 16. Checkpoint final — Verificar integración completa
  - Asegurarse de que todos los tests pasan con `npm test` y que el build de producción compila sin errores con `npm run build`. Consultar al usuario si surgen dudas antes de cerrar el feature.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints garantizan validación incremental antes de avanzar a la siguiente fase
- Los tests de propiedad (P1–P18) usan **fast-check** + **Vitest** con `numRuns: 100`; instalar con `npm install --save-dev fast-check` antes de ejecutarlos
- La función Lambda se desarrolla en Node.js y se despliega de forma independiente; el cliente usa la URL de invocación como variable de entorno (`VITE_LAMBDA_URL`)
- El factor de conversión mm → m es `0.001` en todo el código Three.js
