import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchMemories, signMemoryUrls, type Participant, type Plan } from "@/lib/plans";

interface Props {
  plan: Plan;
  me: Participant | null;
}

export function MemoriesTab({ plan, me }: Props) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data: memories = [] } = useQuery({
    queryKey: ["memories", plan.id],
    queryFn: () => fetchMemories(plan.id),
  });

  useEffect(() => {
    if (memories.length === 0) {
      setUrls({});
      return;
    }
    let active = true;
    signMemoryUrls(memories.map((m) => m.storage_path))
      .then((map) => {
        if (active) setUrls(map);
      })
      .catch((err) => console.error(err));
    return () => {
      active = false;
    };
  }, [memories]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || !me) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} är större än 50 MB`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${plan.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("memories")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error } = await supabase.from("memories").insert({
          plan_id: plan.id,
          participant_id: me.id,
          uploader_name: me.name,
          storage_path: path,
          media_type: file.type.startsWith("video") ? "video" : "image",
        });
        if (error) throw error;
      }
      toast.success("Minnen uppladdade");
      void queryClient.invalidateQueries({ queryKey: ["memories", plan.id] });
    } catch (err) {
      console.error(err);
      toast.error("Uppladdningen misslyckades");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string, path: string) {
    await supabase.storage.from("memories").remove([path]);
    const { error } = await supabase.from("memories").delete().eq("id", id);
    if (error) {
      toast.error("Kunde inte ta bort minnet");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["memories", plan.id] });
  }

  return (
    <div className="space-y-6">
      <label className="card-surface flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-8 text-center transition-colors hover:border-primary">
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : (
          <ImagePlus className="size-6 text-primary" />
        )}
        <p className="font-display font-semibold">Ladda upp bilder & korta videor</p>
        <p className="text-sm text-muted-foreground">
          Dra in filer eller klicka här – allt samlas i sällskapets minnesbank.
        </p>
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          disabled={uploading || !me}
          onChange={(e) => void upload(e.target.files)}
        />
      </label>

      {memories.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Minnesbanken är tom – än.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {memories.map((m) => (
            <li key={m.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
              {m.media_type === "video" ? (
                <video src={urls[m.storage_path]} controls className="aspect-square w-full object-cover" />
              ) : (
                <img
                  src={urls[m.storage_path]}
                  alt={m.caption ?? `Minne uppladdat av ${m.uploader_name}`}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              )}
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-xs text-muted-foreground">{m.uploader_name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Ta bort minne"
                  onClick={() => void remove(m.id, m.storage_path)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
