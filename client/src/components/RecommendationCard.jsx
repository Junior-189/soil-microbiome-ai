import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Droplets, Beaker, Leaf, RotateCcw, Bug, Sprout } from 'lucide-react';

const SEVERITY_STYLES = {
  LOW:      { border: 'border-l-blue-400',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
  MEDIUM:   { border: 'border-l-yellow-400', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  HIGH:     { border: 'border-l-orange-400', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
  CRITICAL: { border: 'border-l-red-500',    bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700' },
};

const CATEGORY_ICONS = {
  FERTILIZER:           Sprout,
  MICROBIAL_AMENDMENT:  Beaker,
  IRRIGATION:           Droplets,
  CROP_ROTATION:        RotateCcw,
  PEST_DISEASE:         Bug,
  SOIL_HEALTH:          Leaf,
};

export default function RecommendationCard({ recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const [doneItems, setDoneItems] = useState({});

  const s = SEVERITY_STYLES[recommendation.severity] || SEVERITY_STYLES.MEDIUM;
  const Icon = CATEGORY_ICONS[recommendation.category] || Leaf;
  const items = Array.isArray(recommendation.actionItems) ? recommendation.actionItems : [];

  const toggleDone = (i) => setDoneItems((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className={`border-l-4 rounded-r-xl border border-l-4 ${s.border} ${s.bg} p-4 transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-1.5 rounded-lg ${s.badge} mt-0.5`}>
            <Icon size={16} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-800 text-sm">{recommendation.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>
                {recommendation.severity}
              </span>
              {recommendation.category && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {recommendation.category?.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{recommendation.description}</p>
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>

      {expanded && items.length > 0 && (
        <ul className="mt-3 ml-9 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <button
                onClick={() => toggleDone(i)}
                className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs
                  ${doneItems[i] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'}`}
              >
                {doneItems[i] && '✓'}
              </button>
              <span className={`text-sm leading-snug ${doneItems[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
