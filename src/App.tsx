import React from 'react';
import { JewfrenBubbleWidget } from './components/JewfrenBubbleWidget';

export default function App() {
  return (
    <div className="relative min-h-screen w-full bg-[#FAF8F5] text-stone-900 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Subtle warm background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-200/25 rounded-full blur-3xl pointer-events-none" />

      {/* Center preview placeholder simulating any host page/storefront without cluttered mock hero content */}
      <div className="max-w-md w-full text-center space-y-3 z-10 select-none">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 to-rose-400 mx-auto flex items-center justify-center text-3xl shadow-lg">
          💛
        </div>
        <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
          Jewfren Live Speech-to-Speech
        </h1>
        <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
          Voice-only companion widget. Tap the floating bubble in the corner to start a live voice call with Jewfren.
        </p>
      </div>

      {/* The Real Floating Bubble Widget */}
      <JewfrenBubbleWidget initialOpen={true} />
    </div>
  );
}
