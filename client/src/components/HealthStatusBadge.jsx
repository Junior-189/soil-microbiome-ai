import React from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  HEALTHY:  { label: 'Healthy',  icon: CheckCircle,  bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  AT_RISK:  { label: 'At Risk',  icon: AlertTriangle, bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  DISEASED: { label: 'Diseased', icon: AlertCircle,  bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  CRITICAL: { label: 'Critical', icon: XCircle,      bg: 'bg-red-100',    text: 'text-red-700',   border: 'border-red-300' },
};

export default function HealthStatusBadge({ status, size = 'md' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AT_RISK;
  const Icon = cfg.icon;
  const sz = size === 'lg' ? 'text-lg px-4 py-2 gap-2' : size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-3 py-1 gap-1.5';
  const iconSz = size === 'lg' ? 22 : size === 'sm' ? 12 : 16;

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${cfg.bg} ${cfg.text} ${cfg.border} ${sz}`}>
      <Icon size={iconSz} />
      {cfg.label}
    </span>
  );
}
