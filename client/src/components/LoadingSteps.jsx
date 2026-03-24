import React from 'react';
import { CheckCircle, Loader } from 'lucide-react';

export default function LoadingSteps({ steps = [], currentStep = 0, isComplete = false }) {
  return (
    <div className="space-y-3 py-2">
      {steps.map((step, i) => {
        const done = isComplete || i < currentStep;
        const active = !isComplete && i === currentStep;
        return (
          <div key={i} className={`flex items-center gap-3 transition-all ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-30'}`}>
            <div className="flex-shrink-0">
              {done
                ? <CheckCircle size={18} className="text-green-500" />
                : active
                ? <Loader size={18} className="text-primary-500 animate-spin" />
                : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300" />
              }
            </div>
            <span className={`text-sm ${active ? 'font-semibold text-gray-800' : done ? 'text-gray-500' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
        );
      })}
      {isComplete && (
        <div className="flex items-center gap-2 mt-2 text-green-600 font-semibold text-sm">
          <CheckCircle size={18} />
          Complete!
        </div>
      )}
    </div>
  );
}
