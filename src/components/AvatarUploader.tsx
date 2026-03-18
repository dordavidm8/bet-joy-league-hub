import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "@/lib/firebase";
import { X, Upload } from "lucide-react";

interface Area { x: number; y: number; width: number; height: number; }

interface Props {
  onDone: (url: string) => void;
  onCancel: () => void;
}

// Draw cropped area onto a canvas and return a Blob
async function getCroppedBlob(imageSrc: string, croppedArea: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.addEventListener("load", () => res(img));
    img.addEventListener("error", rej);
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const size = 300;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    croppedArea.x, croppedArea.y, croppedArea.width, croppedArea.height,
    0, 0, size, size
  );
  return new Promise((res, rej) =>
    canvas.toBlob((blob) => (blob ? res(blob) : rej(new Error("canvas empty"))), "image/jpeg", 0.9)
  );
}

export default function AvatarUploader({ onDone, onCancel }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    setError("");
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const uid = auth.currentUser?.uid ?? "anonymous";
      const storageRef = ref(storage, `avatars/${uid}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(storageRef);
      onDone(url);
    } catch (err: any) {
      setError("העלאה נכשלה: " + (err.message || "שגיאה"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5" onClick={onCancel}>
      <div
        className="w-full max-w-sm bg-card rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">שנה תמונת פרופיל</h3>
          <button onClick={onCancel}><X size={20} className="text-muted-foreground" /></button>
        </div>

        {!imageSrc ? (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl py-10 text-muted-foreground hover:border-primary/50 transition-colors"
            >
              <Upload size={28} />
              <span className="text-sm font-medium">בחר תמונה מהמכשיר</span>
              <span className="text-xs">JPG, PNG, WEBP עד 5MB</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </>
        ) : (
          <>
            <div className="relative w-full h-64 bg-black rounded-xl overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-8">זום</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-green-500"
              />
            </div>

            {error && <p className="text-xs text-destructive text-center">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setImageSrc(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium"
              >
                בחר אחרת
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
              >
                {uploading ? "מעלה..." : "שמור תמונה"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
