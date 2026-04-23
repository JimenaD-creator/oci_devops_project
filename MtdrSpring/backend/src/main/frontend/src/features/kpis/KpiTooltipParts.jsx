import React from 'react';
import { Box, Typography } from '@mui/material';

/** Oracle red — tooltip outline */
export const TOOLTIP_OUTLINE_RED = '#C74634';

export const TOOLTIP_TEXT = '#424242';
export const TOOLTIP_CALC = '#1565C0';

/** MUI Tooltip `componentsProps.tooltip.sx` + rounded red border */
export const tooltipChromeSx = {
  bgcolor: '#FFFFFF',
  color: TOOLTIP_TEXT,
  maxWidth: 340,
  border: `2px solid ${TOOLTIP_OUTLINE_RED}`,
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
  px: 1.5,
  py: 1.25,
};

export const tooltipArrowSx = {
  color: '#FFFFFF',
  '&::before': {
    border: `2px solid ${TOOLTIP_OUTLINE_RED}`,
    backgroundColor: '#FFFFFF',
  },
};

function FormulaFraction({ label, numerator, denominator, suffix }) {
  return (
    <Box sx={{ color: TOOLTIP_CALC, textAlign: 'center' }}>
      {label ? (
        <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.75 }}>{label}</Typography>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.45 }}>
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            lineHeight: 1.35,
            px: 0.5,
          }}
        >
          {numerator}
        </Typography>
        <Box
          sx={{
            width: '100%',
            maxWidth: 280,
            height: 2,
            bgcolor: TOOLTIP_CALC,
            borderRadius: 1,
            opacity: 0.9,
          }}
        />
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            lineHeight: 1.35,
            px: 0.5,
          }}
        >
          {denominator}
        </Typography>
      </Box>
      {suffix ? (
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mt: 0.65 }}>{suffix}</Typography>
      ) : null}
    </Box>
  );
}

function FormulaPlain({ text }) {
  return (
    <Typography
      component="div"
      variant="caption"
      sx={{
        color: TOOLTIP_CALC,
        fontWeight: 600,
        fontSize: '0.8125rem',
        textAlign: 'center',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit',
      }}
    >
      {text}
    </Typography>
  );
}

/**
 * @param {{ type: 'fraction', label?: string, numerator: string, denominator: string, suffix?: string } | { type: 'plain', text: string } | { type: 'stack', parts: object[] }} formula
 * @param {boolean} [nested] — inner items in a stack (no extra top margin)
 */
export function TooltipFormula({ formula, nested }) {
  if (!formula) return null;
  if (formula.type === 'stack') {
    return (
      <Box
        sx={{
          mt: nested ? 0 : 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.35,
        }}
      >
        {formula.parts.map((part, i) => (
          <TooltipFormula key={i} formula={part} nested />
        ))}
      </Box>
    );
  }
  if (formula.type === 'fraction') {
    return (
      <Box sx={{ mt: nested ? 0 : 1.25 }}>
        <FormulaFraction {...formula} />
      </Box>
    );
  }
  if (formula.type === 'plain') {
    return (
      <Box sx={{ mt: nested ? 0 : 1.25 }}>
        <FormulaPlain text={formula.text} />
      </Box>
    );
  }
  return null;
}

export function KpiTooltipBody({ what, representation, formula }) {
  return (
    <Box sx={{ maxWidth: 300 }}>
      <Typography
        variant="caption"
        component="div"
        sx={{ display: 'block', lineHeight: 1.5, fontSize: '0.8125rem', color: TOOLTIP_TEXT }}
      >
        {what}
      </Typography>
      {representation ? (
        <Typography
          variant="caption"
          component="div"
          sx={{
            display: 'block',
            mt: 1,
            lineHeight: 1.5,
            fontSize: '0.8125rem',
            color: TOOLTIP_TEXT,
          }}
        >
          {representation}
        </Typography>
      ) : null}
      <TooltipFormula formula={formula} />
    </Box>
  );
}
