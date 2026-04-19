import type { Paper } from '../lib/openalex';
import { CountryFlag } from './CountryFlag';

interface Props {
  paper: Paper;
  size?: 'sm' | 'lg';
}

/** Country code → display name in Spanish. Falls back to the code itself. */
function countryName(code: string): string {
  const map: Record<string, string> = {
    AT: 'Austria',
    BE: 'Bélgica',
    BG: 'Bulgaria',
    CH: 'Suiza',
    CZ: 'Chequia',
    DE: 'Alemania',
    DK: 'Dinamarca',
    EE: 'Estonia',
    ES: 'España',
    FI: 'Finlandia',
    FR: 'Francia',
    GB: 'Reino Unido',
    GR: 'Grecia',
    HR: 'Croacia',
    HU: 'Hungría',
    IE: 'Irlanda',
    IS: 'Islandia',
    IT: 'Italia',
    LT: 'Lituania',
    LU: 'Luxemburgo',
    LV: 'Letonia',
    NL: 'Países Bajos',
    NO: 'Noruega',
    PL: 'Polonia',
    PT: 'Portugal',
    RO: 'Rumania',
    RS: 'Serbia',
    RU: 'Rusia',
    SE: 'Suecia',
    SI: 'Eslovenia',
    SK: 'Eslovaquia',
    UA: 'Ucrania',
    AR: 'Argentina',
    BO: 'Bolivia',
    BR: 'Brasil',
    CA: 'Canadá',
    CL: 'Chile',
    CO: 'Colombia',
    CR: 'Costa Rica',
    CU: 'Cuba',
    DO: 'República Dominicana',
    EC: 'Ecuador',
    GT: 'Guatemala',
    MX: 'México',
    PA: 'Panamá',
    PE: 'Perú',
    PR: 'Puerto Rico',
    PY: 'Paraguay',
    US: 'Estados Unidos',
    UY: 'Uruguay',
    VE: 'Venezuela',
    AU: 'Australia',
    BD: 'Bangladesh',
    CN: 'China',
    HK: 'Hong Kong',
    ID: 'Indonesia',
    IL: 'Israel',
    IN: 'India',
    IR: 'Irán',
    JP: 'Japón',
    KR: 'Corea del Sur',
    MY: 'Malasia',
    NZ: 'Nueva Zelanda',
    PH: 'Filipinas',
    PK: 'Pakistán',
    SA: 'Arabia Saudita',
    SG: 'Singapur',
    TH: 'Tailandia',
    TR: 'Turquía',
    TW: 'Taiwán',
    VN: 'Vietnam',
    AE: 'Emiratos Árabes Unidos',
    DZ: 'Argelia',
    EG: 'Egipto',
    ET: 'Etiopía',
    GH: 'Ghana',
    KE: 'Kenia',
    MA: 'Marruecos',
    NG: 'Nigeria',
    SN: 'Senegal',
    TN: 'Túnez',
    ZA: 'Sudáfrica',
  };
  return map[code] || (code ? code : 'País no indicado');
}

export function Byline({ paper, size = 'sm' }: Props) {
  return (
    <div className="byline" style={size === 'lg' ? { fontSize: 12 } : undefined}>
      <span className="k">Por</span>
      <span className="v">{paper.authorsLine}</span>
      <span className="k">Fuente</span>
      <span className="v muted">{paper.institution}</span>
      <span className="k">País</span>
      <span className="v where">
        <CountryFlag code={paper.countryCode} title={countryName(paper.countryCode)} />
        {countryName(paper.countryCode)}
      </span>
    </div>
  );
}
