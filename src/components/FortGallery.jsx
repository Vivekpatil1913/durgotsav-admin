import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUi } from "../context/UiContext.jsx";
import { api, apiError, assetUrl } from "../lib/api.js";
import { ImageUpload } from "./ui.jsx";

// Extra images shown on a fort's public page
export function FortGallery({ fortId }) {
  const { toast, confirm } = useUi();
  const [images, setImages] = useState([]);
  const load = useCallback(() => api.get(`/admin/forts/${fortId}/images`).then((r) => setImages(r.data.data)), [fortId]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(url) {
    if (!url) return;
    try {
      await api.post(`/admin/forts/${fortId}/images`, { image_path: url, sort_order: images.length });
      toast("Image added");
      load();
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  }
  async function caption(img, value) {
    if (value === (img.caption ?? "")) return;
    await api.put(`/admin/forts/${fortId}/images/${img.id}`, { caption: value });
    toast("Caption saved");
  }
  async function remove(img) {
    if (!(await confirm({ title: "Remove this image?", confirmLabel: "Remove" }))) return;
    await api.delete(`/admin/forts/${fortId}/images/${img.id}`);
    load();
  }

  return (
    <section className="fort-gallery">
      <h3 className="sub-title">Fort photo gallery</h3>
      <div className="fort-gallery__grid">
        {images.map((img) => (
          <figure key={img.id}>
            <img src={assetUrl(img.image_path)} alt={img.caption || ""} />
            <input className="input input--sm mr" defaultValue={img.caption ?? ""} placeholder="Caption" onBlur={(e) => caption(img, e.target.value)} aria-label="Caption" />
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(img)} aria-label="Remove image"><Trash2 size={14} /></button>
          </figure>
        ))}
        <ImageUpload value={null} folder="forts" label="Photo" onChange={add} />
      </div>
    </section>
  );
}
