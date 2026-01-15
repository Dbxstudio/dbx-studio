import { Moon, Sun, Globe, Sparkles } from 'lucide-react'
import './settings-page.css'

interface SettingsPageProps {
    isDarkTheme?: boolean
    onToggleTheme?: () => void
}

export function SettingsPage({ isDarkTheme = true, onToggleTheme }: SettingsPageProps) {
    return (
        <div className="settings-page dark">
            <div className="settings-container">
                <h1 className="settings-title">Settings</h1>

                {/* Appearance */}
                <div className="settings-section">
                    <h2 className="section-title">Appearance</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <div className="setting-icon">
                                {isDarkTheme ? <Moon size={18} /> : <Sun size={18} />}
                            </div>
                            <div className="setting-text">
                                <span className="setting-label">Theme</span>
                                <span className="setting-desc">Switch between light and dark themes</span>
                            </div>
                        </div>
                        <button className="toggle-btn" onClick={onToggleTheme}>
                            {isDarkTheme ? 'Dark' : 'Light'}
                        </button>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <div className="setting-icon">
                                <Globe size={18} />
                            </div>
                            <div className="setting-text">
                                <span className="setting-label">Language</span>
                                <span className="setting-desc">Choose your preferred language</span>
                            </div>
                        </div>
                        <select className="setting-select">
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                        </select>
                    </div>
                </div>

                {/* AI Settings */}
                <div className="settings-section">
                    <h2 className="section-title">AI Assistant</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <div className="setting-icon">
                                <Sparkles size={18} />
                            </div>
                            <div className="setting-text">
                                <span className="setting-label">AI Provider</span>
                                <span className="setting-desc">Select your AI provider for SQL generation</span>
                            </div>
                        </div>
                        <select className="setting-select">
                            <option value="openai">OpenAI GPT-4</option>
                            <option value="anthropic">Claude 3</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </div>
                </div>

                {/* About */}
                <div className="settings-section">
                    <h2 className="section-title">About</h2>

                    <div className="about-card">
                        <div className="about-logo">
                            <span className="logo-icon">🗄️</span>
                            <span className="logo-text">DBX Studio</span>
                        </div>
                        <div className="about-info">
                            <p>Version 0.0.1</p>
                            <p className="about-desc">
                                A modern database client with AI-powered SQL assistance.
                                Built with React, oRPC, and Drizzle ORM.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
