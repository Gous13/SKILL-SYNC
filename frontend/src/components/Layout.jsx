import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { LogOut, User, LayoutDashboard, Users, Settings, BookOpen, Menu, X } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'

const Layout = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['messages-unread'],
    queryFn: async () => {
      const res = await api.get('/messages/unread-count')
      return res.data.unread_count || 0
    },
    enabled: !!user
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
    setMobileMenuOpen(false)
  }

  const handleLinkClick = () => {
    setMobileMenuOpen(false)
  }

  const getNavigationLinks = () => {
    if (user?.role === 'admin') {
      return [
        { path: '/admin', label: 'Admin Dashboard', icon: Settings },
        { path: '/mentor', label: 'Mentor View', icon: Users },
        { path: '/exam-mentor', label: 'Exam Control', icon: BookOpen },
        { path: '/dashboard', label: 'Student View', icon: LayoutDashboard },
        { path: '/exam', label: 'Take Exam', icon: BookOpen }
      ]
    } else if (user?.role === 'mentor') {
      return [
        { path: '/mentor', label: 'Mentor Dashboard', icon: Users },
        { path: '/exam-mentor', label: 'Exam Control', icon: BookOpen },
        { path: '/dashboard', label: 'Student View', icon: LayoutDashboard },
        { path: '/exam', label: 'Take Exam', icon: BookOpen }
      ]
    } else {
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/exam', label: 'Take Exam', icon: BookOpen }
      ]
    }
  }

  const currentPath = location.pathname

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/dashboard" className="flex items-center space-x-2 group" onClick={handleLinkClick}>
                <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <span className="text-white font-bold text-sm">SC</span>
                </div>
                <span className="text-xl font-bold text-gray-900">SKILLCREW</span>
              </Link>
              {/* Desktop Navigation */}
              <div className="hidden md:flex md:space-x-1">
                {getNavigationLinks().map((link) => {
                  const Icon = link.icon
                  const isActive = currentPath === link.path || currentPath.startsWith(link.path + '/')
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={(e) => {
                        // Ensure navigation works
                        if (e) {
                          handleLinkClick();
                        }
                      }}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-primary-50 text-primary-600'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <NotificationDropdown unreadCount={unreadCount} />
              <div className="hidden sm:flex items-center space-x-3 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-900">{user?.full_name || user?.email}</span>
                  <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="hidden sm:flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
              {/* Mobile Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex items-center justify-center p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {getNavigationLinks().map((link) => {
                const Icon = link.icon
                const isActive = currentPath === link.path || currentPath.startsWith(link.path + '/')
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={handleLinkClick}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {link.label}
                  </Link>
                )
              })}
              {/* Mobile User Info */}
              <div className="pt-3 mt-3 border-t border-gray-200">
                <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium text-gray-900">{user?.full_name || user?.email}</span>
                    <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
                  </div>
                </div>
              </div>
              {/* Mobile Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export default Layout
