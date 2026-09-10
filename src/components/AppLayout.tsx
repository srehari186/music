import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { AudioPlayer } from './AudioPlayer/AudioPlayer'
import { useMusicPlayer } from '../contexts/MusicPlayerContext'

export function AppLayout() {
  const { currentSong } = useMusicPlayer()
  const hasPlayer = Boolean(currentSong)
  return (
    <div className="flex min-h-screen min-h-dvh">
      <Sidebar />
      <div className="flex min-h-screen min-h-dvh flex-1 flex-col">
        <main className={`mx-auto w-full max-w-7xl flex-1 px-4 pb-40 pt-4 md:px-8 md:pt-8 ${hasPlayer ? '' : 'pb-24'}`}>
          <Outlet />
        </main>
      </div>
      <AudioPlayer />
      <MobileNavigation />
    </div>
  )
}
