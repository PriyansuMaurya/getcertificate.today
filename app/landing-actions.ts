'use server';

import { redirect } from 'next/navigation';
import { canonicalYouTubeUrl } from '@/utils/youtube';

export type StartFromVideoState = { message: string };

/**
 * Hero "start from a link" action.
 *
 * Validation lives on the server and reuses the same parser the learning flow
 * uses, so the hero can never accept a link the app would later reject. On
 * success the visitor is handed to /signup with the *canonical* watch URL in
 * the query string - derived from a validated 11-character ID rather than the
 * raw input - and that value is carried onward through onboarding to the
 * dashboard, so a paste made before signing up is never lost.
 */
export async function startFromVideo(
  _currentState: StartFromVideoState,
  formData: FormData
): Promise<StartFromVideoState> {
  const raw = formData.get('youtubeUrl');

  if (typeof raw !== 'string' || !raw.trim()) {
    return { message: 'Paste a YouTube link to get started.' };
  }

  const canonicalUrl = canonicalYouTubeUrl(raw);

  if (!canonicalUrl) {
    return {
      message: 'That does not look like a YouTube video link. Try a watch or youtu.be URL.',
    };
  }

  redirect(`/signup?video=${encodeURIComponent(canonicalUrl)}`);
}
