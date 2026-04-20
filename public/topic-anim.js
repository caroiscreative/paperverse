/* ==========================================================================
   Paperverse · Topic Animations · Mount helpers
   Injects a topic-specific animated SVG into a container element.

   Usage: window.mountTopicAnim(el, topicId, variant)
     - el: container with position: relative (or absolute)
     - topicId: one of 'espacio', 'clima', 'neuro', 'ia', 'biologia', 'fisica', 'medicina'
     - variant: 'desktop' (16:10) or 'mobile' (9:16)
   ========================================================================== */
(function () {
  const TOPIC_COLORS = {
    ia: { color: '#2E4BE0', deep: '#1E34B0', soft: '#E0E6FF' },
    clima: { color: '#1BA5B8', deep: '#0F7E8E', soft: '#CDEEF2' },
    neuro: { color: '#8B4FE0', deep: '#6A2FC0', soft: '#E8DCF9' },
    espacio: { color: '#F5B638', deep: '#C48A1A', soft: '#FDEEC8' },
    biologia: { color: '#2E8B57', deep: '#1F6B3F', soft: '#D6EEDE' },
    fisica: { color: '#F2542D', deep: '#C73F1D', soft: '#FDE4DA' },
    medicina: { color: '#E03E8C', deep: '#B32168', soft: '#FADCEA' },
    energia: { color: '#E8572C', deep: '#B8401A', soft: '#FBE0D3' },
    materiales: { color: '#0E1116', deep: '#2A2F38', soft: '#DADCE0' },
    matematica: { color: '#3D6AE0', deep: '#254AB0', soft: '#D9E3FB' },
    psicologia: { color: '#A35FD8', deep: '#7A3FB8', soft: '#ECDCF9' },
    ecologia: { color: '#4FA068', deep: '#2F7040', soft: '#DFEEDF' },
    tecnologia: { color: '#D89A2C', deep: '#A87818', soft: '#F6E7C7' },
    quimica: { color: '#E06AA8', deep: '#B34378', soft: '#F9DCE8' },
    // Ciencia : 15º tema agregado como fallback para papers que no
    // caen en los 14 específicos. Paleta slate neutral para que no compita
    // cromáticamente con los otros temas — el banner de ciencia se reconoce
    // por su animación (paper llenándose + sello aprobado), no por el color.
    ciencia: { color: '#5B6472', deep: '#3F4752', soft: '#E3E6EB' },
  };

  // Viewbox picker — svg inside .ta-stage stretches to cover.
  function viewBox(variant) {
    return variant === 'mobile' ? '0 0 180 320' : '0 0 320 200';
  }

  // Helper: choose two anchor points based on variant for centered motifs.
  function centerFor(variant) {
    return variant === 'mobile' ? { cx: 90, cy: 160, r: 58 } : { cx: 160, cy: 100, r: 58 };
  }

  // Espacio — planet + orbit + satellite + stars
  function renderEspacio(variant) {
    const c = TOPIC_COLORS.espacio;
    const { cx, cy, r } = centerFor(variant);
    const mobile = variant === 'mobile';
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g fill="${c.deep}" opacity="0.65">
          <circle class="ta-twinkle" cx="${mobile?30:40}" cy="${mobile?40:30}" r="1.4"/>
          <circle class="ta-twinkle d1" cx="${mobile?150:280}" cy="${mobile?60:40}" r="1.2"/>
          <circle class="ta-twinkle d2" cx="${mobile?160:60}" cy="${mobile?260:170}" r="1.4"/>
          <circle class="ta-twinkle d3" cx="${mobile?40:240}" cy="${mobile?280:170}" r="1.1"/>
          <circle class="ta-twinkle d4" cx="${mobile?90:160}" cy="${mobile?30:20}" r="1.1"/>
        </g>
        <!-- Slow outer orbit -->
        <g class="ta-orbit" style="transform-origin:${cx}px ${cy}px; animation-duration:14s;">
          <ellipse cx="${cx}" cy="${cy}" rx="${r+22}" ry="${r+6}" fill="none" stroke="${c.deep}" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.55" transform="rotate(-14 ${cx} ${cy})"/>
          <circle cx="${cx+r+22}" cy="${cy}" r="3.6" fill="${c.deep}"/>
        </g>
        <!-- Faster inner orbit (moonlet) -->
        <g class="ta-orbit" style="transform-origin:${cx}px ${cy}px; animation-duration:6s; animation-direction: reverse;">
          <circle cx="${cx}" cy="${cy-r-6}" r="2.6" fill="${c.deep}"/>
        </g>
        <!-- Planet -->
        <g class="ta-float" style="transform-origin:${cx}px ${cy}px;">
          <circle cx="${cx}" cy="${cy}" r="${r*0.55}" fill="${c.color}"/>
          <path d="M ${cx-r*0.48} ${cy} Q ${cx} ${cy-r*0.25} ${cx+r*0.48} ${cy} Q ${cx} ${cy+r*0.25} ${cx-r*0.48} ${cy} Z" fill="${c.deep}" opacity="0.25"/>
          <circle cx="${cx-r*0.18}" cy="${cy-r*0.18}" r="${r*0.07}" fill="${c.deep}" opacity="0.35"/>
          <circle cx="${cx+r*0.22}" cy="${cy+r*0.08}" r="${r*0.05}" fill="${c.deep}" opacity="0.25"/>
        </g>
      </svg>`;
  }

  // Clima — sun + clouds + rain
  function renderClima(variant) {
    const c = TOPIC_COLORS.clima;
    const mobile = variant === 'mobile';
    const sun = mobile ? { cx: 58, cy: 90, r: 28 } : { cx: 90, cy: 80, r: 26 };
    const cloud = mobile ? { x: 100, y: 130 } : { x: 180, y: 90 };
    // Lluvia DIRECTAMENTE debajo de la nube (antes caía en x=170..242 mientras
    // la nube estaba en x=130 — parecía lluvia de la nada en la derecha).
    // Con drop animation (-18 a +36 en Y) las gotas aparecen justo en el
    // borde inferior de la nube y caen ~54px.
    const rainY = cloud.y + (mobile ? 26 : 26);
    const dropXs = mobile
      ? [ cloud.x - 24, cloud.x - 8, cloud.x + 8, cloud.x + 24 ]
      : [ cloud.x - 30, cloud.x - 10, cloud.x + 10, cloud.x + 30 ];
    const dropDelays = ['', 'd1', 'd2', 'd3'];
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Sun rays -->
        <g class="ta-spin-slow" style="transform-origin:${sun.cx}px ${sun.cy}px;" stroke="${'#F5B638'}" stroke-width="2" stroke-linecap="round">
          ${[0,45,90,135,180,225,270,315].map(a => {
            const rad = a*Math.PI/180;
            const x1 = sun.cx + Math.cos(rad)*(sun.r+6);
            const y1 = sun.cy + Math.sin(rad)*(sun.r+6);
            const x2 = sun.cx + Math.cos(rad)*(sun.r+14);
            const y2 = sun.cy + Math.sin(rad)*(sun.r+14);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
          }).join('')}
        </g>
        <circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="#F5B638"/>
        <!-- Nube (drift). Antes tenía una elipse c.deep abajo que se leía como
             una sombra oscura rara (feedback de QA). Ahora es una nube
             sólida con 4 lóbulos del mismo color + base plana, sin manchón
             oscuro. El contorno sutil va en c.deep, finito, sólo como delineado. -->
        <g class="ta-drift">
          <g transform="translate(${cloud.x} ${cloud.y})">
            <!-- base -->
            <rect x="-28" y="-2" width="56" height="12" rx="6" fill="${c.color}"/>
            <!-- lóbulos superiores -->
            <circle cx="-16" cy="-2" r="12" fill="${c.color}"/>
            <circle cx="0" cy="-10" r="14" fill="${c.color}"/>
            <circle cx="16" cy="-4" r="11" fill="${c.color}"/>
            <!-- highlight sutil -->
            <ellipse cx="-6" cy="-12" rx="6" ry="3" fill="#FFFFFF" opacity="0.25"/>
          </g>
        </g>
        <!-- Lluvia directamente bajo la nube -->
        <g fill="${c.deep}">
          ${dropXs.map((x,i) => `<ellipse class="ta-drop ${dropDelays[i]}" cx="${x}" cy="${rainY}" rx="1.6" ry="4"/>`).join('')}
        </g>
      </svg>`;
  }

  // Neuro — sinapsis (bulbos pre/post + neurotransmisores cruzando el cleft)
  // Rework: cambiar la animación para
  // hacer referencia a la sinapsis real — dos bulbos (pre y post) con las
  // vesículas liberando pelotitas químicas verdes que flotan hasta la otra
  // base. Antes eran 3 neuronas con impulsos viajando por axones; ahora el
  // foco es el corto espacio entre dos terminales, que es el motif más
  // icónico de la neurociencia en libros de texto.
  //
  // Elementos narrativos:
  // - Pre-synaptic bulb (izq desktop / arriba mobile): bulbo morado con
  // 3 vesículas verdes adentro (cada vesícula = círculo hueco con ~7
  // puntos verdes representando neurotransmisor acumulado).
  // - Canales de calcio rojos (media luna) en el borde del bulbo que da
  // al cleft — los Ca²⁺ channels son los que disparan la liberación.
  // - Post-synaptic bulb (der / abajo): mismo bulbo morado con T-shapes
  // (receptores) en el borde que da al cleft.
  // - Partículas verdes de neurotransmisor cruzando el cleft — 10
  // circulitos con delays escalonados que salen del pre y llegan al
  // post con fade in/out. Escala desde 0.4→1→0.5 para simular "aparece,
  // flota, se une y se absorbe".
  //
  // Paleta narrativa: los colores de neurotransmisor (#6BC946 verde) y
  // canales de Ca²⁺ (#E74C3C rojo) NO salen del TOPIC_COLORS.neuro porque
  // son "semánticos" — un sinapsis siempre se dibuja así en el libro,
  // independiente del tema. El morado sí viene del tema.
  function renderNeuro(variant) {
    const c = TOPIC_COLORS.neuro;
    const mobile = variant === 'mobile';

    const NT = '#6BC946'; // neurotransmisor (verde)
    const NT_dark = '#4A9A2F'; // borde/contorno vesicle + partículas
    const CHAN = '#E74C3C'; // canal de calcio (rojo media luna)

    // Posición de los dos bulbos. Desktop side-by-side, mobile stacked.
    const pre = mobile
      ? { cx: 90, cy: 85, rx: 55, ry: 42 }
      : { cx: 80, cy: 100, rx: 52, ry: 48 };
    const post = mobile
      ? { cx: 90, cy: 235, rx: 55, ry: 42 }
      : { cx: 240, cy: 100, rx: 52, ry: 48 };

    // Vesículas dentro del pre (posiciones deterministas, sin Math.random
    // para que el layout sea igual entre renders).
    const vesicles = mobile
      ? [{ cx: 70, cy: 68, r: 12 }, { cx: 100, cy: 95, r: 14 }, { cx: 120, cy: 72, r: 11 }]
      : [{ cx: 60, cy: 82, r: 12 }, { cx: 90, cy: 108, r: 13 }, { cx: 72, cy: 126, r: 10 }];

    // Contenido de cada vesícula: círculo hueco (membrana) + ~7 dots
    // distribuidos en el interior usando coseno/seno para no repetir patrón.
    const vesicleContent = vesicles.map((v, idx) => {
      const dots = [];
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + idx * 0.7;
        const rr = v.r * 0.58;
        const x = v.cx + Math.cos(a) * rr;
        const y = v.cy + Math.sin(a) * rr;
        dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${NT}"/>`);
      }
      return `
        <circle cx="${v.cx}" cy="${v.cy}" r="${v.r}" fill="none" stroke="${NT_dark}" stroke-width="1.3" opacity="0.7"/>
        ${dots.join('')}`;
    }).join('');

    // Canales de calcio rojos — media luna apuntando al cleft. 2 en el
    // borde del pre que da al post.
    const crescents = mobile
      ? `
        <path d="M ${pre.cx-22} ${pre.cy+pre.ry-3} a 6 6 0 0 1 12 0" fill="${CHAN}" stroke="${CHAN}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M ${pre.cx+10} ${pre.cy+pre.ry-3} a 6 6 0 0 1 12 0" fill="${CHAN}" stroke="${CHAN}" stroke-width="1.2" stroke-linejoin="round"/>`
      : `
        <path d="M ${pre.cx+pre.rx-3} ${pre.cy-18} a 6 6 0 0 1 0 12" fill="${CHAN}" stroke="${CHAN}" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M ${pre.cx+pre.rx-3} ${pre.cy+6} a 6 6 0 0 1 0 12" fill="${CHAN}" stroke="${CHAN}" stroke-width="1.2" stroke-linejoin="round"/>`;

    // Receptores en el post — T-shapes (tronco + barra horizontal) anclados
    // al borde del bulbo que da al cleft. Representan los receptores
    // (AMPA/NMDA/etc) esperando al neurotransmisor.
    const recOffsets = [-24, -8, 8, 24];
    const receptors = recOffsets.map(off => {
      if (mobile) {
        const x = post.cx + off;
        const y = post.cy - post.ry;
        return `
          <line x1="${x}" y1="${y}" x2="${x}" y2="${y - 9}" stroke="${c.deep}" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="${x - 5}" y1="${y - 9}" x2="${x + 5}" y2="${y - 9}" stroke="${c.deep}" stroke-width="2.4" stroke-linecap="round"/>`;
      } else {
        const x = post.cx - post.rx;
        const y = post.cy + off;
        return `
          <line x1="${x}" y1="${y}" x2="${x - 9}" y2="${y}" stroke="${c.deep}" stroke-width="2.4" stroke-linecap="round"/>
          <line x1="${x - 9}" y1="${y - 5}" x2="${x - 9}" y2="${y + 5}" stroke="${c.deep}" stroke-width="2.4" stroke-linecap="round"/>`;
      }
    }).join('');

    // Partículas de neurotransmisor cruzando el cleft. 10 circulitos con
    // delays escalonados — el loop base es 3.5s, repartidos para que haya
    // flujo continuo (una nueva partícula sale cada ~0.35s).
    //
    // startX/startY = borde del pre que da al cleft. La animación
    // (ta-release-h o ta-release-v) traslada ~56px hacia el post con
    // scale 0.4→1→0.5 y opacity fade-in/fade-out.
    const particleCount = 10;
    const releaseClass = mobile ? 'ta-release-v' : 'ta-release-h';
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const delay = (i / particleCount) * 3.5;
      const offset = ((i % 3) - 1) * 10; // -10, 0, 10 — dispersa las partículas
      const startX = mobile ? pre.cx + offset : pre.cx + pre.rx - 2;
      const startY = mobile ? pre.cy + pre.ry - 2 : pre.cy + offset;
      particles.push(
        `<circle class="${releaseClass}" style="animation-delay:${delay.toFixed(2)}s" cx="${startX}" cy="${startY}" r="3" fill="${NT}" stroke="${NT_dark}" stroke-width="0.6"/>`
      );
    }

    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Pre-synaptic terminal (bulbo de origen) -->
        <ellipse cx="${pre.cx}" cy="${pre.cy}" rx="${pre.rx}" ry="${pre.ry}"
                 fill="${c.color}" stroke="${c.deep}" stroke-width="2"/>
        <!-- Vesículas cargadas de neurotransmisor -->
        ${vesicleContent}
        <!-- Canales de calcio (rojos, media luna) -->
        ${crescents}
        <!-- Post-synaptic terminal (bulbo receptor) -->
        <ellipse cx="${post.cx}" cy="${post.cy}" rx="${post.rx}" ry="${post.ry}"
                 fill="${c.color}" stroke="${c.deep}" stroke-width="2"/>
        <!-- Receptores (T-shapes) -->
        ${receptors}
        <!-- Partículas de neurotransmisor cruzando el cleft -->
        ${particles.join('')}
      </svg>`;
  }

  // IA — lattice of nodes with pulses traveling edges
  function renderIA(variant) {
    const c = TOPIC_COLORS.ia;
    const mobile = variant === 'mobile';
    // — Re-encuadre de la red neuronal.
    // Antes (desktop): bbox de los nodos iba de x=60..280, y=40..180. Eso
    // dejaba al nodo [280,180] prácticamente pegado a la esquina
    // inferior-derecha del stage (320×200) y hacía que el bbox-centroide
    // cayera en (170, 110) — descentrado +10 en x y +10 en y respecto al
    // centro real de la viewBox (160, 100). Visualmente la red "caía" a
    // la derecha-abajo del canvas.
    // Ahora: los 7 nodos están repartidos en un trapezoide simétrico con
    // márgenes parejos (≥35px en los bordes) y el bbox-centroide
    // coincide con el centro del viewBox. El grafo se lee como una
    // constelación centrada en su estuche, no como un recorte.
    //
    // Mobile (180×320): mismo reajuste. El bbox original iba de y=60..280
    // (centroide y=170, offset +10). Los nuevos puntos caen en y=50..270
    // (centroide y=160) quedando centrado vertical.
    const pts = mobile
      ? [[50,50],[130,80],[60,150],[140,180],[90,230],[40,270]]
      : [[80,50],[160,35],[240,50],[50,110],[270,110],[110,165],[210,165]];
    const edges = mobile
      ? [[0,1],[0,2],[1,3],[2,3],[2,4],[3,4],[4,5]]
      : [[0,1],[1,2],[0,3],[3,4],[2,5],[1,4],[3,6],[4,6],[5,6]];
    const edgePath = ([a,b]) => `M ${pts[a][0]} ${pts[a][1]} L ${pts[b][0]} ${pts[b][1]}`;
    // se pidió que los nodos sean estáticos (antes el círculo interior
    // pulsaba y, con el pivot ajustado en Fase A, algunos parecían "moverse"
    // porque scaleaban desde un origen que no coincidía con su centro real).
    // Ahora: nodo sólido fijo + 2 anillos ta-ring expansivos por nodo, con
    // delays escalonados según el índice. Se lee como nodos que "se hablan"
    // mandando pequeños pings de energía entre sí.
    const ringDelays = ['', 'd1', 'd2'];
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Faint edges -->
        <g stroke="${c.deep}" stroke-width="1" opacity="0.35" fill="none">
          ${edges.map(e => `<path d="${edgePath(e)}"/>`).join('')}
        </g>
        <!-- Animated pulses along edges -->
        <g stroke="${c.color}" stroke-width="2.2" fill="none" stroke-linecap="round">
          ${edges.map((e,i) => `<path class="ta-wire ${['','d1','d2','d3','','d1','d2','d3','d1'][i]||''}" d="${edgePath(e)}"/>`).join('')}
        </g>
        <!-- Pings de comunicación: 2 anillos expansivos por nodo, desfasados -->
        <g fill="none" stroke="${c.color}" stroke-width="1.4">
          ${pts.map((p,i) => {
            const d1 = ringDelays[i % 3];
            const d2 = ringDelays[(i + 1) % 3];
            return `
              <circle class="ta-ring ${d1}" cx="${p[0]}" cy="${p[1]}" r="6"/>
              <circle class="ta-ring ${d2}" cx="${p[0]}" cy="${p[1]}" r="6" stroke="${c.deep}" stroke-width="1" opacity="0.7"/>
            `;
          }).join('')}
        </g>
        <!-- Nodos estáticos (encima de los rings) -->
        <g>
          ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="${c.color}"/>`).join('')}
        </g>
      </svg>`;
  }

  // Biología — mitochondria breathing
  function renderBiologia(variant) {
    const c = TOPIC_COLORS.biologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const rx = mobile ? 68 : 110, ry = mobile ? 40 : 54;
    // Internal cristae — wavy horizontal paths
    const cristae = [];
    const cols = 5;
    for (let i=0;i<cols;i++) {
      const t = (i+1)/(cols+1);
      const cxi = ox - rx + t*rx*2;
      const yi = oy - ry*0.55;
      const yf = oy + ry*0.55;
      cristae.push(`<path class="ta-rung ${['','d1','d2','d3','d4','d5'][i]||''}" d="M ${cxi} ${yi} Q ${cxi+12} ${oy} ${cxi} ${yf}" fill="none" stroke="${c.deep}" stroke-width="2" stroke-linecap="round"/>`);
    }
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Outer membrane -->
        <g class="ta-breath" style="transform-origin:${ox}px ${oy}px;">
          <ellipse cx="${ox}" cy="${oy}" rx="${rx}" ry="${ry}" fill="${c.color}" opacity="0.95"/>
          <ellipse cx="${ox}" cy="${oy}" rx="${rx-6}" ry="${ry-6}" fill="${c.soft}" opacity="0.2" stroke="${c.deep}" stroke-width="1.5"/>
          ${cristae.join('')}
        </g>
        <!-- Energy sparks around -->
        <g fill="${c.deep}">
          <circle class="ta-twinkle" cx="${ox-rx-10}" cy="${oy-6}" r="2"/>
          <circle class="ta-twinkle d1" cx="${ox+rx+8}" cy="${oy+10}" r="1.8"/>
          <circle class="ta-twinkle d2" cx="${ox-10}" cy="${oy-ry-12}" r="1.6"/>
          <circle class="ta-twinkle d3" cx="${ox+14}" cy="${oy+ry+12}" r="1.6"/>
        </g>
      </svg>`;
  }

  // Física — Bohr atom with three electrons
  function renderFisica(variant) {
    const c = TOPIC_COLORS.fisica;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const R = mobile ? 70 : 80;
    // Three orbits at different angles. Each is a rotating group containing one electron on its +X axis.
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Static orbits (the ellipses don't spin; only the electrons do) -->
        <g fill="none" stroke="${c.deep}" stroke-width="1.4" opacity="0.55">
          <ellipse cx="${ox}" cy="${oy}" rx="${R}" ry="${R*0.38}" transform="rotate(0 ${ox} ${oy})"/>
          <ellipse cx="${ox}" cy="${oy}" rx="${R}" ry="${R*0.38}" transform="rotate(60 ${ox} ${oy})"/>
          <ellipse cx="${ox}" cy="${oy}" rx="${R}" ry="${R*0.38}" transform="rotate(-60 ${ox} ${oy})"/>
        </g>
        <!-- Electrons (each group spins) -->
        <g class="ta-atom-1" style="transform-origin:${ox}px ${oy}px;">
          <g transform="rotate(0 ${ox} ${oy})"><circle cx="${ox+R}" cy="${oy}" r="5" fill="${c.color}"/></g>
        </g>
        <g class="ta-atom-2" style="transform-origin:${ox}px ${oy}px;">
          <g transform="rotate(60 ${ox} ${oy})"><circle cx="${ox+R}" cy="${oy}" r="5" fill="${c.deep}"/></g>
        </g>
        <g class="ta-atom-3" style="transform-origin:${ox}px ${oy}px;">
          <g transform="rotate(-60 ${ox} ${oy})"><circle cx="${ox+R}" cy="${oy}" r="5" fill="${c.color}"/></g>
        </g>
        <!-- Nucleus -->
        <g class="ta-pulse" style="transform-origin:${ox}px ${oy}px;">
          <circle cx="${ox}" cy="${oy}" r="12" fill="${c.color}"/>
          <circle cx="${ox-3}" cy="${oy-2}" r="3" fill="${c.deep}"/>
          <circle cx="${ox+4}" cy="${oy+3}" r="2.5" fill="${c.deep}"/>
        </g>
      </svg>`;
  }

  // Medicina — ADN doble hélice con base pairs ATGC coloreados
  // Rework: que la animación
  // anterior no era fiel a la estructura real del ADN — era una hélice 2D
  // con rungs horizontales todos del mismo color y muy pocos (6-8), lo
  // cual lee más como "cadena genérica" que como "ADN de verdad".
  //
  // Cambios para acercarlo a un diagrama de libro de texto:
  // - Dos backbones con colores distintos (pink primario + deep pink)
  // que se leen como dos hebras antiparalelas, no como una hélice
  // monocromática.
  // - Base pairs en 4 colores cycling (A/T/G/C): purple / red / yellow /
  // teal. Esto hace evidente que son moléculas distintas, como en
  // cualquier diagrama científico donde ATGC aparecen con colores
  // convencionales. Los colores NO vienen del topic palette — son
  // semánticos (igual que los verdes del neurotransmisor).
  // - Más base pairs (count=11 desktop, 15 mobile, ~1 vuelta completa)
  // acercándose a la densidad real (~10.5 bp por vuelta).
  // - Caps de nucleósido (círculos pequeños) en los endpoints de cada
  // base pair — representan el azúcar-fosfato que conecta cada base
  // al backbone.
  // - Mantengo ta-helix (flip horizontal del grupo entero) para dar la
  // sensación 3D de la hélice rotando sobre su eje.
  function renderMedicina(variant) {
    const c = TOPIC_COLORS.medicina;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160;
    const top = mobile ? 28 : 18;
    const bot = mobile ? 292 : 182;
    const span = bot - top;

    // Paleta ATGC — 4 colores convencionales de diagrama (purple/red/
    // yellow/teal). Se ciclan con i%4.
    const BASE_COLORS = ['#8B4FE0', '#F2542D', '#F5B638', '#2EAFB5'];

    // Densidad de base pairs. Una vuelta completa ≈ 10.5 bp — usamos 11
    // desktop y 15 mobile (más alto → más bp caben bien).
    const count = mobile ? 15 : 11;
    const amp = mobile ? 40 : 48;

    const rungs = [];
    const caps = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const y = top + t * span;
      const phase = t * Math.PI * 2;
      const x1 = ox - Math.sin(phase) * amp;
      const x2 = ox + Math.sin(phase) * amp;
      const baseColor = BASE_COLORS[i % 4];
      // Base pair: línea con stroke grueso + ligera transparencia para
      // que cuando se cruzan con los backbones no haya "corte duro".
      rungs.push(
        `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${baseColor}" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>`
      );
      // Caps de nucleósido — uno por endpoint. Color del backbone al que
      // "se conecta" (strand1 = c.color, strand2 = c.deep) para que el
      // observador capte que cada base está anclada a UN backbone.
      caps.push(
        `<circle cx="${x1.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${c.deep}"/>`,
        `<circle cx="${x2.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${c.color}"/>`
      );
    }

    // Backbones (sine strands) — mismo phase function que los rungs, así
    // los endpoints de cada rung caen EXACTAMENTE sobre el backbone.
    // Sin esta alineación, los caps y los backbones se despegarían
    // visualmente en la hélice.
    const strand = (sign) => {
      const steps = 80;
      let d = `M ${(ox + sign * Math.sin(0) * amp).toFixed(2)} ${top}`;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const y = top + t * span;
        const phase = t * Math.PI * 2;
        const x = ox + sign * Math.sin(phase) * amp;
        d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      return d;
    };

    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g class="ta-helix" style="transform-origin:${ox}px ${(top+bot)/2}px;">
          <!-- Base pairs (detrás de los backbones para que los caps se vean por encima) -->
          ${rungs.join('')}
          <!-- Backbones: pink primario + deep pink, se intercambian posición al flip -->
          <path d="${strand(1)}" fill="none" stroke="${c.color}" stroke-width="3.2" stroke-linecap="round"/>
          <path d="${strand(-1)}" fill="none" stroke="${c.deep}" stroke-width="3.2" stroke-linecap="round"/>
          <!-- Caps de nucleósido (arriba de todo) -->
          ${caps.join('')}
        </g>
      </svg>`;
  }

  // Energía — lightning bolt + pulse on a power grid
  function renderEnergia(variant) {
    const c = TOPIC_COLORS.energia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    // se pidió eliminar el rayo central; dejamos sólo las ondas
    // radiantes sobre la grilla punteada, que era la parte que le gustaba.
    // El motif ahora es "pulso de energía sobre una red" — más limpio y
    // coherente con el chip de Tecnología (también una red con pulso).
    const dots = [];
    const cols = mobile ? 5 : 9, rows = mobile ? 9 : 5;
    const w = mobile ? 180 : 320, h = mobile ? 320 : 200;
    for (let i=0;i<cols;i++) for (let j=0;j<rows;j++) {
      dots.push(`<circle cx="${(i+0.5)*w/cols}" cy="${(j+0.5)*h/rows}" r="1" fill="${c.deep}" opacity="0.3"/>`);
    }
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g>${dots.join('')}</g>
        <!-- Núcleo estático: da un "origen" visual a las ondas -->
        <circle cx="${ox}" cy="${oy}" r="6" fill="${c.color}"/>
        <circle cx="${ox}" cy="${oy}" r="2.5" fill="${c.soft}"/>
        <!-- Ondas radiantes (3 con delays escalonados) -->
        <circle class="ta-ring" cx="${ox}" cy="${oy}" r="30" fill="none" stroke="${c.color}" stroke-width="1.8" opacity="0.8"/>
        <circle class="ta-ring d1" cx="${ox}" cy="${oy}" r="30" fill="none" stroke="${c.deep}" stroke-width="1.4" opacity="0.6"/>
        <circle class="ta-ring d2" cx="${ox}" cy="${oy}" r="30" fill="none" stroke="${c.deep}" stroke-width="1" opacity="0.4"/>
      </svg>`;
  }

  // Materiales — wireframe cube rotating (parallax) + inner crystal
  function renderMateriales(variant) {
    const c = TOPIC_COLORS.materiales;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const s = mobile ? 50 : 58;
    // Cubo isométrico "honesto": hexágono exterior + 3 aristas internas al
    // centro. Proporciones 2:1 (ancho:alto de cada rombo) que es el estándar
    // iso. se indicó que el anterior se veía "raro" — era porque mezclaba
    // el hex iso con un "apex" tipo casa que no correspondía a un cubo real.
    //
    // TOP
    // / \
    // TL TR
    // | \ / | ← 3 aristas internas a C (centro)
    // | C |
    // BL / \ BR
    // \ /
    // BOT
    const dx = s; // half-width del hexágono
    const dy = s * 0.5; // half-height de cada rombo (iso 2:1)
    const TOP = [ox, oy - s ];
    const TR = [ox + dx, oy - dy ];
    const BR = [ox + dx, oy + dy ];
    const BOT = [ox, oy + s ];
    const BL = [ox - dx, oy + dy ];
    const TL = [ox - dx, oy - dy ];
    const C = [ox, oy ];
    const hex = [TOP, TR, BR, BOT, BL, TL];
    const hexPath = 'M ' + hex.map(p => p.join(' ')).join(' L ') + ' Z';
    // 4 aristas internas de C: a los 4 puntos cardinales del hex (TOP, BOT,
    // BL, BR). se pidió agregar C→BOT para completar visualmente el
    // cubo (antes sólo había C→TOP/BL/BR y se leía "incompleto" abajo).
    const innerEdges = [
      `<line x1="${C[0]}" y1="${C[1]}" x2="${TOP[0]}" y2="${TOP[1]}" stroke="${c.color}" stroke-width="1.5" opacity="0.55" stroke-linecap="round"/>`,
      `<line x1="${C[0]}" y1="${C[1]}" x2="${BOT[0]}" y2="${BOT[1]}" stroke="${c.color}" stroke-width="1.5" opacity="0.55" stroke-linecap="round"/>`,
      `<line x1="${C[0]}" y1="${C[1]}" x2="${BL[0]}" y2="${BL[1]}" stroke="${c.color}" stroke-width="1.5" opacity="0.55" stroke-linecap="round"/>`,
      `<line x1="${C[0]}" y1="${C[1]}" x2="${BR[0]}" y2="${BR[1]}" stroke="${c.color}" stroke-width="1.5" opacity="0.55" stroke-linecap="round"/>`,
    ].join('');
    // Átomos ESTÁTICOS en los vértices (se pidió que no se "levanten"
    // — antes usaban ta-pulse y, con el fix de transform-box de Fase A, algunos
    // parecían moverse porque scaleaban desde el centro del SVG, no del nodo).
    const verts = [TOP, TR, BR, BOT, BL, TL, C];
    const atoms = verts.map((p, i) =>
      `<circle cx="${p[0]}" cy="${p[1]}" r="${i===6?3:2.5}" fill="${c.color}"/>`
    ).join('');
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g class="ta-float" style="transform-origin:${ox}px ${oy}px;">
          <!-- Sombra sutil de la cara superior, para profundidad iso -->
          <path d="M ${TOP[0]} ${TOP[1]} L ${TR[0]} ${TR[1]} L ${C[0]} ${C[1]} L ${TL[0]} ${TL[1]} Z" fill="${c.color}" opacity="0.08"/>
          <!-- Silueta del cubo -->
          <path d="${hexPath}" fill="none" stroke="${c.color}" stroke-width="2" stroke-linejoin="round"/>
          ${innerEdges}
          ${atoms}
        </g>
      </svg>`;
  }

  // Matemática — coordinate grid + sine wave being drawn + π glyph
  function renderMatematica(variant) {
    const c = TOPIC_COLORS.matematica;
    const mobile = variant === 'mobile';
    const W = mobile ? 180 : 320, H = mobile ? 320 : 200;
    const ox = W/2, oy = H/2;
    // Grid lines
    const grid = [];
    const step = mobile ? 20 : 24;
    for (let x=step; x<W; x+=step) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${c.deep}" stroke-width="0.6" opacity="0.2"/>`);
    for (let y=step; y<H; y+=step) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${c.deep}" stroke-width="0.6" opacity="0.2"/>`);
    // Axes
    const axes = `<line x1="0" y1="${oy}" x2="${W}" y2="${oy}" stroke="${c.deep}" stroke-width="1.2"/><line x1="${ox}" y1="0" x2="${ox}" y2="${H}" stroke="${c.deep}" stroke-width="1.2"/>`;
    // Sine wave path
    const amp = mobile ? 40 : 44, wl = mobile ? 90 : 120;
    let d = `M 0 ${oy}`;
    const steps = 80;
    for (let i=1;i<=steps;i++) {
      const x = (i/steps)*W;
      const y = oy - Math.sin((x/wl)*Math.PI*2)*amp;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    // se pidió quitar el π flotante — la escena queda como "gráfica
    // matemática" pura: grilla + ejes + curva que se dibuja. El glyph de π
    // ya está en el TopicIcon del eyebrow, no hace falta repetirlo acá.
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g>${grid.join('')}</g>
        ${axes}
        <path d="${d}" fill="none" stroke="${c.deep}" stroke-width="1" opacity="0.3"/>
        <path class="ta-draw" d="${d}" fill="none" stroke="${c.color}" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
  }

  // Psicología — two mirrored head silhouettes with thought ripples
  function renderPsicologia(variant) {
    const c = TOPIC_COLORS.psicologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 180 : 120;
    const sep = mobile ? 52 : 72;
    // Silueta humana: cabeza (círculo) + cuello + torso (trapecio de hombros).
    // Antes era un path continuo que parecía feto (feedback de QA) — ahora
    // separamos cabeza y hombros como en un avatar clásico.
    const person = (cx, cy, faceFill) => {
      const headR = 14;
      const headCy = cy - 8; // centro de la cabeza
      const shoulderTopY = headCy + headR + 4; // arranque de hombros
      const shoulderBotY = shoulderTopY + 18;
      const shoulderHalfTop = 4; // cuello angosto
      const shoulderHalfBot = 22; // hombros anchos
      const torso =
        `M ${cx - shoulderHalfTop} ${shoulderTopY}
         L ${cx + shoulderHalfTop} ${shoulderTopY}
         L ${cx + shoulderHalfBot} ${shoulderBotY}
         L ${cx - shoulderHalfBot} ${shoulderBotY} Z`;
      return `
        <path d="${torso}" fill="${faceFill}" opacity="0.95"/>
        <circle cx="${cx}" cy="${headCy}" r="${headR}" fill="${faceFill}"/>
      `;
    };
    // Una sola forma de arco base, repetida 3 veces con delays. La keyframe
    // ta-ripple escala desde el centro-bottom de cada path (0.3 → 2.0), así
    // que en cualquier momento ves 3 instancias de la MISMA onda en distintas
    // etapas de expansión: lee como un pulso radial continuo, sin pisarse.
    const rippleCx = ox, rippleCy = oy - 18;
    const r = mobile ? 16 : 20;
    const h = mobile ? 9 : 11;
    const arc = `M ${rippleCx-r} ${rippleCy} Q ${rippleCx} ${rippleCy - h} ${rippleCx+r} ${rippleCy}`;
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Persona izquierda -->
        ${person(ox - sep, oy, c.color)}
        <!-- Persona derecha -->
        ${person(ox + sep, oy, c.deep)}
        <!-- Pulso radial de pensamiento entre ambas -->
        <g fill="none" stroke="${c.deep}" stroke-width="1.8" stroke-linecap="round">
          <path class="ta-ripple" d="${arc}"/>
          <path class="ta-ripple d1" d="${arc}"/>
          <path class="ta-ripple d2" d="${arc}"/>
        </g>
      </svg>`;
  }

  // Ecología — leaf with growing veins + falling/rising particles
  function renderEcologia(variant) {
    const c = TOPIC_COLORS.ecologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const w = mobile ? 70 : 80, h = mobile ? 100 : 110;
    // Leaf outline (elliptic with pointed tip)
    const leaf = `M ${ox} ${oy-h/2}
                  C ${ox+w/2} ${oy-h/2+20}, ${ox+w/2} ${oy+h/2-10}, ${ox} ${oy+h/2}
                  C ${ox-w/2} ${oy+h/2-10}, ${ox-w/2} ${oy-h/2+20}, ${ox} ${oy-h/2} Z`;
    // Central vein + lateral veins
    const veins = [];
    veins.push(`<path class="ta-draw" d="M ${ox} ${oy-h/2+4} L ${ox} ${oy+h/2-4}" stroke="${c.deep}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
    const vCount = mobile ? 4 : 5;
    for (let i=0;i<vCount;i++) {
      const t = (i+1)/(vCount+1);
      const y = oy-h/2 + t*h;
      const len = (mobile?18:22)*(1 - Math.abs(t-0.5));
      veins.push(`<path class="ta-draw ${['','d1','d2','d3','d4'][i]||''}" d="M ${ox} ${y} Q ${ox+len*0.5} ${y+6} ${ox+len} ${y+12}" stroke="${c.deep}" stroke-width="1" fill="none" stroke-linecap="round"/>`);
      veins.push(`<path class="ta-draw ${['','d1','d2','d3','d4'][i]||''}" d="M ${ox} ${y} Q ${ox-len*0.5} ${y+6} ${ox-len} ${y+12}" stroke="${c.deep}" stroke-width="1" fill="none" stroke-linecap="round"/>`);
    }
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g class="ta-sway" style="transform-origin:${ox}px ${oy+h/2}px;">
          <path d="${leaf}" fill="${c.color}"/>
          ${veins.join('')}
        </g>
        <!-- Floating particles (pollen / O2) -->
        <g fill="${c.deep}">
          <circle class="ta-float-up" cx="${ox-w/2-14}" cy="${oy+20}" r="1.6"/>
          <circle class="ta-float-up d1" cx="${ox+w/2+16}" cy="${oy-10}" r="1.6"/>
          <circle class="ta-float-up d2" cx="${ox-w/2-22}" cy="${oy-20}" r="1.2"/>
          <circle class="ta-float-up d3" cx="${ox+w/2+24}" cy="${oy+16}" r="1.4"/>
        </g>
      </svg>`;
  }

  // Tecnología — concentric signal rings + circuit traces
  function renderTecnologia(variant) {
    const c = TOPIC_COLORS.tecnologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const W = mobile ? 180 : 320, H = mobile ? 320 : 200;
    // Chip: 32×32 centrado en (ox,oy). Las pistas llegan a la MITAD de cada
    // lado (top / right / bottom / left), no a las esquinas — así se leen como
    // cables que entran al chip, no como rayas sueltas (feedback de QA).
    const chipR = 16;
    const edgeTop = oy - chipR; // y del borde superior
    const edgeBot = oy + chipR;
    const edgeLeft = ox - chipR;
    const edgeRight = ox + chipR;
    // Pads uniformes: los 4 en los lados IZQ y DER del chip, uno arriba y uno
    // abajo en cada lado (configuración espejo). Antes había dos arriba/abajo
    // y dos a la derecha — se detectó la inconsistencia.
    const padOffset = 8; // separación del pad al centro del chip en Y
    const padTopY = oy - padOffset;
    const padBotY = oy + padOffset;
    // Cada pista hace una L: entra horizontal desde el borde del stage, baja/sube
    // en vertical, y remata en horizontal contra el lado lateral del chip.
    const traces = mobile
      ? [
          `M 10 40 L 50 40 L 50 ${padTopY} L ${edgeLeft} ${padTopY}`, // TL → lado izq arriba
          `M ${W-10} 40 L ${W-50} 40 L ${W-50} ${padTopY} L ${edgeRight} ${padTopY}`, // TR → lado der arriba
          `M 10 ${H-40} L 50 ${H-40} L 50 ${padBotY} L ${edgeLeft} ${padBotY}`, // BL → lado izq abajo
          `M ${W-10} ${H-40} L ${W-50} ${H-40} L ${W-50} ${padBotY} L ${edgeRight} ${padBotY}`, // BR → lado der abajo
        ]
      : [
          `M 10 40 L 70 40 L 70 ${padTopY} L ${edgeLeft} ${padTopY}`,
          `M ${W-10} 40 L ${W-70} 40 L ${W-70} ${padTopY} L ${edgeRight} ${padTopY}`,
          `M 10 ${H-40} L 70 ${H-40} L 70 ${padBotY} L ${edgeLeft} ${padBotY}`,
          `M ${W-10} ${H-40} L ${W-70} ${H-40} L ${W-70} ${padBotY} L ${edgeRight} ${padBotY}`,
        ];
    const pads = [
      [edgeLeft, padTopY], [edgeRight, padTopY],
      [edgeLeft, padBotY], [edgeRight, padBotY],
    ];
    const traceSvg = traces.map((d,i) => `
      <path d="${d}" fill="none" stroke="${c.deep}" stroke-width="1.4" opacity="0.5" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${c.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ta-wire ${['','d1','d2','d3'][i]||''}"/>
    `).join('');
    const padSvg = pads.map(([px,py]) => `<circle cx="${px}" cy="${py}" r="2.2" fill="${c.deep}"/>`).join('');
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        ${traceSvg}
        <!-- Anillos de señal (pulso que sale del chip) -->
        <circle class="ta-ring" cx="${ox}" cy="${oy}" r="22" fill="none" stroke="${c.color}" stroke-width="1.6"/>
        <circle class="ta-ring d1" cx="${ox}" cy="${oy}" r="22" fill="none" stroke="${c.color}" stroke-width="1.4" opacity="0.7"/>
        <circle class="ta-ring d2" cx="${ox}" cy="${oy}" r="22" fill="none" stroke="${c.deep}" stroke-width="1.2" opacity="0.5"/>
        <!-- Chip central -->
        <rect x="${edgeLeft}" y="${edgeTop}" width="${chipR*2}" height="${chipR*2}" rx="3" fill="${c.color}" stroke="${c.deep}" stroke-width="1.5"/>
        <rect x="${ox-7}" y="${oy-7}" width="14" height="14" fill="${c.deep}"/>
        <!-- Pads donde las pistas aterrizan -->
        ${padSvg}
      </svg>`;
  }

  // Química — flask bubbling + molecule rotating
  function renderQuimica(variant) {
    const c = TOPIC_COLORS.quimica;
    const mobile = variant === 'mobile';
    // Flask on the left, molecule on the right (or stacked on mobile)
    const flask = mobile
      ? { cx: 90, cy: 220, neckH: 30, bodyR: 32 }
      : { cx: 100, cy: 120, neckH: 26, bodyR: 34 };
    const mol = mobile
      ? { cx: 90, cy: 90, r: 40 }
      : { cx: 230, cy: 100, r: 42 };
    // Flask path: neck + body
    const nx = flask.cx, ny = flask.cy;
    const neckTop = ny - flask.bodyR - flask.neckH;
    const flaskPath = `M ${nx-6} ${neckTop}
                       L ${nx-6} ${ny - flask.bodyR + 6}
                       Q ${nx-flask.bodyR} ${ny - flask.bodyR + 6} ${nx-flask.bodyR} ${ny}
                       A ${flask.bodyR} ${flask.bodyR} 0 0 0 ${nx+flask.bodyR} ${ny}
                       Q ${nx+flask.bodyR} ${ny - flask.bodyR + 6} ${nx+6} ${ny - flask.bodyR + 6}
                       L ${nx+6} ${neckTop} Z`;
    // Liquid (partial fill) — approximate with an ellipse clipped by the body
    const liquidY = ny - 4;
    // Bubbles
    const bubbles = [
      `<circle class="ta-bubble" cx="${nx-6}" cy="${liquidY-4}" r="2.4" fill="${c.color}"/>`,
      `<circle class="ta-bubble d1" cx="${nx+4}" cy="${liquidY-10}" r="1.8" fill="${c.deep}"/>`,
      `<circle class="ta-bubble d2" cx="${nx+10}" cy="${liquidY-6}" r="2.0" fill="${c.color}"/>`,
      `<circle class="ta-bubble d3" cx="${nx-2}" cy="${liquidY-16}" r="1.4" fill="${c.deep}"/>`,
    ];
    // Molecule: hexagonal ring of 6 atoms
    const atoms = [];
    const bonds = [];
    const n = 6;
    for (let i=0;i<n;i++) {
      const a = (i/n)*Math.PI*2;
      atoms.push([mol.cx + Math.cos(a)*mol.r, mol.cy + Math.sin(a)*mol.r]);
    }
    for (let i=0;i<n;i++) {
      const a = atoms[i], b = atoms[(i+1)%n];
      bonds.push(`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c.deep}" stroke-width="1.8"/>`);
    }
    const atomSvg = atoms.map((p,i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${i%2===0?c.color:c.deep}"/>`).join('');
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Molecule on the right/top, rotating -->
        <g class="ta-spin-slow" style="transform-origin:${mol.cx}px ${mol.cy}px;">
          ${bonds.join('')}
          ${atomSvg}
        </g>
        <!-- Flask -->
        <path d="${flaskPath}" fill="none" stroke="${c.deep}" stroke-width="2" stroke-linejoin="round"/>
        <!-- Liquid -->
        <clipPath id="flask-clip-${variant}">
          <path d="${flaskPath}"/>
        </clipPath>
        <g clip-path="url(#flask-clip-${variant})">
          <rect x="${nx-flask.bodyR-4}" y="${liquidY}" width="${flask.bodyR*2+8}" height="${flask.bodyR+10}" fill="${c.color}" opacity="0.8"/>
          <path d="M ${nx-flask.bodyR} ${liquidY} Q ${nx-flask.bodyR/2} ${liquidY-3} ${nx} ${liquidY} T ${nx+flask.bodyR} ${liquidY} L ${nx+flask.bodyR} ${liquidY+4} L ${nx-flask.bodyR} ${liquidY+4} Z" fill="${c.deep}" opacity="0.5"/>
          ${bubbles.join('')}
        </g>
      </svg>`;
  }

  // Ciencia — paper filling with text + approved stamp
  // Concepto : es el fallback genérico para papers que no caen
  // en los 14 temas específicos. La animación reproduce la ilustración
  // illus-paper.svg (dos papers apilados y rotados ±°) y luego "escribe"
  // las líneas de texto una por una (scaleX: 0→1 left-anchored, tipo
  // máquina de escribir). Al final cae un sello redondo rojo con un check
  // tipo icon-filled — la metáfora es "paper revisado y aprobado".
  // Ciclo total 6s: lines fill 0–2s, stamp bounces in ~2.5s, hold hasta
  // ~5.5s, fade out y ciclo se reinicia.
  function renderCiencia(variant) {
    const c = TOPIC_COLORS.ciencia;
    const mobile = variant === 'mobile';

    // Dos papers — el de atrás con tilt negativo, el de adelante con tilt
    // positivo. Mismas proporciones que illus-paper.svg pero escaladas
    // para el viewBox de topic-anim (320×200 desktop, 180×320 mobile).
    const back = mobile
      ? { x: 22, y: 70, w: 138, h: 195 }
      : { x: 62, y: 50, w: 175, h: 120 };
    const front = mobile
      ? { x: 36, y: 55, w: 138, h: 195 }
      : { x: 85, y: 36, w: 175, h: 120 };
    const backCx = back.x + back.w / 2;
    const backCy = back.y + back.h / 2;
    const frontCx = front.x + front.w / 2;
    const frontCy = front.y + front.h / 2;

    // Layout interno del contenido dentro del front paper.
    // una línea que "se escapa" del
    // paper — pasaba cuando widthFrac=1.00 llegaba al borde exacto del maxW
    // interior; con el tilt +3° + anti-aliasing del stroke, visualmente se
    // veía cruzando el borde del rect. Fix: cap widthFrac a 0.88 y bajar
    // step a 8 (desktop) para que el row 12 final quede bien adentro del
    // bottom edge del paper en lugar de rozarlo.
    const pad = mobile ? 14 : 16;
    const x0 = front.x + pad;
    const y0 = front.y + (mobile ? 24 : 16);
    const maxW = front.w - pad * 2;
    const step = mobile ? 13 : 8; // separación vertical entre líneas

    // Cada fila: [rowIdx, widthFrac, height, fill, delay, xFrac?]
    // rowIdx es múltiplo de "step" — los huecos (rows 1, 5, 7, 11) dejan
    // respiración visual entre bloques (título → párrafo → tags → párrafo).
    // Los delays van escalonados 0→1.58s para que las primeras líneas
    // aparezcan primero y el stamp caiga después, una vez todas escritas.
    //
    // widthFrac cap: ninguna línea de cuerpo pasa 0.88. El resto del maxW
    // interior queda como margen visible entre el texto y el borde del
    // paper. El título (0.82) es un poco más corto aún para sugerir que
    // es un headline, no una línea de cuerpo.
    const rows = [
      // [rowIdx, widthFrac, height, fill, delay, xFrac]
      [0, 0.82, 5, '#0E1116', 0.00, 0], // título (bold, ink negro)
      [2, 0.88, 3, '#5A6170', 0.18, 0],
      [3, 0.78, 3, '#5A6170', 0.34, 0],
      [4, 0.84, 3, '#5A6170', 0.50, 0],
      // Tags de colores en la misma línea (como en illus-paper.svg)
      [6, 0.30, 12, '#2E4BE0', 0.72, 0], // tag azul
      [6, 0.22, 12, '#F2542D', 0.88, 0.34], // tag rojo a la derecha del azul
      [8, 0.88, 3, '#5A6170', 1.08, 0],
      [9, 0.80, 3, '#5A6170', 1.24, 0],
      [10, 0.70, 3, '#5A6170', 1.40, 0],
      [12, 0.42, 3, '#5A6170', 1.58, 0], // última línea (corta)
    ];

    const lineSvg = rows.map((row) => {
      const [rowIdx, widthFrac, h, fill, delay, xFrac] = row;
      const x = x0 + maxW * xFrac;
      const y = y0 + rowIdx * step;
      const w = maxW * widthFrac;
      const rx = h >= 8 ? 2 : 0;
      return `<rect class="ta-fill" style="animation-delay:${delay}s" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="${rx}" fill="${fill}"/>`;
    }).join('');

    // Sello "aprobado" — posición calculada como esquina inferior-derecha
    // del front paper, desplazado hacia adentro para que cruce visualmente
    // con el paper y no quede flotando fuera. El sello NO va dentro del
    // grupo rotado del front paper — eso lo alinearía con el +3° del
    // paper y perdería el look de "sello aplicado por encima" con su
    // propio ángulo (-12°) independiente.
    const stampCx = front.x + front.w - 26;
    const stampCy = front.y + front.h - 26;

    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Back paper (debajo, tilt negativo) -->
        <rect x="${back.x}" y="${back.y}" width="${back.w}" height="${back.h}"
              fill="#F4EEE1" stroke="${c.deep}" stroke-width="1.8"
              transform="rotate(-4 ${backCx} ${backCy})"/>
        <!-- Front paper + líneas de texto que se van escribiendo -->
        <g transform="rotate(3 ${frontCx} ${frontCy})">
          <rect x="${front.x}" y="${front.y}" width="${front.w}" height="${front.h}"
                fill="#FBF7EC" stroke="${c.deep}" stroke-width="1.8"/>
          ${lineSvg}
        </g>
        <!-- Sello rojo aprobado — cae en ~2.5s con pequeño rebote -->
        <g class="ta-stamp" style="transform-origin:${stampCx}px ${stampCy}px;">
          <circle cx="${stampCx}" cy="${stampCy}" r="18" fill="#C73F1D"/>
          <path d="M ${stampCx-7} ${stampCy+1} L ${stampCx-2} ${stampCy+6} L ${stampCx+8} ${stampCy-5}"
                stroke="#FBF7EC" stroke-width="3" stroke-linecap="round"
                stroke-linejoin="round" fill="none"/>
        </g>
      </svg>`;
  }

  const RENDERERS = {
    espacio: renderEspacio,
    clima: renderClima,
    neuro: renderNeuro,
    ia: renderIA,
    biologia: renderBiologia,
    fisica: renderFisica,
    medicina: renderMedicina,
    energia: renderEnergia,
    materiales: renderMateriales,
    matematica: renderMatematica,
    psicologia: renderPsicologia,
    ecologia: renderEcologia,
    tecnologia: renderTecnologia,
    quimica: renderQuimica,
    ciencia: renderCiencia,
  };

  // Public mount fn
  window.mountTopicAnim = function (el, topicId, variant = 'desktop') {
    if (!el || !RENDERERS[topicId]) return;
    el.classList.add('ta-stage');
    el.setAttribute('data-variant', variant);
    const label = el.querySelector('.stage-label');
    const labelHTML = label ? label.outerHTML : '';
    el.innerHTML = RENDERERS[topicId](variant) + labelHTML;
  };

  window.PV_TOPIC_ANIM_IDS = Object.keys(RENDERERS);
})();
