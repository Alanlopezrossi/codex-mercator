# data/

Datos que se versionan en el repo porque no salen de la API oficial.

| Archivo | Contenido | Fuente y licencia |
|---|---|---|
| `wiki-data.json` | Recetas de la Forja Mística, vendedores, contenedores y recolección (2.897 ítems) | Guild Wars 2 Wiki (copia archivada en web.archive.org, mayo 2026). **GNU Free Documentation License 1.2**. Se muestra con atribución y enlace a la página original. |
| `event-timers.json` | Horarios de jefes de mundo y metaeventos | Guild Wars 2 Wiki, `Widget:Event timer/data.json`. **GNU FDL 1.2**. |
| `event-names-es.json` | Traducciones al español de los nombres de eventos | Propias. |

El contenido del juego (nombres, descripciones) es © ArenaNet, LLC y se usa según los
[Content Terms of Use](https://www.guildwars2.com/en/legal/guild-wars-2-content-terms-of-use/).

Para actualizar `wiki-data.json` cuando la wiki vuelva, reemplazá el archivo manteniendo el mismo formato
(`items[id] = { title, forge?, sold?, cont?, gath? }`).
