// Archivos del proyecto en Supabase Storage (bucket privado "assets", ver supabase/002_archivos.sql).
// El contenido se guarda tal cual (data URL o texto del modelo) como texto.

export function supabaseFiles(db, bucket = 'assets') {
  const b = () => db.storage.from(bucket);
  return {
    async upload(path, content) {
      const { error } = await b().upload(path, new Blob([content], { type: 'text/plain' }), { upsert: false, contentType: 'text/plain' });
      // ya estaba (mismo contenido = misma ruta): no es un error
      if (error && !/exist|duplicate|409/i.test(`${error.message} ${error.statusCode || ''}`)) throw error;
    },
    async download(path) {
      const { data, error } = await b().download(path);
      if (error) throw error;
      return data.text();
    },
    async removeFolder(id) {
      const { data, error } = await b().list(id);
      if (error) throw error;
      if (data?.length) await b().remove(data.map((f) => `${id}/${f.name}`));
    },
  };
}
