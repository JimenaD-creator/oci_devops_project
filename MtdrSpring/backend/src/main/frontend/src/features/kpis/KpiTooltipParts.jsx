import React, { useId, useState } from 'react';
import { keyframes } from '@emotion/react';
import { Box, IconButton, Popover, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

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

/**
 * Single source of truth for KPI help text (used by KPI Analytics, gauge cards, etc.)
 */
export const KPI_TOOLTIPS = {
  completionRate: {
    what: 'Share of tasks in this sprint that are marked as Done, out of all tasks assigned to the sprint.',
    representation: 'Percentage from 0–100%.',
    formula: {
      type: 'fraction',
      label: 'Completion (%) =',
      numerator: 'tasks with status Done',
      denominator: 'all tasks in the sprint',
      suffix: '× 100',
    },
  },
  onTimeDelivery: {
    what: 'Share of completed tasks that were delivered on or before the due date.',
    representation: 'Percentage from 0–100%',
    formula: {
      type: 'fraction',
      label: 'On-time (%) =',
      numerator: 'completed on or before due date',
      denominator: 'completed tasks',
      suffix: '× 100',
    },
  },
  teamParticipation: {
    what: 'How logged hours compare to the estimated hours on tasks this sprint.',
    representation: 'Percentage from 0 to 100.',
    formula: {
      type: 'fraction',
      label: 'Participation (%) =',
      numerator: 'hours logged',
      denominator: 'planned hours on tasks',
      suffix: '× 100',
    },
  },
  workloadBalance: {
    what: 'How evenly tasks are distributed across team members who have assignments (more balanced is better).',
    representation:
      'Shown as a whole number from 0 to 100. Higher values mean a more even distribution.',
    formula: {
      type: 'plain',
      text: 'Derived from task counts per person in this sprint. Higher means work is spread more evenly across people with assignments.',
    },
  },
  productivityScore: {
    what: 'A combined score (0–100) that reflects sprint performance using the four sub-KPIs.',
    representation: 'Result is shown as a percentage, capped at 100%.',
    formula: {
      type: 'stack',
      parts: [
        { type: 'plain', text: 'Productivity (%) = weighted sum' },
        {
          type: 'plain',
          text: '(Completion × 40%) + (On-time × 30%) + (Participation × 20%) + (Workload balance × 10%)',
        },
      ],
    },
  },
};

/** MUI Tooltip: white panel + red border; use with `arrow` and `KpiTooltipBody` as `title` */
export const kpiMuiTooltipComponentsProps = {
  tooltip: { sx: tooltipChromeSx },
  arrow: { sx: tooltipArrowSx },
};

const kpiInfoNudge = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(199, 70, 52, 0.22);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 0 6px rgba(199, 70, 52, 0);
  }
`;

/**
 * Info (ℹ): default `placement="corner"` = top-right of a `position: 'relative'` card. Use
 * `placement="inline"` to sit the button next to a title. Opens a popover on **click** with the
 * same content as the rich KPI tooltips.
 */
export function KpiInfoCornerButton({
  bodyProps,
  id,
  ariaLabel,
  iconSize = '1.15rem',
  placement = 'corner',
}) {
  const [anchor, setAnchor] = useState(null);
  const reactId = useId();
  const baseId = id ?? `kpi-info-${reactId.replace(/:/g, '')}`;
  const open = Boolean(anchor);
  const isInline = placement === 'inline';

  return (
    <>
      <IconButton
        id={`${baseId}-trigger`}
        type="button"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setAnchor((prev) => (prev ? null : e.currentTarget));
        }}
        aria-label={ariaLabel ?? 'How this metric is calculated'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-popover` : undefined}
        sx={{
          zIndex: 2,
          p: isInline ? 0.4 : 0.6,
          color: TOOLTIP_OUTLINE_RED,
          flexShrink: 0,
          ...(isInline
            ? {
                position: 'relative',
                top: 0,
                right: 0,
                alignSelf: 'center',
                ml: 0.1,
                bgcolor: 'rgba(255, 255, 255, 0.96)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                border: '1px solid rgba(199, 70, 52, 0.22)',
                animation: `${kpiInfoNudge} 2.4s ease-in-out infinite`,
              }
            : {
                position: 'absolute',
                top: 6,
                right: 6,
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: '1px solid rgba(199, 70, 52, 0.28)',
                animation: `${kpiInfoNudge} 2.4s ease-in-out infinite`,
              }),
          transition: 'transform 0.12s ease, background-color 0.15s ease, box-shadow 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(199, 70, 52, 0.08)',
            boxShadow: '0 2px 8px rgba(199, 70, 52, 0.2)',
            animation: 'none',
            transform: isInline ? 'none' : 'scale(1.05)',
          },
          '&:active': {
            transform: 'scale(0.92)',
            animation: 'none',
          },
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: iconSize, display: 'block' }} />
      </IconButton>
      <Popover
        id={`${baseId}-popover`}
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={
          isInline
            ? { vertical: 'bottom', horizontal: 'left' }
            : { vertical: 'bottom', horizontal: 'right' }
        }
        transformOrigin={
          isInline
            ? { vertical: 'top', horizontal: 'left' }
            : { vertical: 'top', horizontal: 'right' }
        }
        disableScrollLock
        PaperProps={{
          sx: {
            bgcolor: tooltipChromeSx.bgcolor,
            color: tooltipChromeSx.color,
            maxWidth: 360,
            width: 'min(360px, calc(100vw - 32px))',
            border: tooltipChromeSx.border,
            borderRadius: '12px',
            boxShadow: '0 10px 32px rgba(0,0,0,0.12)',
            overflow: 'auto',
            maxHeight: 'min(70vh, 480px)',
          },
        }}
      >
        <Box
          role="region"
          aria-label={ariaLabel ?? 'KPI details'}
          sx={{ px: 1.5, py: 1.25, pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <KpiTooltipBody {...bodyProps} />
        </Box>
      </Popover>
    </>
  );
}
