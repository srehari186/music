import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { MusicPlayerProvider } from './contexts/MusicPlayerContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/Login/LoginPage'
import { SignupPage } from './pages/Signup/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPassword/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPassword/ResetPasswordPage'
import { HomePage } from './pages/Home/HomePage'
import { SearchPage } from './pages/Search/SearchPage'
import { LibraryPage } from './pages/Library/LibraryPage'
import { LikedSongsPage } from './pages/LikedSongs/LikedSongsPage'
import { PlaylistsPage } from './pages/Playlists/PlaylistsPage'
import { PlaylistDetailsPage } from './pages/PlaylistDetails/PlaylistDetailsPage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminDashboardPage } from './pages/admin/DashboardPage'
import { AdminSongsPage } from './pages/admin/SongsPage'
import { AddSongPage } from './pages/admin/AddSongPage'
import { EditSongPage } from './pages/admin/EditSongPage'
import { AdminUsersPage } from './pages/admin/UsersPage'

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="font-display text-6xl font-extrabold text-white/15">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Lost in the static?</h1>
        <p className="mt-1 text-sm text-white/55">That page doesn't exist.</p>
        <a href="/home" className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black">
          Back to Home
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MusicPlayerProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: '#1f0c0e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
            }}
          />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/liked" element={<LikedSongsPage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlist/:id" element={<PlaylistDetailsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute adminOnly>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/songs" element={<AdminSongsPage />} />
              <Route path="/admin/songs/new" element={<AddSongPage />} />
              <Route path="/admin/songs/:id/edit" element={<EditSongPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>

            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </MusicPlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
