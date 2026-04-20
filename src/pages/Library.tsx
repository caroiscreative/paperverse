// Biblioteca — locally-saved + locally-read papers.
//
// Two sections, in this order:
// 1. "Para leer" — bookmarked papers the user hasn't marked as read.
// This is the active queue, shown first at full weight.
// 2. "Archivo · ya leídos" — anything the user marked as read (whether or
// not it was also bookmarked). Colapsado por defecto: usuario prefiere
// que el foco esté en lo que TIENE que leer, no en el historial. El
// archivo es un índice opt-in, no una lista permanente.
//
// No server / no auth — both lists come from localStorage. Por eso hay un
// callout arriba que lo hace explícito y ofrece el export JSON como backup.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary, importLibraryEntries } from '../lib/library';
import { useReadPapers, importReadEntries } from '../lib/read';
import { showToast } from '../lib/toast';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { PaperCard } from '../components/PaperCard';
import { Icon } from '../components/Icon';

export function Library() {
  const nav = useNavigate();
  // tab title "Biblioteca — Paperverse".
  useDocumentTitle('Biblioteca');
  const { entries: savedEntries } = useLibrary();
  const { entries: readEntries, has: readHas } = useReadPapers();

  // El archivo arranca cerrado — abrirlo es una decisión consciente del
  // usuario, no algo que tenga que esquivar al entrar a la biblioteca.
  const [archiveOpen, setArchiveOpen] = useState(false);

  // el callout de persistencia (localStorage) antes
  // estaba siempre abierto ocupando espacio vertical en la cabecera de la
  // biblioteca. se pidió hacerlo colapsable — el dato es importante
  // la primera vez, pero para el visitante recurrente se vuelve ruido.
  // Guardamos la preferencia en localStorage directamente (no vale la pena
  // un hook dedicado): si el usuario colapsa el aviso, queda colapsado para
  // sesiones futuras. La primera vez que abre la biblioteca lo ve expandido
  // por default — porque ese aviso es literalmente cómo protege su archivo.
  const PERSISTENCE_KEY = 'pv_lib_persistence_open_v1';
  const [persistenceOpen, setPersistenceOpen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(PERSISTENCE_KEY);
      // null => primera visita => lo mostramos expandido.
      // '0'/'1' => respetamos lo que el usuario eligió.
      if (raw === null) return true;
      return raw === '1';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PERSISTENCE_KEY, persistenceOpen ? '1' : '0');
    } catch {
      /* storage bloqueado (modo privado, quota) — ignoramos; peor caso el
         estado default vuelve a aplicar la próxima visita */
    }
  }, [persistenceOpen]);

  // "Para leer" = saved AND not yet marked as read.
  const toRead = useMemo(
    () => savedEntries.filter(e => !readHas(e.paper.id)),
    [savedEntries, readHas]
  );

  // "Archivo" = everything the user has read, newest first. The read store is
  // already sorted newest-first (useReadPapers prepends on mark).
  const archive = readEntries;

  const isEmpty = savedEntries.length === 0 && readEntries.length === 0;

  const exportJson = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      saved: savedEntries,
      read: readEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paperverse-biblioteca-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // el download dispara el save dialog pero no siempre queda
    // claro que la acción funcionó (ej. Safari en mobile abre el file en
    // otra pestaña sin mostrar nada). Toast explícito confirma la acción.
    showToast('Exportamos tu biblioteca', 'info');
  };

  // QA2 #68 : Importar JSON — complemento de Exportar JSON.
  // Permite mudar la biblioteca entre navegadores o recuperar un respaldo
  // cuando se borra el caché. El archivo esperado es el mismo shape que
  // produce `exportJson`: { version: 2, exportedAt, saved: [], read: [] }.
  //
  // Por qué un input file oculto + botón visible (en vez de un input file
  // nativo): el estilo del input nativo se rompe con nuestro sistema
  // tipográfico (Inter/mono) y varía entre navegadores. Con un <input hidden>
  // + label/button tomamos control visual total y el botón luce igual que
  // "Exportar JSON" — consistencia dentro del mismo header.
  //
  // El ref también nos permite resetear `value=""` después del import,
  // necesario porque si el usuario intenta re-importar el mismo archivo
  // sin este reset, el onChange no vuelve a disparar (mismo file, no hay
  // "change"). Detalle chico que salva soporte al "eh, no me funcionó,
  // voy a probar de nuevo".
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reseteamos el input antes que cualquier otra cosa — si falla la
    // validación, el usuario tiene que poder reintentar con el MISMO archivo.
    if (importInputRef.current) importInputRef.current.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      // Validación mínima: estructuras esperadas. No chequeamos `version`
      // estrictamente porque si en el futuro movemos a v3 todavía queremos
      // poder importar v2 — lo que importa es que `saved` y `read` sean
      // arrays; el filtrado por shape de cada entry lo hace el store.
      if (!payload || typeof payload !== 'object') {
        showToast('El archivo no tiene el formato esperado', 'error');
        return;
      }
      const saved = Array.isArray(payload.saved) ? payload.saved : [];
      const read = Array.isArray(payload.read) ? payload.read : [];
      if (saved.length === 0 && read.length === 0) {
        showToast('El archivo está vacío o no es un export de Paperverse', 'error');
        return;
      }

      const libResult = importLibraryEntries(saved);
      const readResult = importReadEntries(read);

      const totalAdded = libResult.added + readResult.added;
      const totalSkipped = libResult.skipped + readResult.skipped;

      if (totalAdded === 0 && totalSkipped > 0) {
        // Todo lo del archivo ya estaba en el store local — el usuario
        // reimportó el mismo JSON. No es error pero tampoco hay noticias
        // alegres que dar.
        showToast(`Nada nuevo · los ${totalSkipped} papers ya estaban`, 'info');
        return;
      }

      const parts: string[] = [];
      if (libResult.added > 0) {
        parts.push(`${libResult.added} en para leer`);
      }
      if (readResult.added > 0) {
        parts.push(`${readResult.added} en archivo`);
      }
      const headline = `Importamos ${totalAdded} ${totalAdded === 1 ? 'paper' : 'papers'}`;
      const detail = parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
      const skippedSuffix = totalSkipped > 0 ? ` (${totalSkipped} ya estaban)` : '';
      showToast(`${headline}${detail}${skippedSuffix}`, 'info');
    } catch {
      // JSON.parse explota con files que no son JSON — también cubrimos
      // errores de `file.text()` en navegadores exóticos.
      showToast('No pudimos leer el archivo. Tiene que ser un JSON de Paperverse', 'error');
    }
  };

  const triggerImport = () => {
    importInputRef.current?.click();
  };

  const total = savedEntries.length + readEntries.length;
  const headline =
    total === 0
      ? 'Nada guardado todavía.'
      : toRead.length > 0 && archive.length > 0
      ? `${toRead.length} para leer · ${archive.length} leídos`
      : toRead.length > 0
      ? `${toRead.length} para leer.`
      : `${archive.length} leídos.`;

  return (
    <div className="main-full">
      {/* `lib-header`: clase específica para que el CSS pueda apilar título
          y botón en mobile (usuario, "1 para leer · 6 leídos"
          y "Exportar JSON" tienen que ir cada uno en su propia línea — la
          fila horizontal hacía que el título "1 para leer" se quebrara feo
          al lado del botón). En desktop sigue siendo flex horizontal. */}
      <div className="section-head lib-header" style={{ marginTop: 0, alignItems: 'center' }}>
        <div>
          {/* esta es la página-título semántica y
              debe ser el <h1> de la vista. Visualmente queda idéntico
              al h2 mono-uppercase que tenía antes porque en index.css
              replicamos el estilo de `.section-head h2` sobre h1. El
              "headline" dinámico de abajo sigue siendo un <div>
              decorativo — es la frase cambiante y no debe funcionar
              como encabezado adicional para screen readers. */}
          <h1>Mi biblioteca</h1>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1.15, color: 'var(--pv-ink)', marginTop: 6 }}>
            {headline}
          </div>
        </div>
        {/* Acciones de data — Importar + Exportar. Importar se ofrece siempre
            (incluso con biblioteca vacía) porque ese es justamente el caso
            donde el usuario necesita importar: navegador nuevo, caché
            borrado, mudanza entre equipos. Exportar se oculta si no hay nada
            porque exportar un archivo vacío no tiene sentido y podría
            confundir ("¿esto significa que hay algo?"). */}
        <div className="lib-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={triggerImport}
            aria-label="Importar biblioteca desde archivo JSON"
          >
            <Icon name="arrow-right" size={14} />
            Importar JSON
          </button>
          {!isEmpty && (
            <button type="button" className="btn btn-secondary" onClick={exportJson}>
              <Icon name="share" size={14} />
              Exportar JSON
            </button>
          )}
          {/* Input file invisible — controlado por el botón de arriba vía
              ref. `hidden` evita que tome espacio en el layout. */}
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            hidden
          />
        </div>
      </div>

      {/* Callout de persistencia — se muestra siempre que haya contenido,
          porque es la información que evita que alguien pierda meses de
          papers sin saber que podía respaldarlos. Va pegado al section-head
          de arriba para que quien apunte al botón "Exportar JSON" vea el
          porqué justo al lado.

          ahora colapsable. En estado cerrado queda una
          línea compacta con el aviso clave + chevron — suficiente para
          recordar el dato sin robar espacio. El detalle (qué se pierde, cómo
          respaldarlo) aparece al expandir. La preferencia se persiste en
          localStorage, así que si el usuario lo cerró una vez no vuelve a
          abrirse solo. El chevron reusa el mismo gesto visual que el toggle
          del Archivo más abajo — Ley de Jakob aplicada dentro de la propia
          página. Importante: el contenido colapsado sigue siendo accesible
          (aria-expanded / aria-controls + role="note") así que screen readers
          lo encuentran sin depender del estado visual. */}
      {!isEmpty && (
        <div
          className={`lib-persistence${persistenceOpen ? ' open' : ''}`}
          role="note"
        >
          <button
            type="button"
            className="lib-persistence-toggle"
            onClick={() => setPersistenceOpen(v => !v)}
            aria-expanded={persistenceOpen}
            aria-controls="lib-persistence-detail"
          >
            <span className="chev" aria-hidden="true">
              <Icon name="arrow-right" size={11} />
            </span>
            <strong>Tu biblioteca vive en el caché de este navegador.</strong>
            <span className="toggle-label">
              {persistenceOpen ? 'Ocultar' : 'Ver más'}
            </span>
          </button>
          {persistenceOpen && (
            <p id="lib-persistence-detail" className="lib-persistence-detail">
              Si lo borrás (o cambiás de equipo), perdés lo guardado y lo
              marcado como leído. Si querés conservar el registro, con links
              directos a cada paper, descargá el JSON.
            </p>
          )}
        </div>
      )}

      {isEmpty ? (
        <div className="lib-empty">
          <div className="display" style={{ fontSize: 32 }}>
            Tu biblioteca vive en este navegador.
          </div>
          <div className="lead">
            Guardá papers con el ícono de marcador para leer más tarde, y marcalos como leídos con el
            check cuando termines. Todo queda acá, sin login, sin nube. Si ya tenés una biblioteca
            exportada de otro navegador, traéla con "Importar JSON" arriba.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => nav('/')}
          >
            Ir al feed <Icon name="arrow-right" size={14} />
          </button>
        </div>
      ) : (
        <>
          {/* Para leer — bookmarked + unread, the active queue. */}
          <section>
            <div className="section-head" style={{ marginTop: 24 }}>
              <h2>Para leer</h2>
              <span className="count">
                {toRead.length === 0
                  ? 'vacío por ahora'
                  : toRead.length === 1
                  ? '1 paper'
                  : `${toRead.length} papers`}
              </span>
            </div>
            {toRead.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--fg-3)', fontSize: 14 }}>
                No tenés nada pendiente. Guardá un paper desde el feed con el ícono de marcador.
              </div>
            ) : (
              <div className="feed-list" style={{ marginTop: 12 }}>
                {toRead.map(entry => (
                  <PaperCard
                    key={entry.paper.id}
                    paper={entry.paper}
                    onClick={() => nav(`/paper/${entry.paper.id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Archivo — historial de lectura. Colapsado por defecto: la
              lista de leídos es un índice de memoria, no parte activa de la
              cola. El toggle vive al lado del count para que quede claro
              que es la misma acción ("esta lista / ábrela"). */}
          {archive.length > 0 && (
            <section className="lib-archive">
              <div className="section-head" style={{ marginTop: 0 }}>
                <h2>Archivo · ya leídos</h2>
                <div className="head-right">
                  <span className="count">
                    {archive.length === 1 ? '1 paper' : `${archive.length} papers`}
                  </span>
                  <button
                    type="button"
                    className={`lib-archive-toggle${archiveOpen ? ' open' : ''}`}
                    onClick={() => setArchiveOpen(v => !v)}
                    aria-expanded={archiveOpen}
                    aria-controls="lib-archive-list"
                  >
                    <span className="chev">
                      <Icon name="arrow-right" size={11} />
                    </span>
                    {archiveOpen ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>
              {archiveOpen && (
                <div id="lib-archive-list" className="feed-list" style={{ marginTop: 12 }}>
                  {archive.map(entry => (
                    <PaperCard
                      key={entry.paper.id}
                      paper={entry.paper}
                      onClick={() => nav(`/paper/${entry.paper.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
