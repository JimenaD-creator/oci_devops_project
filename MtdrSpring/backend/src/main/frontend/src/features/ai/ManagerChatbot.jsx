import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, IconButton, TextField, CircularProgress, MenuItem, Select, FormControl } from '@mui/material';
import { API_BASE } from '../sprints/constants/sprintConstants';
import { fetchDashboardSprints } from '../dashboard/dashboardSprintData';

// Icons as SVG components to avoid extra deps
const BotIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/>
    <line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L9.19 9.19 2 12l7.19 2.81L12 22l2.81-7.19L22 12l-7.19-2.81z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

// Renders markdown-lite: bold, bullets, line breaks
function MessageText({ text }) {
  const lines = text.split('\n');
  return (
    <Box component="span" sx={{ display: 'block' }}>
      {lines.map((line, i) => {
        const isBullet = /^[\*\-]\s/.test(line.trim());
        const cleaned = line.trim().replace(/^[\*\-]\s/, '');
        const parts = cleaned.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j}>{p}</strong> : p
        );
        return (
          <Box key={i} component="span" sx={{ display: 'block', pl: isBullet ? 1.5 : 0, position: 'relative' }}>
            {isBullet && (
              <Box component="span" sx={{ position: 'absolute', left: 0, color: '#E53935', fontWeight: 700 }}>•</Box>
            )}
            {rendered}
            {i < lines.length - 1 && !isBullet && line.trim() === '' && <Box component="span" sx={{ display: 'block', height: '0.4em' }} />}
          </Box>
        );
      })}
    </Box>
  );
}

export default function ManagerChatbot({ projectId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('all');
  const [hasUnread, setHasUnread] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load sprints for the selector
// ✅ Pon esto
useEffect(() => {
  const pid = projectId != null && String(projectId).trim() !== ''
    ? String(projectId).trim()
    : String(localStorage.getItem('currentProjectId') || '').trim();
  if (!pid) return;
  fetchDashboardSprints(pid, { forceFresh: true })
    .then(data => {
      const filtered = Array.isArray(data)
        ? data.filter(s => String(s.assignedProject?.id) === String(pid))
        : [];
      setSprints(filtered);
    })
    .catch(() => setSprints([]));
}, [projectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasUnread(false);
    }
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const pid = projectId || localStorage.getItem('currentProjectId');
      const body = {
        projectId: Number(pid),
        sprintId: selectedSprintId === 'all' ? null : Number(selectedSprintId),
        message: text,
        history,
      };

      const res = await fetch(`${API_BASE}/api/chat/manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const reply = data.error
        ? `⚠️ ${data.reply}`
        : data.reply;

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (!open) setHasUnread(true);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not connect to the server. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => setMessages([]);

  const suggestions = [
    'How many tasks did each developer complete?',
    'What tasks are still pending?',
    'Who has the most workload?',
    'Show me the sprint summary',
  ];

  return (
    <>
      {/* Floating button */}
      <Box sx={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1300 }}>
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Box
                onClick={() => setOpen(true)}
                sx={{
                  width: 56, height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #E53935 0%, #B71C1C 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(229,57,53,0.45)',
                  color: '#fff',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'scale(1.08)',
                    boxShadow: '0 6px 28px rgba(229,57,53,0.55)',
                  },
                  position: 'relative',
                }}
              >
                <BotIcon />
                {hasUnread && (
                  <Box sx={{
                    position: 'absolute', top: 6, right: 6,
                    width: 10, height: 10, borderRadius: '50%',
                    bgcolor: '#FFC107', border: '2px solid #fff',
                  }} />
                )}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat window */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ position: 'absolute', bottom: 0, right: 0, transformOrigin: 'bottom right' }}
            >
              <Box sx={{
                width: 380,
                height: 560,
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#FFFFFF',
                boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid rgba(229,57,53,0.12)',
              }}>

                {/* Header */}
                <Box sx={{
                  background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
                  px: 2.5, py: 1.75,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '10px',
                    background: 'linear-gradient(135deg, #E53935, #B71C1C)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(229,57,53,0.4)',
                  }}>
                    <BotIcon />
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }}>
                        Project Assistant
                      </Typography>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 0.4,
                        bgcolor: 'rgba(229,57,53,0.2)', borderRadius: '4px',
                        px: 0.6, py: 0.2,
                      }}>
                        <SparkIcon />
                        <Typography sx={{ color: '#E57373', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                          AI
                        </Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ color: '#888', fontSize: '0.7rem', mt: 0.1 }}>
                      Ask anything about your project
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {messages.length > 0 && (
                      <IconButton size="small" onClick={clearChat} sx={{ color: '#666', '&:hover': { color: '#E57373', bgcolor: 'rgba(229,57,53,0.1)' } }}>
                        <TrashIcon />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#666', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </Box>

                {/* Sprint selector */}
                <Box sx={{
                  px: 2, py: 1,
                  bgcolor: '#FAFAFA',
                  borderBottom: '1px solid #F0F0F0',
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#999', fontWeight: 600, flexShrink: 0 }}>
                    CONTEXT
                  </Typography>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <Select
                      value={selectedSprintId}
                      onChange={e => setSelectedSprintId(e.target.value)}
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#1A1A1A',
                        bgcolor: '#fff',
                        borderRadius: '8px',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E8E8E8' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#E53935' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#E53935', borderWidth: 1.5 },
                        '& .MuiSelect-select': { py: 0.75 },
                      }}
                    >
                      <MenuItem value="all" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        All sprints
                      </MenuItem>
                      {sprints.map(s => (
                        <MenuItem key={s.id} value={s.id} sx={{ fontSize: '0.75rem' }}>
                          Sprint {s.id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Messages */}
                <Box sx={{
                  flex: 1, overflowY: 'auto', px: 2, py: 1.5,
                  display: 'flex', flexDirection: 'column', gap: 1.5,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                  '&::-webkit-scrollbar-thumb': { bgcolor: '#E0E0E0', borderRadius: 2 },
                }}>

                  {/* Empty state with suggestions */}
                  {messages.length === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2, gap: 2 }}>
                      <Box sx={{
                        width: 52, height: 52, borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(229,57,53,0.12), rgba(183,28,28,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#E53935',
                      }}>
                        <BotIcon />
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1A1A1A', mb: 0.5 }}>
                          How can I help?
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#999', maxWidth: 260, mx: 'auto' }}>
                          Ask me about tasks, developers, sprint progress, or anything about your project.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%' }}>
                        {suggestions.map((s, i) => (
                          <Box
                            key={i}
                            onClick={() => setInput(s)}
                            sx={{
                              px: 1.5, py: 1,
                              borderRadius: '10px',
                              border: '1px solid #F0F0F0',
                              bgcolor: '#FAFAFA',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              color: '#555',
                              fontWeight: 500,
                              transition: 'all 0.15s',
                              '&:hover': {
                                bgcolor: '#FFF5F5',
                                borderColor: 'rgba(229,57,53,0.3)',
                                color: '#E53935',
                              },
                            }}
                          >
                            {s}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Chat messages */}
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Box sx={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        gap: 1,
                      }}>
                        {msg.role === 'assistant' && (
                          <Box sx={{
                            width: 26, height: 26, borderRadius: '8px', flexShrink: 0, mt: 0.25,
                            background: 'linear-gradient(135deg, #E53935, #B71C1C)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff',
                          }}>
                            <Box sx={{ transform: 'scale(0.7)' }}><BotIcon /></Box>
                          </Box>
                        )}
                        <Box sx={{
                          maxWidth: '78%',
                          px: 1.5, py: 1,
                          borderRadius: msg.role === 'user'
                            ? '14px 14px 4px 14px'
                            : '14px 14px 14px 4px',
                          bgcolor: msg.role === 'user'
                            ? 'linear-gradient(135deg, #E53935, #C62828)'
                            : '#F5F5F5',
                          background: msg.role === 'user'
                            ? 'linear-gradient(135deg, #E53935, #C62828)'
                            : '#F5F5F5',
                          color: msg.role === 'user' ? '#fff' : '#1A1A1A',
                          fontSize: '0.8rem',
                          lineHeight: 1.55,
                          boxShadow: msg.role === 'user'
                            ? '0 2px 8px rgba(229,57,53,0.25)'
                            : '0 1px 3px rgba(0,0,0,0.06)',
                        }}>
                          <MessageText text={msg.content} />
                        </Box>
                      </Box>
                    </motion.div>
                  ))}

                  {/* Loading indicator */}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Box sx={{
                          width: 26, height: 26, borderRadius: '8px', flexShrink: 0,
                          background: 'linear-gradient(135deg, #E53935, #B71C1C)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                        }}>
                          <Box sx={{ transform: 'scale(0.7)' }}><BotIcon /></Box>
                        </Box>
                        <Box sx={{
                          px: 1.5, py: 1, borderRadius: '14px 14px 14px 4px',
                          bgcolor: '#F5F5F5', display: 'flex', gap: 0.5, alignItems: 'center',
                        }}>
                          {[0, 1, 2].map(j => (
                            <Box key={j} sx={{
                              width: 6, height: 6, borderRadius: '50%', bgcolor: '#CCC',
                              animation: 'bounce 1.2s ease-in-out infinite',
                              animationDelay: `${j * 0.2}s`,
                              '@keyframes bounce': {
                                '0%, 80%, 100%': { transform: 'scale(0.8)', opacity: 0.5 },
                                '40%': { transform: 'scale(1.2)', opacity: 1 },
                              },
                            }} />
                          ))}
                        </Box>
                      </Box>
                    </motion.div>
                  )}

                  <div ref={bottomRef} />
                </Box>

                {/* Input area */}
                <Box sx={{
                  px: 2, py: 1.5,
                  borderTop: '1px solid #F0F0F0',
                  bgcolor: '#FAFAFA',
                  display: 'flex', gap: 1, alignItems: 'flex-end',
                }}>
                  <TextField
                    inputRef={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your project..."
                    multiline
                    maxRows={3}
                    fullWidth
                    size="small"
                    disabled={loading}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        bgcolor: '#fff',
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: '#E8E8E8' },
                        '&:hover fieldset': { borderColor: '#E53935' },
                        '&.Mui-focused fieldset': { borderColor: '#E53935', borderWidth: 1.5 },
                      },
                      '& .MuiInputBase-input': { py: 1 },
                    }}
                  />
                  <IconButton
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    sx={{
                      width: 38, height: 38, borderRadius: '12px', flexShrink: 0,
                      background: input.trim() && !loading
                        ? 'linear-gradient(135deg, #E53935, #C62828)'
                        : '#EEEEEE',
                      color: input.trim() && !loading ? '#fff' : '#BDBDBD',
                      transition: 'all 0.2s',
                      '&:hover': {
                        background: input.trim() && !loading
                          ? 'linear-gradient(135deg, #EF5350, #E53935)'
                          : '#EEEEEE',
                        transform: input.trim() && !loading ? 'scale(1.05)' : 'none',
                      },
                      '&.Mui-disabled': { background: '#EEEEEE', color: '#BDBDBD' },
                    }}
                  >
                    {loading ? <CircularProgress size={16} sx={{ color: '#999' }} /> : <SendIcon />}
                  </IconButton>
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </>
  );
}