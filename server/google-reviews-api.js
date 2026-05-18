'use strict';

const PLACE_QUERY =
  process.env.GOOGLE_PLACE_QUERY ||
  'Pousada Mi Casa Su Casa, Rua Nações Unidas 111, Benevides, PA, Brasil';

const CACHE_TTL_MS = Number(process.env.GOOGLE_REVIEWS_CACHE_MS) || 60 * 60 * 1000;

let cache = { at: 0, payload: null };
let cachedPlaceId = process.env.GOOGLE_PLACE_ID || null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error('Google API HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function resolvePlaceId(apiKey) {
  if (cachedPlaceId) return cachedPlaceId;

  const params = new URLSearchParams({
    input: PLACE_QUERY,
    inputtype: 'textquery',
    fields: 'place_id,name',
    key: apiKey,
    language: 'pt-BR'
  });

  const data = await fetchJson(
    'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?' + params
  );

  if (data.status !== 'OK' || !data.candidates || !data.candidates[0]) {
    throw new Error('Place não encontrado: ' + (data.status || 'UNKNOWN'));
  }

  cachedPlaceId = data.candidates[0].place_id;
  return cachedPlaceId;
}

function formatReviewDate(timeSeconds, relative) {
  if (relative) return relative;
  if (!timeSeconds) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(timeSeconds * 1000));
  } catch (e) {
    return '';
  }
}

function normalizeReviews(result) {
  const reviews = (result.reviews || []).map(function (r) {
    return {
      nome: r.author_name || 'Hóspede Google',
      estrelas: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
      texto: (r.text || '').trim(),
      foto: r.profile_photo_url || '',
      data: formatReviewDate(r.time, r.relative_time_description),
      url: r.author_url || ''
    };
  }).filter(function (r) {
    return r.texto.length > 0;
  });

  return {
    nome: result.name || 'Mi Casa Su Casa',
    notaMedia: result.rating != null ? Number(result.rating) : null,
    totalAvaliacoes: result.user_ratings_total != null ? Number(result.user_ratings_total) : null,
    urlMaps: result.url || '',
    reviews: reviews
  };
}

async function fetchFromGoogle(apiKey) {
  const placeId = await resolvePlaceId(apiKey);
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,rating,user_ratings_total,reviews,url',
    key: apiKey,
    language: 'pt-BR',
    reviews_no_translations: 'true'
  });

  const data = await fetchJson(
    'https://maps.googleapis.com/maps/api/place/details/json?' + params
  );

  if (data.status !== 'OK' || !data.result) {
    throw new Error('Place Details: ' + (data.status || 'UNKNOWN'));
  }

  const payload = normalizeReviews(data.result);
  payload.placeId = placeId;
  payload.source = 'google';
  return payload;
}

function fallbackPayload() {
  return {
    source: 'fallback',
    nome: 'Mi Casa Su Casa',
    notaMedia: 5.0,
    totalAvaliacoes: null,
    urlMaps:
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(PLACE_QUERY),
    reviews: [
      {
        nome: 'Maria Silva',
        estrelas: 5,
        texto:
          'Lugar incrível! A piscina natural é um sonho e o atendimento foi impecável. Voltaremos com certeza.',
        foto: '',
        data: 'há 1 mês',
        url: ''
      },
      {
        nome: 'João Pedro Santos',
        estrelas: 5,
        texto:
          'Ambiente tranquilo, quartos confortáveis e café da manhã delicioso. Perfeito para descansar da cidade.',
        foto: '',
        data: 'há 2 meses',
        url: ''
      },
      {
        nome: 'Ana Carolina Lima',
        estrelas: 5,
        texto:
          'A natureza ao redor é linda. Nos sentimos em casa desde o check-in. Recomendo para casais e famílias.',
        foto: '',
        data: 'há 3 meses',
        url: ''
      },
      {
        nome: 'Ricardo Mendes',
        estrelas: 4,
        texto:
          'Ótima experiência no restaurante e nas áreas externas. Staff atencioso e localização fácil de achar.',
        foto: '',
        data: 'há 4 meses',
        url: ''
      },
      {
        nome: 'Fernanda Oliveira',
        estrelas: 5,
        texto:
          'Fim de semana perfeito! Churrasqueira, lago e muito verde. Já indiquei para amigos.',
        foto: '',
        data: 'há 5 meses',
        url: ''
      },
      {
        nome: 'Carlos Eduardo Rocha',
        estrelas: 5,
        texto:
          'Hospedagem acolhedora, limpa e com clima de refúgio. As fotos não fazem justiça à beleza do lugar.',
        foto: '',
        data: 'há 6 meses',
        url: ''
      }
    ]
  };
}

async function getGoogleReviews() {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_TTL_MS) {
    return { ...cache.payload, cached: true };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  let payload;

  if (!apiKey) {
    payload = fallbackPayload();
    payload.configRequired = true;
  } else {
    try {
      payload = await fetchFromGoogle(apiKey);
    } catch (err) {
      console.error('[google-reviews]', err.message);
      payload = fallbackPayload();
      payload.error = err.message;
    }
  }

  cache = { at: now, payload: payload };
  return payload;
}

module.exports = { getGoogleReviews, fallbackPayload };
