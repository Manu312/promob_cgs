import { useEffect, useState } from 'react';

// Agregar a favoritos (Promob, asistente de Módulos favoritos): nombre, descripción, grupo e
// imagen (la vista actual, achicada). Guarda los módulos seleccionados tal como están.
export default function FavoriteDialog({ count, groups, capture, onSave, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [group, setGroup] = useState(groups[0] || 'General');
  const [image, setImage] = useState(null);
  useEffect(() => { // miniatura: la vista actual a 200 px de ancho
    const url = capture?.();
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const w = 200, h = Math.round((img.height / img.width) * w);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      setImage(c.toDataURL('image/jpeg', 0.75));
    };
    img.src = url;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog favorite-dialog" role="dialog" aria-label="Agregar a favoritos">
        <h3>Agregar a favoritos</h3>
        <p className="hint">{count === 1 ? 'Se guarda el módulo con sus medidas, agregados y materiales.' : `Se guardan los ${count} módulos seleccionados como un conjunto.`}</p>
        {image && <img className="fav-preview" src={image} alt="" />}
        <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="field"><span>Descripción</span><textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="field"><span>Grupo</span><input list="fav-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
          <datalist id="fav-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></label>
        <div className="row-btns">
          <button onClick={onClose}>Cancelar</button>
          <button className="active" disabled={!name.trim()} onClick={() => { onSave({ name, desc, group, image }); onClose(); }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
