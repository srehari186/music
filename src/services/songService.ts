import { supabase } from '../lib/supabase'
import type { Song } from '../types/database'

const PAGE_SIZE = 50

export async function fetchSongs(limit = PAGE_SIZE, offset = 0): Promise<Song[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data ?? []) as Song[]
}

export async function fetchFeaturedSongs(limit = 10): Promise<Song[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Song[]
}

export async function fetchPopularSongs(limit = 10): Promise<Song[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('play_count', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Song[]
}

export async function fetchRecentSongs(limit = 10): Promise<Song[]> {
  return fetchSongs(limit, 0)
}

export async function searchSongs(query: string, limit = 30): Promise<Song[]> {
  const q = query.trim()
  if (!q) return []
  // Server-side filtered search; never downloads the whole table.
  const like = `%${q}%`
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .or(`title.ilike.${like},artist.ilike.${like},album.ilike.${like},genre.ilike.${like}`)
    .order('play_count', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Song[]
}

export async function incrementPlayCount(songId: string): Promise<void> {
  // Read-modify-write is fine at this scale; a Postgres function could replace it later.
  const { data, error } = await supabase.from('songs').select('play_count').eq('id', songId).single()
  if (error) return
  const current = (data as { play_count: number | null } | null)?.play_count ?? 0
  await supabase.from('songs').update({ play_count: current + 1 } as never).eq('id', songId)
}

export async function recordRecentlyPlayed(userId: string, songId: string): Promise<void> {
  // Upsert-ish: remove older entries of same song then insert fresh (keeps history tidy).
  await supabase.from('recently_played').delete().eq('user_id', userId).eq('song_id', songId)
  await supabase.from('recently_played').insert({ user_id: userId, song_id: songId } as never)
  // Cap history at 100 entries
  const { data } = await supabase
    .from('recently_played')
    .select('id, played_at')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .range(100, 500)
  if (data && data.length > 0) {
    const ids = data.map((r: { id: string }) => r.id)
    await supabase.from('recently_played').delete().in('id', ids)
  }
}

// ---- Admin ----
export interface SongInput {
  title: string
  artist: string
  album?: string | null
  genre?: string | null
  description?: string | null
  cover_url?: string | null
  audio_url: string
  duration?: number | null
  release_year?: number | null
  featured?: boolean
}

export async function adminCreateSong(input: SongInput) {
  const { data, error } = await supabase.from('songs').insert(input as never).select('*').single()
  if (error) throw error
  return data
}

export async function adminUpdateSong(id: string, input: Partial<SongInput>) {
  const { data, error } = await supabase.from('songs').update(input as never).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function adminDeleteSong(id: string) {
  const { error } = await supabase.from('songs').delete().eq('id', id)
  if (error) throw error
}

// ---- Likes ----
export async function getLikedSongIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('liked_songs').select('song_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((r: { song_id: string }) => r.song_id))
}

export async function likeSong(userId: string, songId: string) {
  const { error } = await supabase.from('liked_songs').insert({ user_id: userId, song_id: songId } as never)
  if (error) throw error
}

export async function unlikeSong(userId: string, songId: string) {
  const { error } = await supabase.from('liked_songs').delete().eq('user_id', userId).eq('song_id', songId)
  if (error) throw error
}

export async function fetchLikedSongs(userId: string) {
  const { data, error } = await supabase
    .from('liked_songs')
    .select('id, created_at, songs:song_id(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as { id: string; created_at: string; songs: Song }[]
}

export async function fetchRecentlyPlayed(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('recently_played')
    .select('id, played_at, songs:song_id(*)')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as { id: string; played_at: string; songs: Song }[]
}

/**
 * Songs recommended for a given track: same artist first, then same genre,
 * topped up with most-played tracks. Never includes the song itself.
 */
export async function fetchRecommendedSongs(song: Song, limit = 12): Promise<Song[]> {
  const out: Song[] = []
  const seen = new Set<string>([song.id])
  const take = (rows: Song[] | null | undefined) => {
    for (const s of rows ?? []) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
      if (out.length >= limit) break
    }
  }
  try {
    if (song.artist) {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('artist', song.artist)
        .order('play_count', { ascending: false })
        .limit(limit)
      take((data ?? []) as Song[])
    }
    if (out.length < limit && song.genre) {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('genre', song.genre)
        .order('play_count', { ascending: false })
        .limit(limit)
      take((data ?? []) as Song[])
    }
    if (out.length < limit) {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .order('play_count', { ascending: false })
        .limit(limit)
      take((data ?? []) as Song[])
    }
  } catch {
    /* recommendations are best-effort */
  }
  return out
}

export interface AlbumOption {
  name: string
  artist: string
  coverUrl: string | null
  count: number
}

/** Distinct albums in the catalog (for the "add into existing album" picker). */
export async function fetchAlbumList(limit = 500): Promise<AlbumOption[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('album, artist, cover_url')
    .not('album', 'is', null)
    .order('album', { ascending: true })
    .limit(limit)
  if (error) throw error
  const map = new Map<string, AlbumOption>()
  for (const r of (data ?? []) as { album: string | null; artist: string | null; cover_url: string | null }[]) {
    const name = (r.album ?? '').trim()
    if (!name) continue
    const artist = (r.artist ?? '').trim()
    const key = `${artist.toLowerCase()}|||${name.toLowerCase()}`
    const existing = map.get(key)
    if (existing) {
      existing.count++
      if (!existing.coverUrl && r.cover_url) existing.coverUrl = r.cover_url
    } else {
      map.set(key, { name, artist, coverUrl: r.cover_url, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
