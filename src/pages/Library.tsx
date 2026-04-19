import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { PaperCard } from '../components/PaperCard';
import { Icon } from '../components/Icon';

export function Library() {
  const nav = useNavigate();
  const { entries: savedEntries } = useLibrary();
  const { entries: readEntries, has: readHas } = useReadPapers();

  const toRead = useMemo(
    () => savedEntries.filter(e => !readHas(e.paper.id)),
    [savedEntries, readHas]
  );

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
      <div className="section-head" style={{ marginTop: 0, alignItems: 'center' }}>
        <div>
          <h2>Mi biblioteca</h2>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1.15, color: 'var(--pv-ink)', marginTop: 6 }}>
            {headline}
          </div>
        </div>
        {!isEmpty && (
          <button type="button" className="btn btn-secondary" onClick={exportJson}>
            <Icon name="share" size={14} />
            Exportar JSON
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="lib-empty">
          <div className="display" style={{ fontSize: 32 }}>
            Tu biblioteca vive en este navegador.
          </div>
          <div className="lead">
            Guardá papers con el ícono de marcador para leer más tarde, y marcalos como leídos con el
            check cuando termines. Todo queda acá, sin login, sin nube. Si querés mudar tu biblioteca,
            usá "Exportar JSON".
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
          {}
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

          {}
          {archive.length > 0 && (
            <section className="lib-archive">
              <div className="section-head" style={{ marginTop: 0 }}>
                <h2>Archivo · ya leídos</h2>
                <span className="count">
                  {archive.length === 1 ? '1 paper' : `${archive.length} papers`}
                </span>
              </div>
              <div className="feed-list" style={{ marginTop: 12 }}>
                {archive.map(entry => (
                  <PaperCard
                    key={entry.paper.id}
                    paper={entry.paper}
                    onClick={() => nav(`/paper/${entry.paper.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
