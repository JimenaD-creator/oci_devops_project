import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useGeminiAiStatus } from '../ai/useGeminiAiStatus';
import { getErrorMessage } from '../ai/aiInsightsConstants';
import { fetchDeveloperPerformanceSummary } from './developerPerformanceApi';

export default function DeveloperPerformanceNarrative({ sprintId, userId, userName }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { loading: aiStatusLoading, blocked, message: aiStatusMessage } = useGeminiAiStatus();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [warning, setWarning] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [error, setError] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const sid = Number(sprintId);
    const uid = Number(userId);

    if (!Number.isFinite(sid) || !Number.isFinite(uid)) {
      setSummary('');
      setError('');
      setWarning('');
      setErrorDetail('');
      setEmptyMessage('');
      return () => {
        cancelled = true;
      };
    }

    if (aiStatusLoading) return () => {
      cancelled = true;
    };

    if (blocked) {
      setSummary('');
      setError('');
      setWarning('');
      setErrorDetail('');
      setEmptyMessage('');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError('');
    setWarning('');
    setErrorDetail('');
    setSummary('');
    setEmptyMessage('');

    fetchDeveloperPerformanceSummary(sid, uid)
      .then((data) => {
        if (cancelled) return;
        const text = String(data.summary ?? '').trim();
        setSummary(text);
        setEmptyMessage(text ? '' : String(data.message ?? '').trim());
        setWarning(data.warning ?? '');
        setErrorDetail(data.errorDetail ?? '');
      })
      .catch((e) => {
        if (cancelled) return;
        const code = e?.payload?.error;
        const msg =
          e?.payload?.message ??
          (code ? getErrorMessage(code) : null) ??
          e?.message ??
          'Could not load your AI performance summary.';
        setError(msg);
        setSummary('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sprintId, userId, aiStatusLoading, blocked]);

  const borderColor = isDark ? '#2A2C32' : '#ECECEC';

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 320,
        p: 2.5,
        borderRadius: 2,
        border: `1px solid ${borderColor}`,
        bgcolor: isDark ? '#1C1E22' : '#FAFAFA',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <AutoAwesomeIcon sx={{ color: '#C74634', fontSize: 22 }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary' }}>
          AI performance insight
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
        Personalized summary for {userName || 'you'} in this sprint, compared with your team.
      </Typography>

      {aiStatusLoading || loading ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <CircularProgress size={32} sx={{ color: '#C74634' }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            Generating your performance summary…
          </Typography>
        </Box>
      ) : blocked ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {aiStatusMessage || 'AI is not available. Contact your administrator.'}
        </Alert>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {!summary && !warning && !error ? (
            <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>
              {emptyMessage || 'No summary available for this sprint yet.'}
            </Typography>
          ) : null}
          {warning ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {warning}
              {errorDetail ? (
                <Typography component="div" sx={{ mt: 1, fontSize: '0.78rem', opacity: 0.9 }}>
                  {errorDetail}
                </Typography>
              ) : null}
            </Alert>
          ) : null}
          {summary ? (
            <Typography
              component="div"
              sx={{
                fontSize: '0.92rem',
                lineHeight: 1.65,
                color: 'text.primary',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary}
            </Typography>
          ) : null}
        </Box>
      )}
    </Paper>
  );
}
