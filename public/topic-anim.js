(function () {
  const TOPIC_COLORS = {
    ia:         { color: '#2E4BE0', deep: '#1E34B0', soft: '#E0E6FF' },
    clima:      { color: '#1BA5B8', deep: '#0F7E8E', soft: '#CDEEF2' },
    neuro:      { color: '#8B4FE0', deep: '#6A2FC0', soft: '#E8DCF9' },
    espacio:    { color: '#F5B638', deep: '#C48A1A', soft: '#FDEEC8' },
    biologia:   { color: '#2E8B57', deep: '#1F6B3F', soft: '#D6EEDE' },
    fisica:     { color: '#F2542D', deep: '#C73F1D', soft: '#FDE4DA' },
    medicina:   { color: '#E03E8C', deep: '#B32168', soft: '#FADCEA' },
    energia:    { color: '#E8572C', deep: '#B8401A', soft: '#FBE0D3' },
    materiales: { color: '#0E1116', deep: '#2A2F38', soft: '#DADCE0' },
    matematica: { color: '#3D6AE0', deep: '#254AB0', soft: '#D9E3FB' },
    psicologia: { color: '#A35FD8', deep: '#7A3FB8', soft: '#ECDCF9' },
    ecologia:   { color: '#4FA068', deep: '#2F7040', soft: '#DFEEDF' },
    tecnologia: { color: '#D89A2C', deep: '#A87818', soft: '#F6E7C7' },
    quimica:    { color: '#E06AA8', deep: '#B34378', soft: '#F9DCE8' },
  };

  function viewBox(variant) {
    return variant === 'mobile' ? '0 0 180 320' : '0 0 320 200';
  }

  function centerFor(variant) {
    return variant === 'mobile' ? { cx: 90, cy: 160, r: 58 } : { cx: 160, cy: 100, r: 58 };
  }

  function renderEspacio(variant) {
    const c = TOPIC_COLORS.espacio;
    const { cx, cy, r } = centerFor(variant);
    const mobile = variant === 'mobile';
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g fill="${c.deep}" opacity="0.65">
          <circle class="ta-twinkle"    cx="${mobile?30:40}"  cy="${mobile?40:30}"  r="1.4"/>
          <circle class="ta-twinkle d1" cx="${mobile?150:280}" cy="${mobile?60:40}"  r="1.2"/>
          <circle class="ta-twinkle d2" cx="${mobile?160:60}"  cy="${mobile?260:170}" r="1.4"/>
          <circle class="ta-twinkle d3" cx="${mobile?40:240}"  cy="${mobile?280:170}" r="1.1"/>
          <circle class="ta-twinkle d4" cx="${mobile?90:160}"  cy="${mobile?30:20}"  r="1.1"/>
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

  function renderClima(variant) {
    const c = TOPIC_COLORS.clima;
    const mobile = variant === 'mobile';
    const sun = mobile ? { cx: 58, cy: 90, r: 28 } : { cx: 90, cy: 80, r: 26 };
    const cloud = mobile ? { x: 70, y: 120 } : { x: 130, y: 92 };
    const rainY = mobile ? 170 : 140;
    const drops = mobile
      ? [{ x: 90, d: '' }, { x: 106, d: 'd1' }, { x: 122, d: 'd2' }, { x: 138, d: 'd3' }]
      : [{ x: 170, d: '' }, { x: 194, d: 'd1' }, { x: 218, d: 'd2' }, { x: 242, d: 'd3' }];
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
        <!-- Cloud (drift) -->
        <g class="ta-drift">
          <g transform="translate(${cloud.x} ${cloud.y})">
            <ellipse cx="0" cy="0"  rx="26" ry="14" fill="${c.color}"/>
            <ellipse cx="20" cy="-4" rx="18" ry="12" fill="${c.color}"/>
            <ellipse cx="-18" cy="-2" rx="14" ry="10" fill="${c.color}"/>
            <ellipse cx="0" cy="2"  rx="30" ry="10" fill="${c.deep}"/>
          </g>
        </g>
        <!-- Rain -->
        <g fill="${c.deep}">
          ${drops.map(d => `<ellipse class="ta-drop ${d.d}" cx="${d.x}" cy="${rainY}" rx="1.6" ry="4"/>`).join('')}
        </g>
      </svg>`;
  }

  function renderNeuro(variant) {
    const c = TOPIC_COLORS.neuro;
    const mobile = variant === 'mobile';
    const n = mobile
      ? [{ cx: 45, cy: 90 }, { cx: 135, cy: 140 }, { cx: 60, cy: 230 }]
      : [{ cx: 70, cy: 60 }, { cx: 200, cy: 100 }, { cx: 110, cy: 160 }];
    const pathA = `M ${n[0].cx} ${n[0].cy} C ${(n[0].cx+n[1].cx)/2} ${n[0].cy-20}, ${(n[0].cx+n[1].cx)/2} ${n[1].cy+20}, ${n[1].cx} ${n[1].cy}`;
    const pathB = `M ${n[1].cx} ${n[1].cy} C ${(n[1].cx+n[2].cx)/2+20} ${n[1].cy+30}, ${(n[1].cx+n[2].cx)/2-20} ${n[2].cy-30}, ${n[2].cx} ${n[2].cy}`;
    const pathC = `M ${n[0].cx} ${n[0].cy} C ${n[0].cx-10} ${(n[0].cy+n[2].cy)/2}, ${n[2].cx-20} ${(n[0].cy+n[2].cy)/2-10}, ${n[2].cx} ${n[2].cy}`;
    const dendrites = (nn) => {
      const arms = [];
      for (let i=0; i<6; i++) {
        const a = i*60 + 15;
        const rad = a*Math.PI/180;
        const x = nn.cx + Math.cos(rad)*14;
        const y = nn.cy + Math.sin(rad)*14;
        arms.push(`<line x1="${nn.cx}" y1="${nn.cy}" x2="${x}" y2="${y}" stroke="${c.deep}" stroke-width="1.4" stroke-linecap="round"/>`);
      }
      return arms.join('');
    };
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g fill="none" stroke="${c.deep}" stroke-width="1.6" stroke-linecap="round" opacity="0.55">
          <path d="${pathA}"/>
          <path d="${pathB}"/>
          <path d="${pathC}"/>
        </g>
        <!-- Impulse trails -->
        <g fill="none" stroke="${c.color}" stroke-width="3" stroke-linecap="round">
          <path class="ta-impulse"    d="${pathA}"/>
          <path class="ta-impulse d1" d="${pathB}"/>
          <path class="ta-impulse d2" d="${pathC}"/>
        </g>
        <!-- Neurons (soma + dendrites) -->
        ${n.map((nn,i) => `
          <g>
            ${dendrites(nn)}
            <circle cx="${nn.cx}" cy="${nn.cy}" r="10" fill="${c.color}"/>
            <circle cx="${nn.cx}" cy="${nn.cy}" r="4" fill="${c.soft}" class="ta-pulse${i===0?'':(i===1?'-2':'-3')}"/>
          </g>
        `).join('')}
      </svg>`;
  }

  function renderIA(variant) {
    const c = TOPIC_COLORS.ia;
    const mobile = variant === 'mobile';
    const pts = mobile
      ? [[50,60],[130,90],[60,160],[140,190],[90,240],[40,280]]
      : [[60,50],[160,40],[260,80],[80,130],[200,150],[280,180],[140,180]];
    const edges = mobile
      ? [[0,1],[0,2],[1,3],[2,3],[2,4],[3,4],[4,5]]
      : [[0,1],[1,2],[0,3],[3,4],[2,5],[1,4],[3,6],[4,6],[5,6]];
    const edgePath = ([a,b]) => `M ${pts[a][0]} ${pts[a][1]} L ${pts[b][0]} ${pts[b][1]}`;
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
        <!-- Nodes -->
        <g>
          ${pts.map((p,i) => `
            <circle cx="${p[0]}" cy="${p[1]}" r="6" fill="${c.color}"/>
            <circle class="ta-pulse${i%3===1?'-2':(i%3===2?'-3':'')}" cx="${p[0]}" cy="${p[1]}" r="3" fill="${c.soft}"/>
          `).join('')}
        </g>
      </svg>`;
  }

  function renderBiologia(variant) {
    const c = TOPIC_COLORS.biologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const rx = mobile ? 68 : 110, ry = mobile ? 40 : 54;
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
          <circle class="ta-twinkle"    cx="${ox-rx-10}" cy="${oy-6}" r="2"/>
          <circle class="ta-twinkle d1" cx="${ox+rx+8}"  cy="${oy+10}" r="1.8"/>
          <circle class="ta-twinkle d2" cx="${ox-10}"    cy="${oy-ry-12}" r="1.6"/>
          <circle class="ta-twinkle d3" cx="${ox+14}"    cy="${oy+ry+12}" r="1.6"/>
        </g>
      </svg>`;
  }

  function renderFisica(variant) {
    const c = TOPIC_COLORS.fisica;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const R = mobile ? 70 : 80;
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

  function renderMedicina(variant) {
    const c = TOPIC_COLORS.medicina;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160;
    const top = mobile ? 30 : 10;
    const bot = mobile ? 290 : 190;
    const span = bot - top;
    const rungs = [];
    const count = mobile ? 8 : 6;
    const amp = mobile ? 42 : 52;
    for (let i=0;i<count;i++) {
      const t = (i+0.5)/count;
      const y = top + t*span;
      const phase = t*Math.PI*2;
      const x1 = ox + Math.sin(phase)*amp;
      const x2 = ox - Math.sin(phase)*amp;
      rungs.push(`<line class="ta-rung ${['','d1','d2','d3','d4','d5'][i%6]||''}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c.deep}" stroke-width="2" stroke-linecap="round"/>`);
    }
    const strand = (sign) => {
      let d = `M ${ox + sign*Math.sin(0)*amp} ${top}`;
      const steps = 60;
      for (let i=1;i<=steps;i++) {
        const t = i/steps;
        const y = top + t*span;
        const phase = t*Math.PI*2;
        const x = ox + sign*Math.sin(phase)*amp;
        d += ` L ${x} ${y}`;
      }
      return d;
    };
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g class="ta-helix" style="transform-origin:${ox}px ${(top+bot)/2}px;">
          <path d="${strand(1)}" fill="none" stroke="${c.color}" stroke-width="3" stroke-linecap="round"/>
          <path d="${strand(-1)}" fill="none" stroke="${c.deep}" stroke-width="3" stroke-linecap="round"/>
          ${rungs.join('')}
        </g>
      </svg>`;
  }

  function renderEnergia(variant) {
    const c = TOPIC_COLORS.energia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const bolt = mobile
      ? `M ${ox-10} ${oy-70} L ${ox+14} ${oy-20} L ${ox-6} ${oy-10} L ${ox+18} ${oy+40} L ${ox-14} ${oy+70} L ${ox+2} ${oy+10} L ${ox-18} ${oy}  Z`
      : `M ${ox-18} ${oy-55} L ${ox+10} ${oy-12} L ${ox-8} ${oy-4} L ${ox+22} ${oy+40} L ${ox-12} ${oy+58} L ${ox+4} ${oy+10} L ${ox-22} ${oy+2} Z`;
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
        <circle class="ta-ring"     cx="${ox}" cy="${oy}" r="30" fill="none" stroke="${c.deep}" stroke-width="1.4" opacity="0.7"/>
        <circle class="ta-ring d1"  cx="${ox}" cy="${oy}" r="30" fill="none" stroke="${c.color}" stroke-width="1.4" opacity="0.5"/>
        <circle class="ta-ring d2"  cx="${ox}" cy="${oy}" r="30" fill="none" stroke="${c.deep}" stroke-width="1" opacity="0.4"/>
        <path d="${bolt}" fill="${c.color}" stroke="${c.deep}" stroke-width="2" stroke-linejoin="round" class="ta-pulse" style="transform-origin:${ox}px ${oy}px;"/>
        <circle cx="${ox}" cy="${oy}" r="4" fill="${c.deep}" class="ta-pulse-2"/>
      </svg>`;
  }

  function renderMateriales(variant) {
    const c = TOPIC_COLORS.materiales;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const s = mobile ? 46 : 54;
    const p = [
      [ox-s, oy],       // left mid
      [ox, oy-s*0.55],  // top
      [ox+s, oy],       // right mid
      [ox, oy+s*0.55],  // bottom front
      [ox-s, oy-s*0.9], // upper left
      [ox, oy-s*1.45],  // apex
      [ox+s, oy-s*0.9], // upper right
      [ox, oy-s*0.35],  // center top
    ];
    const line = (a,b, w=1.5, op=1) => `<line x1="${p[a][0]}" y1="${p[a][1]}" x2="${p[b][0]}" y2="${p[b][1]}" stroke="${c.color}" stroke-width="${w}" opacity="${op}" stroke-linecap="round"/>`;
    const lattice = [];
    for (let i=0;i<3;i++) for (let j=0;j<3;j++) {
      lattice.push(`<circle cx="${ox-s*0.5 + i*s*0.5}" cy="${oy-s*0.65 + j*s*0.45}" r="1.5" fill="${c.color}" class="ta-twinkle ${['','d1','d2','d3','d4'][((i+j)%5)]||''}"/>`);
    }
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g class="ta-float" style="transform-origin:${ox}px ${oy}px;">
          <!-- Back edges (faded) -->
          ${line(0,4, 1.2, 0.35)}
          ${line(2,6, 1.2, 0.35)}
          ${line(4,5, 1.2, 0.35)}
          ${line(5,6, 1.2, 0.35)}
          ${line(1,5, 1.2, 0.35)}
          <!-- Front edges -->
          ${line(0,1)} ${line(1,2)} ${line(2,3)} ${line(3,0)}
          ${line(0,4)} ${line(2,6)} ${line(1,5)}
          ${line(4,1)} ${line(6,1)}
          <!-- Lattice -->
          ${lattice.join('')}
        </g>
      </svg>`;
  }

  function renderMatematica(variant) {
    const c = TOPIC_COLORS.matematica;
    const mobile = variant === 'mobile';
    const W = mobile ? 180 : 320, H = mobile ? 320 : 200;
    const ox = W/2, oy = H/2;
    const grid = [];
    const step = mobile ? 20 : 24;
    for (let x=step; x<W; x+=step) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${c.deep}" stroke-width="0.6" opacity="0.2"/>`);
    for (let y=step; y<H; y+=step) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${c.deep}" stroke-width="0.6" opacity="0.2"/>`);
    const axes = `<line x1="0" y1="${oy}" x2="${W}" y2="${oy}" stroke="${c.deep}" stroke-width="1.2"/><line x1="${ox}" y1="0" x2="${ox}" y2="${H}" stroke="${c.deep}" stroke-width="1.2"/>`;
    const amp = mobile ? 40 : 44, wl = mobile ? 90 : 120;
    let d = `M 0 ${oy}`;
    const steps = 80;
    for (let i=1;i<=steps;i++) {
      const x = (i/steps)*W;
      const y = oy - Math.sin((x/wl)*Math.PI*2)*amp;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    const pi = mobile
      ? `<g transform="translate(${ox+18} ${oy-70})"><text x="0" y="0" font-family="Georgia,serif" font-style="italic" font-size="32" fill="${c.color}">π</text></g>`
      : `<g transform="translate(${ox+70} ${oy-50})"><text x="0" y="0" font-family="Georgia,serif" font-style="italic" font-size="40" fill="${c.color}">π</text></g>`;
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <g>${grid.join('')}</g>
        ${axes}
        <path d="${d}" fill="none" stroke="${c.deep}" stroke-width="1" opacity="0.3"/>
        <path class="ta-draw" d="${d}" fill="none" stroke="${c.color}" stroke-width="2.5" stroke-linecap="round"/>
        <g class="ta-float" style="transform-origin:center;">${pi}</g>
      </svg>`;
  }

  function renderPsicologia(variant) {
    const c = TOPIC_COLORS.psicologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 180 : 120;
    const sep = mobile ? 46 : 64;
    const head = (cx, cy, facing) => {
      const f = facing; // +1 right, -1 left
      return `M ${cx + f*-18} ${cy+22}
              C ${cx + f*-22} ${cy}, ${cx + f*-20} ${cy-24}, ${cx + f*-6} ${cy-28}
              C ${cx + f*6} ${cy-32}, ${cx + f*18} ${cy-26}, ${cx + f*20} ${cy-14}
              C ${cx + f*22} ${cy-4}, ${cx + f*16} ${cy+2}, ${cx + f*14} ${cy+10}
              L ${cx + f*16} ${cy+22} Z`;
    };
    const rippleCx = ox, rippleCy = oy - 10;
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        <!-- Left head -->
        <path d="${head(ox-sep, oy, 1)}" fill="${c.color}" opacity="0.95"/>
        <circle cx="${ox-sep+6}" cy="${oy-14}" r="1.5" fill="${c.soft}"/>
        <!-- Right head -->
        <path d="${head(ox+sep, oy, -1)}" fill="${c.deep}" opacity="0.95"/>
        <circle cx="${ox+sep-6}" cy="${oy-14}" r="1.5" fill="${c.soft}"/>
        <!-- Connecting ripples -->
        <g fill="none" stroke="${c.color}" stroke-width="1.6" stroke-linecap="round">
          <path class="ta-ripple"     d="M ${rippleCx-18} ${rippleCy} Q ${rippleCx} ${rippleCy-14} ${rippleCx+18} ${rippleCy}"/>
          <path class="ta-ripple d1"  d="M ${rippleCx-10} ${rippleCy} Q ${rippleCx} ${rippleCy-8} ${rippleCx+10} ${rippleCy}"/>
          <path class="ta-ripple d2"  d="M ${rippleCx-26} ${rippleCy} Q ${rippleCx} ${rippleCy-20} ${rippleCx+26} ${rippleCy}"/>
        </g>
        <!-- Tiny spark above ripples -->
        <circle cx="${rippleCx}" cy="${rippleCy-24}" r="3" fill="${c.deep}" class="ta-pulse"/>
      </svg>`;
  }

  function renderEcologia(variant) {
    const c = TOPIC_COLORS.ecologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const w = mobile ? 70 : 80, h = mobile ? 100 : 110;
    const leaf = `M ${ox} ${oy-h/2}
                  C ${ox+w/2} ${oy-h/2+20}, ${ox+w/2} ${oy+h/2-10}, ${ox} ${oy+h/2}
                  C ${ox-w/2} ${oy+h/2-10}, ${ox-w/2} ${oy-h/2+20}, ${ox} ${oy-h/2} Z`;
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
          <circle class="ta-float-up"    cx="${ox-w/2-14}" cy="${oy+20}" r="1.6"/>
          <circle class="ta-float-up d1" cx="${ox+w/2+16}" cy="${oy-10}" r="1.6"/>
          <circle class="ta-float-up d2" cx="${ox-w/2-22}" cy="${oy-20}" r="1.2"/>
          <circle class="ta-float-up d3" cx="${ox+w/2+24}" cy="${oy+16}" r="1.4"/>
        </g>
      </svg>`;
  }

  function renderTecnologia(variant) {
    const c = TOPIC_COLORS.tecnologia;
    const mobile = variant === 'mobile';
    const ox = mobile ? 90 : 160, oy = mobile ? 160 : 100;
    const W = mobile ? 180 : 320, H = mobile ? 320 : 200;
    const traces = mobile
      ? [ `M 0 40 L 40 40 L 40 ${oy-60}`, `M ${W} 60 L ${W-40} 60 L ${W-40} ${oy-50}`,
          `M 0 ${H-40} L 50 ${H-40} L 50 ${oy+60}`, `M ${W} ${H-60} L ${W-50} ${H-60} L ${W-50} ${oy+50}` ]
      : [ `M 0 40 L 50 40 L 50 ${oy-50}`, `M ${W} 50 L ${W-60} 50 L ${W-60} ${oy-60}`,
          `M 0 ${H-40} L 50 ${H-40} L 50 ${oy+50}`, `M ${W} ${H-50} L ${W-60} ${H-50} L ${W-60} ${oy+60}` ];
    const traceSvg = traces.map((d,i) => `
      <path d="${d}" fill="none" stroke="${c.deep}" stroke-width="1.4" opacity="0.5"/>
      <path d="${d}" fill="none" stroke="${c.color}" stroke-width="2" stroke-linecap="round" class="ta-wire ${['','d1','d2','d3'][i]||''}"/>
    `).join('');
    return `
      <svg viewBox="${viewBox(variant)}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${c.soft}"/>
        ${traceSvg}
        <!-- Signal rings -->
        <circle class="ta-ring"    cx="${ox}" cy="${oy}" r="20" fill="none" stroke="${c.color}" stroke-width="1.6"/>
        <circle class="ta-ring d1" cx="${ox}" cy="${oy}" r="20" fill="none" stroke="${c.color}" stroke-width="1.4" opacity="0.7"/>
        <circle class="ta-ring d2" cx="${ox}" cy="${oy}" r="20" fill="none" stroke="${c.deep}" stroke-width="1.2" opacity="0.5"/>
        <!-- Central node (chip) -->
        <rect x="${ox-14}" y="${oy-14}" width="28" height="28" rx="3" fill="${c.color}" stroke="${c.deep}" stroke-width="1.5"/>
        <rect x="${ox-6}" y="${oy-6}" width="12" height="12" fill="${c.deep}"/>
        <!-- Pins -->
        ${[-1,1].map(s => `<line x1="${ox+s*14}" y1="${oy-8}" x2="${ox+s*18}" y2="${oy-8}" stroke="${c.deep}" stroke-width="1.4"/>`).join('')}
        ${[-1,1].map(s => `<line x1="${ox+s*14}" y1="${oy+8}" x2="${ox+s*18}" y2="${oy+8}" stroke="${c.deep}" stroke-width="1.4"/>`).join('')}
      </svg>`;
  }

  function renderQuimica(variant) {
    const c = TOPIC_COLORS.quimica;
    const mobile = variant === 'mobile';
    const flask = mobile
      ? { cx: 90, cy: 220, neckH: 30, bodyR: 32 }
      : { cx: 100, cy: 120, neckH: 26, bodyR: 34 };
    const mol = mobile
      ? { cx: 90, cy: 90, r: 40 }
      : { cx: 230, cy: 100, r: 42 };
    const nx = flask.cx, ny = flask.cy;
    const neckTop = ny - flask.bodyR - flask.neckH;
    const flaskPath = `M ${nx-6} ${neckTop}
                       L ${nx-6} ${ny - flask.bodyR + 6}
                       Q ${nx-flask.bodyR} ${ny - flask.bodyR + 6} ${nx-flask.bodyR} ${ny}
                       A ${flask.bodyR} ${flask.bodyR} 0 0 0 ${nx+flask.bodyR} ${ny}
                       Q ${nx+flask.bodyR} ${ny - flask.bodyR + 6} ${nx+6} ${ny - flask.bodyR + 6}
                       L ${nx+6} ${neckTop} Z`;
    const liquidY = ny - 4;
    const bubbles = [
      `<circle class="ta-bubble"    cx="${nx-6}"  cy="${liquidY-4}"  r="2.4" fill="${c.color}"/>`,
      `<circle class="ta-bubble d1" cx="${nx+4}"  cy="${liquidY-10}" r="1.8" fill="${c.deep}"/>`,
      `<circle class="ta-bubble d2" cx="${nx+10}" cy="${liquidY-6}"  r="2.0" fill="${c.color}"/>`,
      `<circle class="ta-bubble d3" cx="${nx-2}"  cy="${liquidY-16}" r="1.4" fill="${c.deep}"/>`,
    ];
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
  };

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
