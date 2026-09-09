export type UserRole = 'user' | 'admin'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Song {
  id: string
  title: string
  artist: string | null
  album: string | null
  genre: string | null
  description: string | null
  cover_url: string | null
  audio_url: string
  duration: number | null
  release_year: number | null
  featured: boolean
  play_count: number
  created_at: string
  updated_at: string
}

export interface LikedSong {
  id: string
  user_id: string
  song_id: string
  created_at: string
  songs?: Song
}

export interface Playlist {
  id: string
  user_id: string
  name: string
  description: string | null
  cover_url: string | null
  created_at: string
  updated_at: string
  playlist_songs?: PlaylistSong[]
  song_count?: number
}

export interface PlaylistSong {
  id: string
  playlist_id: string
  song_id: string
  position: number | null
  added_at: string
  songs?: Song
}

export interface RecentlyPlayed {
  id: string
  user_id: string
  song_id: string
  played_at: string
  songs?: Song
}

// Minimal Database type for supabase-js generics
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      songs: { Row: Song; Insert: Partial<Song>; Update: Partial<Song> }
      liked_songs: { Row: LikedSong; Insert: Partial<LikedSong>; Update: Partial<LikedSong> }
      playlists: { Row: Playlist; Insert: Partial<Playlist>; Update: Partial<Playlist> }
      playlist_songs: { Row: PlaylistSong; Insert: Partial<PlaylistSong>; Update: Partial<PlaylistSong> }
      recently_played: { Row: RecentlyPlayed; Insert: Partial<RecentlyPlayed>; Update: Partial<RecentlyPlayed> }
    }
  }
}
