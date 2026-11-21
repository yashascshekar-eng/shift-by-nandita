'use client';
// Upload Nandita's own clip for an exercise straight to storage, then save it on the exercise.
import { useState } from 'react';
import { setExerciseVideo, videoUploadUrl } from '../actions';

export function VideoUpload({ exerciseId, hasVideo }: { exerciseId: string; hasVideo: boolean }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setMsg('That video is over 50 MB. Trim it to under 15 seconds and try again.');
    setBusy(true); setMsg('Uploading…');
    try {
      const u = await videoUploadUrl(exerciseId, file.type);
      if (!u.url || !u.path) throw new Error(u.error);
      const res = await fetch(u.url, { method: 'PUT', body: file, headers: { 'content-type': file.type } });
      if (!res.ok) throw new Error('Upload failed. Check your connection and try again.');
      setMsg((await setExerciseVideo(exerciseId, u.path)).message);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : 'Upload failed.');
    } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="f">{hasVideo ? 'Replace your video' : 'Upload your own video (5–15 s, phone is fine)'}
        <input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {hasVideo && <button type="button" className="linkbtn small" disabled={busy} onClick={async () => setMsg((await setExerciseVideo(exerciseId, null)).message)}>Remove video, use the animation</button>}
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
