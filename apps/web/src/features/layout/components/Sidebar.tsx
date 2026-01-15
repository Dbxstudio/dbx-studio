import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    Database,
    MessageSquare,
    PanelLeftOpen,
    LogOut,
} from 'lucide-react'
import './sidebar.css'

interface SidebarProps {
    currentView: 'collections' | 'settings-page'
    setView: (view: 'collections' | 'settings-page') => void
    isAIChatOpen: boolean
    onToggleAIChat: () => void
    isSchemaTreeVisible: boolean
    onToggleSchemaTree: () => void
    userInfo?: { name?: string; first_name?: string; last_name?: string; email: string; profile_pic_url?: string } | null
    onLogout?: () => void
}

export function Sidebar({
    currentView,
    setView,
    isAIChatOpen,
    onToggleAIChat,
    isSchemaTreeVisible,
    onToggleSchemaTree,
    userInfo,
    onLogout,
}: SidebarProps) {
    const [showUserMenu, setShowUserMenu] = useState(false)
    const userBtnRef = useRef<HTMLDivElement>(null)

    const handleProfileClick = () => {
        setShowUserMenu(prev => !prev)
    }

    // Close menu when clicking outside
    const handleClickOutside = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.user-menu-popup') && !target.closest('.sidebar-profile')) {
            setShowUserMenu(false)
        }
    }, [])

    // Effect for click outside - properly using useEffect
    useEffect(() => {
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showUserMenu, handleClickOutside])

    return (
        <div className="dbx-sidebar dark">

            {/* Collections (Workspace) */}
            <SidebarItem
                icon={<Database size={20} />}
                tooltip="Collections - Manage your database connections"
                isActive={currentView === 'collections' && !isAIChatOpen}
                onClick={() => {
                    setView('collections')
                    if (isAIChatOpen) onToggleAIChat()
                }}
            />

            {/* AI Chat */}
            <SidebarItem
                icon={<MessageSquare size={20} />}
                tooltip="AI Chat - Open AI assistant"
                isActive={isAIChatOpen}
                onClick={() => {
                    if (currentView !== 'collections') {
                        setView('collections')
                    }
                    onToggleAIChat()
                }}
            />

            {/* Schema Tree Expand Button - Only show when hidden */}
            {currentView === 'collections' && !isSchemaTreeVisible && (
                <SidebarItem
                    icon={<PanelLeftOpen size={20} />}
                    tooltip="Show Schema Tree"
                    isActive={false}
                    onClick={onToggleSchemaTree}
                />
            )}

            <div className="sidebar-spacer" />

            {/* Profile */}
            {userInfo && (
                <div className="sidebar-profile" ref={userBtnRef}>
                    <div
                        className="profile-icon-container"
                        onClick={handleProfileClick}
                        title={userInfo.email}
                    >
                        {userInfo.profile_pic_url ? (
                            <img
                                src={userInfo.profile_pic_url}
                                alt="Profile"
                                className="profile-icon profile-image"
                            />
                        ) : (
                            <div className="profile-icon">
                                {(userInfo.first_name || userInfo.name || userInfo.email).charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* User Menu Popup */}
            {showUserMenu && userInfo && createPortal(
                <div className="user-menu-popup dark">
                    <div className="user-menu-header">
                        <div className="user-name">
                            {userInfo.first_name} {userInfo.last_name || userInfo.name}
                        </div>
                        <div className="user-email">{userInfo.email}</div>
                    </div>
                    <div className="user-menu-divider" />
                    <div
                        className="user-menu-item"
                        onClick={() => {
                            setShowUserMenu(false)
                            onLogout?.()
                        }}
                    >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

// SidebarItem Component
interface SidebarItemProps {
    icon: React.ReactNode
    tooltip: string
    isActive: boolean
    onClick: () => void
}

function SidebarItem({ icon, tooltip, isActive, onClick }: SidebarItemProps) {
    const [showTooltip, setShowTooltip] = useState(false)
    const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 })
    const ref = useRef<HTMLDivElement>(null)

    const handleMouseEnter = () => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setTooltipPos({
                left: 60,
                top: rect.top + rect.height / 2,
            })
        }
        setShowTooltip(true)
    }

    return (
        <div
            ref={ref}
            className={`sidebar-item dark ${isActive ? 'active' : ''}`}
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShowTooltip(false)}
            role="button"
            tabIndex={0}
        >
            {icon}
            {showTooltip && createPortal(
                <div
                    className="sidebar-tooltip"
                    style={{
                        left: tooltipPos.left,
                        top: tooltipPos.top,
                        transform: 'translateY(-50%)',
                    }}
                >
                    {tooltip}
                </div>,
                document.body
            )}
        </div>
    )
}
