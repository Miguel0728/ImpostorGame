# El Impostor → Google Play: plan de trabajo para Claude Code

Nov 2, 2026 · @Miguel

## Contexto y objetivo

El objetivo es publicar El Impostor en Google Play como app gratuita que genere ingresos pequeños pero constantes. Este plan lo divide en cinco fases que Claude Code puede ejecutar una a una.

El proyecto (`Miguel0728/ImpostorGame`, unas 3.700 líneas) es una app Flask con plantillas Jinja2 y JavaScript sin frameworks. Tiene dos modos: Pass & Play en un solo celular, con el estado en la sesión de Flask, y salas online con código de 4 letras, con el estado en la memoria del servidor y consulta cada segundo desde `sala.js`.

El camino elegido es convertirlo en PWA y empaquetarlo para Android con PWABuilder. El riesgo principal es que Google elimina las apps que son solo una vista web de un sitio ([política](https://android-developers.googleblog.com/2020/10/developer-tips-and-guides-common-policy.html?m=1)). Por eso la Fase 3, el modo sin conexión, es la más importante.

## Cómo usar este documento con Claude Code

Exporta este documento a Markdown, guárdalo en la raíz del repo como `PLAN_PLAYSTORE.md` y pide a Claude Code que trabaje una fase a la vez. Así puedes revisar y probar cada fase antes de seguir.

Prompt sugerido para empezar:

```text
Lee PLAN_PLAYSTORE.md completo. Trabaja solo la Fase 1.
Antes de editar, lee los archivos que menciona la fase.
Haz un commit pequeño por tarea. Al terminar, resume qué cambiaste
y cómo probarlo. No pases a la siguiente fase hasta que yo lo diga.
```

Reglas de trabajo para Claude Code:

- Lee antes de editar. La lógica del modo local (`app/routes/game.py` y las plantillas de `setup/`, `game/` y `voting/`) no se revisó a fondo al escribir este plan: verifícala.
- Mantén la estructura actual: rutas en `app/routes/`, lógica en `app/services/`, plantillas en `app/templates/` y recursos en `app/static/`, sin scripts ni estilos dentro del HTML.
- La interfaz sigue en español.
- No agregues dependencias nuevas si no hacen falta; si agregas una, dilo y explica por qué.

## Fase 1 — Seguridad y servidor

Antes de desplegar hay que cerrar seis puntos débiles del servidor, todos de cambio pequeño.

1. **Clave secreta.** En `app/__init__.py` (línea 8) la `SECRET_KEY` tiene un valor por defecto público en el repo. Debe leerse solo de la variable de entorno `SECRET_KEY`. Si falta en producción, la app no debe arrancar y debe mostrar un mensaje claro. En desarrollo puede usar una clave aleatoria temporal con un aviso.
2. **Cookies seguras.** En producción, configurar `SESSION_COOKIE_SECURE = True` y `SESSION_COOKIE_SAMESITE = "Lax"`.
3. **Tope de salas.** `ROOMS` en `app/services/room_service.py` no tiene límite, y `_purge_expired_rooms()` solo se ejecuta al crear una sala. Agregar `MAX_ROOMS` (sugerido: 500) y responder con un error amigable al llegar al tope. Los códigos tienen 4 letras de un alfabeto de 23 (unos 280.000 combinaciones), así que `_new_code()` entraría en un bucle infinito si se agotaran: ponerle un número máximo de intentos.
4. **Límite de creación.** Limitar a unas 5 salas nuevas por hora desde una misma IP o sesión, con un contador simple en memoria si no se quiere agregar una librería.
5. **Arranque en producción.** Un solo worker, porque las salas viven en memoria: `gunicorn run:app --workers 1 --threads 4`. Verificar que `gunicorn` esté en `requirements.txt` (el archivo no se revisó) y que `run.py` exponga `app`.
6. **Ruta de salud.** Agregar `/healthz`, que responda 200, para el hosting.

Los números sugeridos se pueden ajustar; lo importante es que existan los límites.

## Fase 2 — Identidad propia

La app debe diferenciarse de Among Us en nombre, vocabulario y arte antes de publicarse. Miguel cambia colores y arte; Claude Code revisa nombres y textos en el código.

- [ ] Elegir un nombre propio y distintivo, y comprobar en Play Store que no exista otro igual (Miguel).
- [ ] Cambiar el vocabulario de tripulación: "Tripulante N" (`generate_player_slots` y `get_player_names` en `app/services/game_service.py`), `role_title`, "VICTORIA DE LA TRIPULACIÓN" y textos parecidos en `app/static/js/sala.js` (`VERDICTS`), en `app/templates/` y en el README.
- [ ] Quitar el tema espacial de los textos (por ejemplo "Orbital Debate" en el README).
- [ ] Redefinir la paleta de 6 colores (`COLOR_COUNT = 6` y las clases de color en `app/static/css/base.css`) (Miguel).
- [ ] Reemplazar `app/static/img/favicon.svg` por un ícono propio y preparar los íconos de la Fase 4 (Miguel).
- [ ] Evitar personajes o siluetas de astronauta o de "crewmate" en cualquier ilustración.
- [ ] Actualizar el título en `app/templates/layout/base.html` y el nombre en el README.

## Fase 3 — Pass & Play sin conexión

Portar el modo local a JavaScript hace que el juego funcione sin internet y es la mayor diferencia frente a abrir la web, por eso es la fase que más ayuda a evitar el rechazo de Google. El modo online sigue en Flask.

Hoy el estado local vive en la sesión de Flask (`config`, `players`, `roles`, `secret_word`, `outcome`, `current_round`) y lo manejan `app/routes/game.py` y `app/services/game_service.py`. Las pantallas son `setup/configurar.html`, `setup/jugadores.html`, `game/roles.html`, `game/juego.html`, `voting/votacion.html` y `voting/resultado.html`.

Tareas:

1. Crear un módulo JS (nombre sugerido: `app/static/js/modo-local.js`) con la misma lógica de `game_service.py`: validar configuración, sortear palabra y roles, contar votos y avanzar de ronda.
2. Guardar el estado en `localStorage`, siempre dentro de `try/catch`, y hacer que la partida se pueda retomar si se cierra la app.
3. Servir las pantallas locales para que carguen sin servidor (HTML que el service worker de la Fase 4 deja en caché). Deben seguir viéndose igual.
4. Mover las palabras de cada categoría a un único archivo `app/static/data/palabras.json`, que usen tanto Flask como JS, para tener una sola fuente.
5. Verificar en `app/routes/game.py`, `votacion.html` y `juego.js` cómo se capturan los votos en local, y replicar ese comportamiento exacto.

Reglas que el código JS debe conservar:

| Regla | Valor |
| --- | --- |
| Jugadores | de 3 a 12 |
| Impostores | 1 hasta 5 jugadores; 2 desde 6; 3 desde 9 (`max_impostors_for`) |
| Rondas permitidas | 1, 2, 3 o 5 (se toma la más cercana) |
| Tiempo de debate | 0 (sin límite), 60, 90 o 120 segundos |
| Nombres | no vacíos, máximo 16 caracteres, sin repetir (sin distinguir mayúsculas) |
| Palabras propias | mínimo 3 distintas, separadas por comas, sin repetidas (sin distinguir mayúsculas) |
| Categorías | lugares, comida, objetos, profesiones y personalizada |
| Votación | gana quien tiene más votos; si hay empate en el primer lugar no hay mayoría y los impostores escapan |
| Veredicto | si se expulsa a un impostor pero quedan otros libres, solo pierde el expulsado |
| Siguiente ronda | nueva palabra y nuevos roles; tras la última ronda se vuelve al inicio |

Para comprobar la equivalencia, escribir pruebas sencillas (por ejemplo con Node) que cubran empate, impostor expulsado con otros libres, límites de jugadores y palabras propias repetidas.

## Fase 4 — PWA: manifest, service worker e íconos

La PWA necesita cuatro piezas: un manifest, un service worker, íconos y HTTPS (este último lo da el hosting en la Fase 5).

1. **Manifest.** Crear `app/static/manifest.webmanifest` con `name`, `short_name`, `start_url`, `scope` (`/`), `display` (`standalone`), `orientation` (`portrait`), `lang` (`es`), `background_color`, `theme_color` e íconos de 192 y 512 px más uno `maskable` de 512 px. Enlazarlo con `<link rel="manifest">` y agregar `<meta name="theme-color">` en `app/templates/layout/base.html`.
2. **Service worker.** Debe servirse desde la raíz del sitio para tener alcance completo: agregar en Flask la ruta `/service-worker.js` que entregue `app/static/js/service-worker.js` (con la cabecera `Service-Worker-Allowed: /` si hace falta). Registrarlo desde `base.html`.
3. **Qué guardar en caché.** Precargar CSS, JS, favicon, íconos, `palabras.json`, las pantallas del modo local y la página sin conexión. Usar primero la caché para los archivos estáticos y primero la red para el HTML. Nunca guardar en caché `/sala/<code>/estado` ni `/sala/<code>/accion`, porque son estado en vivo.
4. **Versión de caché.** Nombre de caché con número de versión y limpieza de versiones anteriores al activar el service worker.
5. **Página `/offline`.** Para cuando alguien abra una sala sin conexión: explicar que las salas online necesitan internet y ofrecer volver al Pass & Play.
6. **Íconos.** PNG de 192 y 512 px y uno maskable de 512 px en `app/static/img/icons/`, con el arte de Miguel.
7. **Comprobación.** En Chrome, DevTools → Application → Manifest debe mostrar la app como instalable, y con la red desactivada el Pass & Play debe cargar y jugarse completo.

## Fase 5 — Despliegue y paquete para Play Store

Esta fase pone el juego en internet y lo convierte en un paquete Android; la parte de código es pequeña y el resto son trámites de Miguel.

1. **Hosting.** Elegir un servicio para Python con HTTPS y un proceso siempre activo, y evitar planes gratuitos que se duermen. Definir ahí la variable `SECRET_KEY`. Conviene un dominio propio y estable: la app Android queda ligada a ese dominio y cambiarlo después da trabajo.
2. **Política de privacidad.** Crear la ruta `/privacidad`, en español, con una dirección pública para Play Console. Debe decir qué se guarda: nombres de jugadores de forma temporal, cookies de sesión y, en las salas online, el nombre en la memoria del servidor hasta 6 horas de inactividad (`ROOM_TTL_SECONDS`). No hay cuentas ni datos que se vendan. Incluir un contacto. Si más adelante se agregan anuncios o compras, hay que actualizarla.
3. **Paquete Android.** En [PWABuilder (pwabuilder.com)](https://blog.pwabuilder.com/posts/microsoft-and-google-team-up-to-make-pwas-better-in-the-play-store), pegar la URL del juego, elegir Android y generar el paquete. Decidir con cuidado el identificador del paquete (por ejemplo `com.tunombre.juego`): no se puede cambiar después de publicar.
4. **Clave de firma.** Guardar el archivo de la clave y su contraseña en al menos dos lugares distintos. Perderlos puede impedir actualizar la app.
5. **`assetlinks.json`.** Agregar en Flask la ruta `/.well-known/assetlinks.json`, que devuelva JSON con el identificador del paquete y la huella SHA-256 del certificado de firma (con Play App Signing, la que muestra Play Console en la sección de integridad de la app; confirmar en la documentación de Google). Sin este archivo la app muestra la barra del navegador ([guía](https://www.thinktecture.com/en/pwa/twa-bubblewrap)).
6. **Cuenta de Play Console.** Cuenta personal con pago único de US$25, verificación de identidad y de un dispositivo Android ([requisitos](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en-EN-2)).
7. **Prueba cerrada.** Subir el paquete a una prueba cerrada con al menos 12 testers inscritos de forma continua durante 14 días; después solicitar acceso a producción ([requisitos](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Conviene invitar a 15 o 20 personas por si alguien se sale.
8. **Ficha de la tienda.** Describirla como un juego, con capturas del juego y sin promocionar un sitio web. Completar el formulario de seguridad de los datos, la clasificación de contenido y el público objetivo.

## Checklist de publicación y riesgos

Antes de enviar la app a producción deben estar marcados estos puntos.

- [ ] `SECRET_KEY` definida en el hosting y sin valor por defecto en el código.
- [ ] Tope y límite de creación de salas funcionando.
- [ ] Nombre, textos y arte propios, sin referencias a Among Us.
- [ ] Pass & Play completo sin conexión.
- [ ] Política de privacidad pública en `/privacidad`.
- [ ] `assetlinks.json` accesible y sin barra del navegador en la app.
- [ ] Clave de firma respaldada en dos lugares.
- [ ] 15 o 20 testers invitados a la prueba cerrada.
- [ ] Ficha de la tienda redactada como juego, con capturas reales.

| Riesgo | Qué puede pasar | Qué hacer |
| --- | --- | --- |
| App marcada como vista web de un sitio | Google la rechaza o la retira | Fase 3 (sin conexión), ícono y pantalla propios, ficha como juego, mantenerla actualizada |
| Parecido con Among Us | Rechazo o reclamo | Fase 2 completa antes de publicar |
| Pérdida de la clave de firma | No se pueden publicar actualizaciones | Respaldo en dos lugares |
| Servidor caído o dormido | Las salas online no funcionan | Hosting siempre activo; el modo local no depende del servidor |
| Abuso al crear salas | Memoria llena y servidor lento | Tope y límite de la Fase 1 |
| Prueba cerrada se alarga | Retraso de semanas | Invitar a más de 12 testers |
| Costos | US$25 no reembolsables si falla la verificación, más hosting mensual | Verificar bien los datos antes de pagar |

Fuera de alcance por ahora: la monetización (por ejemplo packs de categorías de pago). Se decide después de publicar y de medir cuánta gente instala y vuelve a jugar; los anuncios nativos no están disponibles en un paquete TWA (ver la guía de Bubblewrap) y requerirían otro empaquetado.

## Criterios de aceptación por fase

Cada fase se da por terminada cuando se cumple lo siguiente.

| Fase | Debe cumplirse |
| --- | --- |
| 1. Seguridad y servidor | La app no arranca en producción sin `SECRET_KEY`; no se pueden crear más de `MAX_ROOMS` salas ni más de 5 por hora desde una misma IP; `/healthz` responde 200 |
| 2. Identidad propia | No quedan las palabras "tripulante" ni "tripulación" en código, plantillas ni README; nombre y favicon nuevos |
| 3. Sin conexión | Con el modo avión se puede jugar una partida completa de Pass & Play, con las mismas reglas de la tabla; las pruebas de equivalencia pasan |
| 4. PWA | Chrome la muestra como instalable; el service worker no guarda `/sala/<code>/estado` ni `/sala/<code>/accion`; `/offline` se muestra al abrir una sala sin red |
| 5. Despliegue y paquete | `/privacidad` y `/.well-known/assetlinks.json` responden en la URL pública; la app instalada se abre sin barra del navegador; la prueba cerrada está activa |

## Fuentes

- [Requisitos de prueba para cuentas personales nuevas (Google Play Console)](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Registro y verificación de cuenta de desarrollador (Google Play Console)](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en-EN-2)
- [Bubblewrap y Trusted Web Activity (Thinktecture)](https://www.thinktecture.com/en/pwa/twa-bubblewrap)
- [PWABuilder y Google Play (blog de PWABuilder)](https://blog.pwabuilder.com/posts/microsoft-and-google-team-up-to-make-pwas-better-in-the-play-store)
- [Developer tips and guides: common policy issues (Android Developers Blog, 2020)](https://android-developers.googleblog.com/2020/10/developer-tips-and-guides-common-policy.html?m=1)
