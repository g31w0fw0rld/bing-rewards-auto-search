# Bing Rewards Auto Search

Userscript that automates daily Bing searches to collect Microsoft Rewards points. / Userscript que automatiza búsquedas diarias en Bing para acumular puntos de Microsoft Rewards.

> [!WARNING]
> **USE AT YOUR OWN RISK / USO BAJO TU PROPIO RIESGO:** automating activity may violate the Microsoft Rewards terms and put your account at risk. / Automatizar la actividad puede infringir los términos de Microsoft Rewards y poner tu cuenta en riesgo.

<img src="docs/screenshot-search.png" width="330" alt="The search tab of the floating panel: the day complete at 60 of 60 points, with the start button still offered to search anyway and a line saying how long ago the Rewards data was read; below it the journey counter, the puzzle of stamps, the whole day's points from every source, the sentence Rewards writes about the streak bonus still to come, the days of streak protection left and the level with the points of its period; then one line per check-in partner with the days already earned of its seven-step streak and what the last step pays; and links to the other Rewards activities, to the Bing app, to the missions Outlook shows only inside itself and to the tasks Xbox runs on its own; at the bottom, the points balance converted to Xbox credit">

*Search tab: the day's progress in points as Rewards counts it, the controls for the current state, four grey lines of context — the whole day's points, the streak bonus, the protection left and your level —, the day's tasks with a link to each one pending, and what your points are worth. In this capture the day's loose offers are missing because they were all already done; when any is pending it appears above the notes as `→ ✱10 · <its title>`. / Pestaña de búsqueda: el progreso del día en puntos, tal como los cuenta Rewards, los controles según el estado, cuatro líneas grises de contexto —los puntos del día, la bonificación de racha, la protección que queda y tu nivel—, las tareas del día con enlace a cada una que falte, y cuánto valen tus puntos. En esta captura no salen las ofertas sueltas del día porque estaban todas hechas; cuando alguna está pendiente aparece encima de las notas como `→ ✱10 · <su título>`.*

<img src="docs/screenshot-keywords.png" width="330" alt="The keywords tab, with the keyword chips, the edit and reset buttons, the Use my Rewards progress checkbox and the manual search count">

*Keywords tab: every keyword as a chip you can click to delete, plus bulk edit and reset to defaults. Below, *Use my Rewards progress* — the switch that decides whether Rewards works out how many searches are left, or the manual count below it does. / Pestaña de palabras clave: cada palabra como una etiqueta que se borra con un clic, más edición masiva y restaurar predeterminadas. Debajo, *Usar mi progreso de Rewards* —el interruptor que decide si es Rewards quien calcula cuántas búsquedas faltan, o el número manual de abajo—.*

<img src="docs/screenshot-info.png" width="330" alt="The top of the info tab, with the script's own language selector set to Auto (browser)">

*Info tab: it opens with the script's own language selector, and below it — cropped out here — come what the script does, how it works, and the privacy terms, including exactly which request it makes to Bing and how to turn it off. / Pestaña de información: arranca con el selector de idioma del propio script y, debajo —fuera de la captura—, qué hace, cómo funciona y los términos de privacidad, incluida la petición exacta que hace a Bing y cómo desactivarla.*

## English

### What it does

**Searching**
- Runs your daily Bing searches automatically so you can collect the Microsoft Rewards search points without doing them one by one.
- **It works out how many are left, so you don't have to.** With *Use my Rewards progress* on, the script asks Bing how many search points you are still missing today, runs only those, and stops on its own once Rewards marks the day complete.
- **It does not trust its own arithmetic.** The "searches left" figure is an estimate: Rewards counts in points, not searches, and several markets do not credit the first searches of the day, so the estimate runs low. The decision to stop therefore comes from Rewards' own *complete* flag, never from the estimate.
- **Late crediting does not end the run.** If several searches in a row go by without the Rewards counter moving, it is almost always latency — the points arrive, just late. So the script waits half a minute, re-reads your progress without spending a search, and carries on until the day is complete, however many searches that takes. The panel says so while it waits, and ⏹ is always there if you would rather stop. Behind all of it there is an absolute daily cap, as a last resort.
- **The manual number is the fallback:** 1 to 100, set with the ⚙ button (20 by default). It takes over whenever there is no Rewards session, and it is the only thing that counts if you clear the checkbox.
- **Start, continue, stop and restart.** The controls change with the state: a paused run offers *continue* and *restart*; a finished one offers *restart* and *start* again — the way out for when Rewards says the day is done and you know it is not. Start on a finished day re-reads your progress first and then runs another batch of the manual size, counted from there, without touching the day's own count. It lapses at midnight on its own.
- **You can always see how old the number is.** Under the controls, a line says when your Rewards progress was read — «12 seconds ago». Reloading the page and pressing a button both re-read it, always, so a "day complete" left over from earlier can no longer lock the panel with no way out. That was what got phones stuck showing 60/60.
- **Progress survives reloads.** Each search is a real navigation, so the counter lives in storage rather than in the page — closing the tab or navigating away does not lose your place.
- **The counter resets on its own each day at midnight,** which is when Rewards resets too.
- **When the day is done it parks the tab on the Bing home page.** The last search would otherwise leave you sitting on a results page, and coming back to that tab days later — or a browser restoring the session, or a single press of Back — reloads it; Bing counts that as a search and it quietly eats the first one of the next day. Only when the day is actually complete: stop it yourself, or hit the safety cap, and the page stays where it was.

**The rest of the day, not just the searches**
- Under the controls the panel lists **what Rewards is asking of you today besides searching** — one line per check-in partner with the days it has already earned and what the last step pays (search with Bing, the daily set, the Bing app check-in, exploring with Edge, Outlook, MSN…), headed by your journey counter and by the puzzle of stamps with the bonus for completing it.
- **Each of those lines is a seven-step ladder, and the seventh pays the big one** — 120 points on Edge, 50 on the Bing app check-in, 100 on the other five. Across the seven partners that is 1203 points a week, and 670 of them, 56%, sit in the seventh steps alone. Completing one earns a stamp towards the puzzle, so a stamp that seems to be missing is usually a ladder still on its way, not a stamp lost. That is why the count and the prize come before the label: the end of the line is what gets clipped first.
- **The ladder about to close is painted gold with a 🎁.** Skipping that one day costs more than the six before it put together, and it is the only day of the seven where it matters when you get to it. Nothing is written on the line: the `6/7 ✱100` already there says it all.
- **Streaks you cannot advance from this account drop to the bottom of the list, in grey.** Microsoft offers them only to select members and in select markets, so on a given account some of the seven simply never move. They stay visible — they are points that exist — but they stop reading as something pending, and the ✓ they will never get is not held against you.
- **The day's other point offers are listed too**, the ones that are not part of the daily set — featured topics, the fixed offer of the day — each with what it pays and a link straight to it. They live in the Rewards dashboard under *more activities*, so they are easy to leave on the table; on 4 September 2026 that was 25 points sitting there unclaimed.
- **Four grey lines of context head the list.** The whole day's points from every source, not just searches — the panel used to say 60/60 with the day already at 147. The sentence Rewards itself writes about the streak bonus on its way ("3 days to go to unlock your 150-point bonus"), taken word for word so it arrives already translated and already counted. The days of streak protection you have left. And your level with the points of the period it uses to decide it.
- **The tooltip on the day's points says what the day is actually worth.** Searches plus the daily set — the very figure Rewards itself shows as *Points today*. The loose offers are left out because they are not daily: two of them are literally *monthly* topics, and on 5 September 2026 all 55 points of them were already complete while the day still paid only 60. The streak steps are left out too, and for a checked reason: that same day of nothing but searches paid 60, not 63, so a ladder's three points come out of the sixty rather than on top of them.
- At the bottom, **links to the three places this panel cannot read**. The Bing app has activities that only work there — on the Rewards site they show as *Locked*, and they were half the points of that section on 4 September 2026. Xbox runs its own daily, weekly and monthly tasks from the app or the console, and Outlook shows point missions inside itself that change from one day to the next. Nothing is claimed about how many or how much: the links just say where to look.
- **Each pending one is a link**, so it is one click away instead of a hunt through the dashboard. The daily set also opens out into its three activities, each with its own link. Open one while a run is going and the run stops itself, so it does not navigate you away before you have finished.
- The labels and their counts are **Bing's own**, taken from the same response, so a partner that only exists in your market shows up by itself — with the wording Rewards uses there.
- **A note closes the list**: the Rewards dashboard and the Bing app carry extra activities that change daily and are worth more points than these. The script does not do them for you; it points at where they live.

**What your points are worth**
- The panel shows your Rewards balance, what it converts to in Xbox / Microsoft Store credit, and the cheapest Xbox card together with how many points you still need for it.
- **The rate comes from Rewards, not from guesswork.** Where your market offers a variable-amount redemption, its official points-to-currency ratio is read straight from the catalogue. Only where that does not exist is the rate inferred from card prices, and the tooltip says as much.
- **Careful with the cheap cards:** within a single market the same card sells at different rates, and the small ones are the worst deal — in Mexico a MXN 20 card costs 57.25 points per peso while a MXN 100 one costs 48.95. That is why the cheapest card is used as the "you can redeem now" threshold and not as the exchange rate.

**How it avoids looking like a robot**
- **Queries are built, not repeated:** each one combines one to three of your keywords at random, so no two runs look alike.
- **It rotates search types** the way a person browses — 70% web, plus images, videos, shopping and news.
- **Delays are randomised between 3 and 10 seconds**, biased toward the middle of that range rather than uniform, and roughly one search in five gets a long 10–25 second "reading pause" instead.
- **Each URL carries rotated parameters** (`form`, `cvid`, `PC`) of the kind Bing sets on its own searches, and the script detects mobile versus desktop to send the right ones.

**Keywords**
- The default list ships with about 35 everyday terms and phrases; it is yours to change.
- **Click a chip to delete it**, use **+** to add — several at once, separated by commas — or **edit all** as one comma-separated line.
- **Reset to default** puts the original list back.

**Panel**
- Three tabs — search, keywords, info — in a floating panel you can **collapse**, and it remembers whether you left it open.
- **Script language selector** in the info tab: 22 languages plus *Auto*. On *Auto* it follows the language you are viewing Bing in — Bing does declare that on the page — and falls back to your browser's language if the page does not say. Pick one from the list to pin it; changing it reloads the page.

**Language:** whichever you are viewing Bing in, your browser's as a fallback, or whichever you pin in the info tab.

**Install:**
1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/) (open source, Chrome/Edge/Firefox) or [Tampermonkey](https://www.tampermonkey.net/). On Chrome and Edge, also turn on **Allow user scripts** on the extension's own page in `chrome://extensions` — without it nothing runs.
2. Open the installer: [bing-rewards-auto-search.user.js](https://github.com/g31w0fw0rld/bing-rewards-auto-search/raw/main/bing-rewards-auto-search.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Site:** `bing.com`

## Español

### Qué hace

**Búsquedas**
- Ejecuta tus búsquedas diarias en Bing automáticamente, para juntar los puntos de búsqueda de Microsoft Rewards sin hacerlas una por una.
- **Calcula cuántas faltan, para que no tengas que hacerlo tú.** Con *Usar mi progreso de Rewards* activado, el script le pregunta a Bing cuántos puntos de búsqueda te faltan hoy, ejecuta solo esos y se detiene solo en cuanto Rewards marca el día como completo.
- **No se fía de su propia cuenta.** El número de «búsquedas restantes» es un estimado: Rewards cuenta en puntos, no en búsquedas, y en varios mercados las primeras del día no acreditan, así que el estimado se queda corto. Por eso la decisión de parar la toma la marca *complete* de Rewards, nunca el estimado.
- **Que acrediten tarde no acaba la corrida.** Si pasan varias búsquedas seguidas sin que suba el contador de Rewards, casi siempre es latencia: los puntos llegan, solo que tarde. Así que el script espera medio minuto, vuelve a leer tu progreso sin gastar una búsqueda y sigue hasta completar el día, le lleve las búsquedas que le lleve. El panel lo dice mientras espera, y ⏹ está ahí siempre que prefieras cortar. Detrás de todo eso hay además un tope diario absoluto, como último recurso.
- **El número manual es el suplente:** de 1 a 100, con el botón ⚙ (20 por defecto). Toma el mando siempre que no haya sesión de Rewards, y es lo único que cuenta si desmarcas la casilla.
- **Iniciar, continuar, detener y reiniciar.** Los controles cambian según el estado: una corrida en pausa ofrece *continuar* y *reiniciar*; una terminada ofrece *reiniciar* e *iniciar* otra vez — la salida para cuando Rewards dice que el día está hecho y tú sabes que no. Iniciar sobre un día terminado relee primero tu progreso y luego hace otra tanda del tamaño manual, contada desde ahí y sin tocar el conteo del día. Caduca solo a medianoche.
- **Siempre se ve de cuándo es el número.** Bajo los controles, una línea dice cuándo se leyó tu progreso de Rewards: «hace 12 segundos». Recargar la página y pulsar un botón lo releen siempre, así que un «día completo» heredado ya no puede dejar el panel encerrado sin salida. Eso era lo que dejaba los móviles clavados en 60/60.
- **El progreso sobrevive a las recargas.** Cada búsqueda es una navegación real, así que el contador vive en el almacenamiento y no en la página — cerrar la pestaña o irte a otro sitio no pierde tu avance.
- **El contador se reinicia solo cada día a medianoche,** que es cuando Rewards también se reinicia.
- **Al terminar el día aparca la pestaña en la portada de Bing.** Si no, la última búsqueda te deja parado en unos resultados, y volver a esa pestaña días después —o que el navegador restaure la sesión, o un solo Atrás— la recarga; para Bing eso es una búsqueda, y se come la primera del día siguiente sin decir nada. Solo cuando el día está completo de verdad: si lo paras tú, o si salta el tope de seguridad, la página se queda donde estaba.

**El resto del día, no solo las búsquedas**
- Debajo de los controles el panel lista **lo que Rewards te pide hoy aparte de buscar**: una línea por cada socio del check-in con los días que ya lleva ganados y lo que paga el último (buscar con Bing, el conjunto diario, el registro en la app de Bing, explorar con Edge, Outlook, MSN…), encabezadas por el contador de tu jornada y por el puzle de sellos con lo que da completarlo.
- **Cada una de esas líneas es una escalera de siete pasos, y el séptimo da el premio gordo**: 120 puntos en Edge, 50 en el registro de la app de Bing y 100 en los otros cinco. Entre los siete socios son 1203 puntos por semana, y 670 de ellos —el 56%— están solo en los séptimos pasos. Completar una gana un sello del puzle, así que un sello que parece faltar suele ser una escalera a medio recorrer y no un sello perdido. Por eso el recuento y el premio van delante de la etiqueta: el final de la línea es lo primero que se recorta.
- **La escalera que está a punto de cerrarse se pinta en dorado y con un 🎁.** Saltarse ese día cuesta más que los seis anteriores juntos, y es el único de los siete en el que importa cuándo le llegues. En la línea no se escribe nada: el `6/7 ✱100` que ya está ahí lo dice solo.
- **Las rachas que no se pueden avanzar desde esta cuenta caen al final de la lista, en gris.** Microsoft las ofrece solo a determinados miembros y en determinados mercados, así que en una cuenta dada hay algunas de las siete que simplemente no se mueven. Siguen a la vista —son puntos que existen— pero dejan de leerse como algo pendiente, y el ✓ que nunca van a tener no se te reprocha.
- **También se listan las otras ofertas de puntos del día**, las que no van en el conjunto diario —temas destacados, la oferta fija del día—, cada una con lo que paga y un enlace directo. Viven en el panel de Rewards, bajo *más actividades*, así que es fácil dejárselas: el 4 de septiembre de 2026 eran 25 puntos ahí parados sin cobrar.
- **Encabezan la lista cuatro líneas grises de contexto.** Los puntos del día enteros, de todas las fuentes y no solo de las búsquedas —el panel llegaba a decir 60/60 con el día ya en 147—. La frase que la propia Rewards escribe sobre la bonificación de racha que viene («Faltan 3 días para desbloquear tu bonificación de 150 puntos»), copiada tal cual, así que llega ya traducida y ya calculada. Los días de protección de racha que te quedan. Y tu nivel con los puntos del periodo con el que Rewards lo decide.
- **El aviso de los puntos del día dice lo que el día vale de verdad.** Búsquedas más conjunto diario: exactamente la cifra que la propia Rewards enseña como *Puntos de hoy*. Las ofertas sueltas quedan fuera porque no son diarias —dos se llaman literalmente temas *mensuales*, y el 5 de septiembre de 2026 sus 55 puntos estaban ya completos mientras el día seguía pagando 60—. Los pasos de las escaleras también, y por una razón comprobada: ese mismo día, solo con búsquedas, pagó 60 y no 63, así que los tres puntos de una escalera salen de dentro de los sesenta y no encima.
- Al final, **enlaces a los tres sitios que este panel no puede leer**. La app de Bing tiene actividades que solo funcionan ahí —en la web de Rewards salen como *Bloqueada*, y el 4 de septiembre de 2026 eran la mitad de los puntos de esa sección—. Xbox tiene sus propias diarias, semanales y mensuales desde la app o la consola, y Outlook enseña dentro de sí mismo misiones de puntos que cambian de un día a otro. No se afirma cuántas son ni cuánto pagan: los enlaces solo dicen dónde mirar.
- **Cada cosa pendiente es un enlace**, así que queda a un clic en vez de a una expedición por el panel de Rewards. El conjunto diario además se despliega en sus tres actividades, cada una con su enlace. Si abres una con una corrida en marcha, la corrida se detiene sola, para no sacarte de la página antes de que la termines.
- Las etiquetas y sus recuentos **los pone Bing**, sacados de la misma respuesta, así que un socio que solo exista en tu mercado aparece solo — y con las palabras que Rewards usa ahí.
- **Cierra la lista una nota**: en el panel de Rewards y en la app de Bing hay actividades extra que cambian a diario y valen más puntos que estas. El script no las hace por ti; señala dónde están.

**Cuánto valen tus puntos**
- El panel muestra tu saldo de Rewards, en cuánto se convierte en saldo Xbox / Microsoft Store, y la tarjeta Xbox más barata junto con los puntos que te faltan para ella.
- **La tasa la da Rewards, no una suposición.** Donde tu mercado ofrece canje de importe variable, su tasa oficial de puntos a moneda se lee directamente del catálogo. Solo donde eso no existe la tasa se deduce del precio de las tarjetas, y el tooltip lo dice.
- **Ojo con las tarjetas baratas:** dentro de un mismo mercado la misma tarjeta se vende a tasas distintas, y las pequeñas son el peor negocio — en México una tarjeta de MXN 20 sale a 57,25 puntos por peso y una de MXN 100 a 48,95. Por eso la tarjeta más barata se usa como umbral de «ya puedes canjear» y no como tipo de cambio.

**Cómo evita parecer un robot**
- **Las consultas se construyen, no se repiten:** cada una combina al azar entre una y tres de tus palabras clave, así que no hay dos corridas iguales.
- **Rota los tipos de búsqueda** como navegaría una persona — 70% web, más imágenes, vídeos, compras y noticias.
- **Los retrasos son aleatorios entre 3 y 10 segundos**, sesgados hacia el centro de ese rango en vez de uniformes, y aproximadamente una de cada cinco búsquedas recibe en su lugar una "pausa de lectura" larga de 10 a 25 segundos.
- **Cada URL lleva parámetros rotados** (`form`, `cvid`, `PC`) del tipo que Bing pone en sus propias búsquedas, y el script detecta móvil o escritorio para enviar los correctos.

**Palabras clave**
- La lista por defecto trae unos 35 términos y frases cotidianas; es tuya para cambiarla.
- **Haz clic en una etiqueta para borrarla**, usa **+** para añadir —varias de golpe, separadas por comas— o **edítalas todas** como una sola línea separada por comas.
- **Restaurar predeterminadas** devuelve la lista original.

**Panel**
- Tres pestañas —búsqueda, palabras clave, información— en un panel flotante que puedes **plegar**, y recuerda si lo dejaste abierto.
- **Selector de idioma del script** en la pestaña de información: 22 idiomas más *Auto*. Con *Auto* sigue el idioma en que estés viendo Bing —Bing sí lo declara en la página— y cae al del navegador si la página no lo dijera. Elige uno de la lista para fijarlo; al cambiarlo se recarga la página.

**Idioma:** el que estés viendo en Bing, el del navegador como respaldo, o el que fijes en la pestaña de información.

**Instalación:**
1. Instala un gestor de userscripts: [Violentmonkey](https://violentmonkey.github.io/) (código abierto, Chrome/Edge/Firefox) o [Tampermonkey](https://www.tampermonkey.net/). En Chrome y Edge, activa además **Allow user scripts** en la página de la propia extensión en `chrome://extensions`; sin eso no se ejecuta nada.
2. Abre el instalador: [bing-rewards-auto-search.user.js](https://github.com/g31w0fw0rld/bing-rewards-auto-search/raw/main/bing-rewards-auto-search.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitio:** `bing.com`

## Privacy / Privacidad

**EN:** the script makes no requests to servers outside `bing.com`, and none at all to third parties or to the author. With *Use my Rewards progress* on, it sends one `GET` to `bing.com/rewards/panelflyout/getuserinfo` — the very endpoint that feeds the points panel in Bing's own header — to read your progress for the day, the tasks it lists (streak, check-in partners, daily set), your balance and the redemption catalogue. That request is same-origin and rides your existing Bing session, which is why the script needs neither `GM_xmlhttpRequest` nor `@connect`. Clear the checkbox and it makes no network requests of its own: to search it changes the URL within `bing.com`, exactly as if you typed the query yourself. It stores in the userscript manager's storage (`GM_setValue`, in your browser) only your keywords, the manual search total, the daily counter and date, the last reading of your Rewards progress, whether the panel is collapsed, and your language preference. It does not read your Microsoft account or your history. Note that the searches appear in your Bing / Microsoft Rewards history like any normal search.

**ES:** el script no hace peticiones a servidores fuera de `bing.com`, y ninguna en absoluto a terceros ni al autor. Con *Usar mi progreso de Rewards* activado, envía un `GET` a `bing.com/rewards/panelflyout/getuserinfo` —el mismo endpoint que alimenta el panel de puntos de la propia cabecera de Bing— para leer tu progreso del día, las tareas que lista (racha, socios del check-in, conjunto diario), tu saldo y el catálogo de canje. Esa petición es del mismo origen y viaja con tu sesión de Bing ya abierta, y por eso el script no necesita ni `GM_xmlhttpRequest` ni `@connect`. Si desmarcas la casilla, no hace ninguna petición de red propia: para buscar cambia la URL dentro de `bing.com`, igual que si escribieras la consulta a mano. Guarda en el almacenamiento del gestor de userscripts (`GM_setValue`, en tu navegador) solo tus palabras clave, el total manual de búsquedas, el contador y la fecha del día, la última lectura de tu progreso de Rewards, si el panel está plegado y tu preferencia de idioma. No lee tu cuenta de Microsoft ni tu historial. Ten en cuenta que las búsquedas quedan en tu historial de Bing / Microsoft Rewards como cualquier búsqueda normal.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
