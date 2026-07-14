import { supabase } from './supabase';

export async function uploadTaskPhoto(roomId: string, localUri: string): Promise<string> {
  const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer());
  const ext = localUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const path = `${roomId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from('task-photos').upload(path, arraybuffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('task-photos').getPublicUrl(path);
  return data.publicUrl;
}
