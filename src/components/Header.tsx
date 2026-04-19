import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { useLibrary } from '../lib/library';

export function Header() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const { entries } = useLibrary();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      nav(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      nav('/');
    }
  };

  const isLibrary = loc.pathname.startsWith('/biblioteca');
  const isFeed = !isLibrary;

  const isDetail = /^\/paper\//.test(loc.pathname);
  const variantClass = isDetail ? 'pv-header--narrow' : '';

  return (
    <header className={`pv-header ${variantClass}`.trim()}>
      <div className="pv-header-inner">
        <div className="brand" onClick={() => nav('/')} role="button" tabIndex={0}>
          <img src="/assets/logo-mark.svg" alt="" />
          <span className="wordmark">
            Paperverse<span className="dot">.</span>
          </span>
        </div>

        {}
        {!isDetail && (
          <form onSubmit={submit} className="search">
            <Icon name="search" size={15} />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscá un tema, autor o paper"
              aria-label="Buscar papers"
            />
          </form>
        )}

        <nav aria-label="Principal">
          <button
            type="button"
            onClick={() => {
              setQ('');
              nav('/');
            }}
            className={isFeed ? 'active' : ''}
          >
            Feed
          </button>
          <button
            type="button"
            onClick={() => nav('/biblioteca')}
            className={isLibrary ? 'active' : ''}
          >
            Biblioteca
            {entries.length > 0 && (
              <span className="count">{entries.length}</span>
            )}
          </button>
          {}
        </nav>
      </div>
    </header>
  );
}
