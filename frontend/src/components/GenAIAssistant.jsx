import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react'
import { aiAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function GenAIAssistant() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi there! I can help you query student data. Ask me things like "Which students are high risk?" or "What is the overall success rate of our interventions?"' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const res = await aiAPI.query(userMessage)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the AI service. Ensure GEMINI_API_KEY is configured on the backend.' }])
    } finally {
      setIsLoading(false)
    }
  }

  // Only render if user is logged in
  if (!user) return null

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        className="genai-fab"
        onClick={() => setIsOpen(true)}
        initial={{ scale: 0 }}
        animate={{ scale: isOpen ? 0 : 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare size={24} color="#fff" />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="genai-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="genai-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: 'var(--accent)', padding: 6, borderRadius: 8 }}>
                  <Bot size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Data Assistant</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Powered by Gemini</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setIsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="genai-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`genai-msg-row ${msg.role}`}>
                  <div className={`genai-avatar ${msg.role}`}>
                    {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`genai-bubble ${msg.role}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="genai-msg-row assistant">
                  <div className="genai-avatar assistant">
                    <Bot size={14} />
                  </div>
                  <div className="genai-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={14} className="spinning" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="genai-input-area">
              <input
                className="input"
                placeholder="Ask about students..."
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={isLoading}
                style={{ borderRadius: 20, paddingRight: 40 }}
              />
              <button 
                type="submit" 
                className="genai-send-btn"
                disabled={!input.trim() || isLoading}
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .genai-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: linear-gradient(135deg, var(--accent), #3B82F6);
          border: none;
          box-shadow: 0 8px 24px rgba(20, 184, 166, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .genai-panel {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 360px;
          height: 500px;
          max-height: calc(100vh - 48px);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          z-index: 1000;
          overflow: hidden;
        }

        .genai-header {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-elevated);
        }

        .genai-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .genai-msg-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .genai-msg-row.user {
          flex-direction: row-reverse;
        }

        .genai-avatar {
          width: 28px;
          height: 28px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .genai-avatar.assistant {
          background: rgba(20, 184, 166, 0.1);
          color: var(--accent);
        }

        .genai-avatar.user {
          background: rgba(99, 102, 241, 0.1);
          color: #6366F1;
        }

        .genai-bubble {
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.5;
          max-width: 80%;
        }

        .genai-bubble.assistant {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }

        .genai-bubble.user {
          background: var(--accent);
          color: #fff;
          border-bottom-right-radius: 4px;
        }

        .genai-input-area {
          padding: 16px;
          border-top: 1px solid var(--border);
          position: relative;
        }

        .genai-send-btn {
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--accent);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .genai-send-btn:disabled {
          color: var(--text-muted);
          cursor: not-allowed;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </>
  )
}
