// Biblioteca — locally-saved + locally-read papers.
//
// Two tabs (, usuario): Guardados / Leídos. Guardados es la
// sección activa por default (lo que ella eligió conservar). Leídos es el
// historial completo de lectura — todo lo que se marcó como leído (sea
// porque abrió el detail, sea porque tocó el toggle), sirve como índice de
// memoria. Antes teníamos "Para leer" + "Archivo" como dos secciones
// apiladas; las tabs reemplazan ese layout por una vista más limpia que
// además se alinea con el cambio en Feed (los leídos se ocultan, así que
// la "Biblioteca > Leídos" pasa a ser donde usuario los recupera para
// desmarcarlos si necesita verlos de nuevo).
//
// No server / no auth — ambas listas vienen de localStorage. Por eso hay
// un callout arriba que lo hace explícito y ofrece el export JSON como
// backup.

import { useEffect, useRef, useState } from 'react';
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
  const { entries: readEntries } = useReadPapers();

  // Tab activo. 'saved' por default: cuando entrás a la biblioteca, lo que
  // querés ver primero es lo que decidiste guardar. La tab Leídos es el
  // historial — útil pero secundaria. Sin persistencia entre sesiones
  // intencional: cada visita arranca en Guardados para no esconder lo
  // accionable detrás de una preferencia vieja.
  const [activeTab, setActiveTab] = useState<'saved' | 'read'>('saved');

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

  // Listas por tab. Ambos stores ya vienen ordenados newest-first.
  // Nota: un paper puede aparecer en ambas tabs si el usuario lo guardó y
  // además lo leyó. Es correcto y deseable — cada tab muestra la lista
  // completa de su concepto, sin solapamientos ocultos que confundan.
  const saved = savedEntries;
  const read = readEntries;

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
  // Headline: muestra ambos contadores cuando hay de los dos, y se adapta
  // cuando solo hay uno. Mantiene el espíritu de la "tagline editorial"
  // que tenía la página antes.
  const headline =
    total === 0
      ? 'Nada guardado todavía.'
      : saved.length > 0 && read.length > 0
      ? `${saved.length} guardados · ${read.length} leídos`
      : saved.length > 0
      ? `${saved.length} ${saved.length === 1 ? 'guardado' : 'guardados'}.`
      : `${read.length} ${read.length === 1 ? 'leído' : 'leídos'}.`;

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
          {/* Tabs — Guardados / Leídos. Dos buckets independientes: un
              paper puede estar en ambas tabs si lo guardaste y lo leíste.
              Usamos role="tablist"/role="tab"/role="tabpanel" para que
              screen readers y teclado los entiendan como navegación
              tabular (flechas izq/der mueven el foco entre tabs sin tener
              que tabular por el resto del DOM). El estilo visual es el
              mismo idioma que el ViewToggle del feed — mismo 2px stroke,
              mono-uppercase label, sin transition (toggles snap). */}
          <div
            className="lib-tabs"
            role="tablist"
            aria-label="Secciones de la biblioteca"
            style={{ marginTop: 24 }}
            onKeyDown={e => {
              // Soporte teclado: ← y → navegan entre tabs. Estándar WAI-ARIA
              // para tablists horizontales. Sin esto, el usuario teclado
              // tendría que tabular dos veces para pasar del tab Guardados
              // al Leídos, lo cual rompe la expectativa de "tablist".
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              setActiveTab(t => (t === 'saved' ? 'read' : 'saved'));
            }}
          >
            <button
              type="button"
              role="tab"
              id="lib-tab-saved"
              aria-selected={activeTab === 'saved'}
              aria-controls="lib-panel-saved"
              tabIndex={activeTab === 'saved' ? 0 : -1}
              className={`lib-tab${activeTab === 'saved' ? ' active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              Guardados
              <span className="count">{saved.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="lib-tab-read"
              aria-selected={activeTab === 'read'}
              aria-controls="lib-panel-read"
              tabIndex={activeTab === 'read' ? 0 : -1}
              className={`lib-tab${activeTab === 'read' ? ' active' : ''}`}
              onClick={() => setActiveTab('read')}
            >
              Leídos
              <span className="count">{read.length}</span>
            </button>
          </div>

          {/* Panel Guardados */}
          {activeTab === 'saved' && (
            <section
              role="tabpanel"
              id="lib-panel-saved"
              aria-labelledby="lib-tab-saved"
            >
              {saved.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--fg-3)', fontSize: 14 }}>
                  Todavía no guardaste ningún paper. Desde el feed, tocá el ícono
                  de marcador en cualquier card para mandarlo a esta lista.
                </div>
              ) : (
                <div className="feed-list" style={{ marginTop: 16 }}>
                  {saved.map(entry => (
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

          {/* Panel Leídos — historial. Desde acá usuario puede desmarcar un
              paper (botón de leído en cada PaperCard) para que vuelva a
              aparecer en el feed. Ese es el "escape hatch" del feature de
              ocultar leídos: si ocultaste algo por error o querés revisitar,
              acá lo recuperás. */}
          {activeTab === 'read' && (
            <section
              role="tabpanel"
              id="lib-panel-read"
              aria-labelledby="lib-tab-read"
            >
              {read.length === 0 ? (
                <div style={{ padding: '20px 0', color: 'var(--fg-3)', fontSize: 14 }}>
                  Todavía no marcaste ningún paper como leído. Abrir un paper lo
                  marca automáticamente, o podés usar el check desde la card.
                </div>
              ) : (
                <div className="feed-list" style={{ marginTop: 16 }}>
                  {read.map(entry => (
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
