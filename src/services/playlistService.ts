import { supabase } from '../lib/supabase'
import type { Playlist } from '../types/database'

export async function fetchPlaylists(userId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_songs(count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as (Playlist & { playlist_songs: { count: number }[] })[]).map((p) => ({
    ...p,
    song_count: p.playlist_songs?.[0]?.count ?? 0
  }))
}

export async function createPlaylist(userId: string, name: string, description?: string) {
  const { data, error } = await supabase
    .from('playlists')
    .insert({ user_id: userId, name, description: description ?? null } as never)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updatePlaylist(id: string, patch: { name?: string; description?: string | null; cover_url?: string | null }) {
  const { data, error } = await supabase.from('playlists').update(patch as never).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function deletePlaylist(id: string) {
  const { error } = await supabase.from('playlists').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPlaylistDetails(playlistId: string) {
  const { data: playlist, error } = await supabase.from('playlists').select('*').eq('id', playlistId).single()
  if (error) throw error
  const { data: items, error: err2 } = await supabase
    .from('playlist_songs')
    .select('id, position, added_at, songs:song_id(*)')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true })
  if (err2) throw err2
  return { playlist: playlist as Playlist, items: (items ?? []) as unknown as { id: string; position: number; songs: import('../types/database').Song }[] }
}

export async function addSongToPlaylist(playlistId: string, songId: string) {
  const { data: existing } = await supabase
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
  const nextPos = ((existing?.[0] as { position: number | null } | undefined)?.position ?? -1) + 1
  const { error } = await supabase
    .from('playlist_songs')
    .insert({ playlist_id: playlistId, song_id: songId, position: nextPos } as never)
  if (error) throw error
}

export async function removeSongFromPlaylist(entryId: string) {
  const { error } = await supabase.from('playlist_songs').delete().eq('id', entryId)
  if (error) throw error
}
