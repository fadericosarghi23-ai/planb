// Identità e dati tecnici del sito. I testi delle pagine sono in src/data/pagine/*.json.
export const site = {
  nome: 'PLAN B studio',
  ragioneSociale: "PLAN B | Filippo Dell'Orto Design Studio",
  dominio: 'https://www.filippodellorto.it',
  lingua: 'it',
  email: 'studio@filippodellorto.it',
  telefono: '+393356208642',
  indirizzo: { via: '4 Via Clerici', cap: '22036', citta: 'Erba', provincia: 'CO', paese: 'IT' },
  immagineSchema: '/img/og-01.jpg',
  mappa: {
    titolo: 'Mappa della sede',
    embed: 'https://maps.google.com/maps?q=via%20clerici%204%20erba&output=embed',
  },
  // Modulo di prenotazione: finché endpoint è vuoto il modulo non invia nulla.
  form: { endpoint: '', metodo: 'POST' },
  // Analytics / pixel: nessuno nel sito di partenza (solo verifiche dei motori di ricerca, non riportate).
  analytics: null as null | string,
};
