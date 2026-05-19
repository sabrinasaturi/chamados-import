import React from 'react';

export default function C2Logo({ className = "h-16" }: { className?: string }) {
  return (
    <img 
      src="/logo c2.png" 
      alt="C2 Capital Dois" 
      className={`object-contain ${className}`} 
    />
  );
}

