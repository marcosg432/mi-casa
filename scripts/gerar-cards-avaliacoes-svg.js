'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'imagem', 'avaliacoes');

const CARDS = [
  {
    file: 'card-01',
    iniciais: 'MS',
    nome: 'Maria Silva',
    nota: 5,
    data: 'há 1 mês',
    texto:
      'Lugar incrível! A piscina natural é um sonho e o atendimento foi impecável. Voltaremos com certeza.'
  },
  {
    file: 'card-02',
    iniciais: 'JP',
    nome: 'João Pedro Santos',
    nota: 5,
    data: 'há 2 meses',
    texto:
      'Ambiente tranquilo, quartos confortáveis e café da manhã delicioso. Perfeito para descansar da cidade.'
  },
  {
    file: 'card-03',
    iniciais: 'AC',
    nome: 'Ana Carolina Lima',
    nota: 5,
    data: 'há 3 meses',
    texto:
      'A natureza ao redor é linda. Nos sentimos em casa desde o check-in. Recomendo para casais e famílias.'
  },
  {
    file: 'card-04',
    iniciais: 'RM',
    nome: 'Ricardo Mendes',
    nota: 4,
    data: 'há 4 meses',
    texto:
      'Ótima experiência no restaurante e nas áreas externas. Staff atencioso e localização fácil de achar.'
  },
  {
    file: 'card-05',
    iniciais: 'FO',
    nome: 'Fernanda Oliveira',
    nota: 5,
    data: 'há 5 meses',
    texto:
      'Fim de semana perfeito! Churrasqueira, lago e muito verde. Já indiquei para amigos.'
  },
  {
    file: 'card-06',
    iniciais: 'CE',
    nome: 'Carlos Eduardo Rocha',
    nota: 5,
    data: 'há 6 meses',
    texto:
      'Hospedagem acolhedora, limpa e com clima de refúgio. As fotos não fazem justiça à beleza do lugar.'
  }
];

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(function (w) {
    const test = line ? line + ' ' + w : w;
    if (test.length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function stars(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    const fill = i <= n ? '#F4B400' : '#E0E0E0';
    const x = 108 + (i - 1) * 18;
    s +=
      '<polygon points="' +
      x +
      ',98 ' +
      (x + 6) +
      ',110 ' +
      (x + 12) +
      ',98" fill="' +
      fill +
      '" transform="rotate(0)"/>' +
      '<path d="M' +
      (x + 6) +
      ' 94 l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6z" fill="' +
      fill +
      '"/>';
  }
  return s;
}

function svgCard(c) {
  const lines = wrapText(c.texto, 42);
  const textYs = lines.map(function (_, i) {
    return 138 + i * 18;
  });
  const textSvg = lines
    .map(function (ln, i) {
      return (
        '<text x="24" y="' +
        textYs[i] +
        '" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#4a4a4a">' +
        ln
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') +
        '</text>'
      );
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="220" viewBox="0 0 340 220" role="img">\n' +
    '<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f1f1a" flood-opacity="0.12"/></filter></defs>\n' +
    '<rect width="340" height="220" rx="20" fill="#ffffff" filter="url(#sh)"/>\n' +
    '<circle cx="48" cy="52" r="24" fill="#3d6b4f"/>\n' +
    '<text x="48" y="58" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#fff">' +
    c.iniciais +
    '</text>\n' +
    '<text x="84" y="44" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600" fill="#1a1a1a">' +
    c.nome.replace(/&/g, '&amp;') +
    '</text>\n' +
    stars(c.nota) +
    '<text x="198" y="108" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#3d6b4f">' +
    c.nota.toFixed(1) +
    '</text>\n' +
    '<text x="84" y="118" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#888">' +
    c.data +
    '</text>\n' +
    textSvg +
    '<circle cx="308" cy="28" r="11" fill="#4285F4"/><text x="308" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">G</text>\n' +
    '</svg>'
  );
}

fs.mkdirSync(OUT, { recursive: true });
CARDS.forEach(function (c) {
  const file = path.join(OUT, c.file + '.svg');
  fs.writeFileSync(file, svgCard(c), 'utf8');
  console.log('OK', file);
});
