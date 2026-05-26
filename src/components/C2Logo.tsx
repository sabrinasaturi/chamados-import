import React from 'react';
import logoUrl from '../assets/images/regenerated_image_1779770998592.jpg';

export default function C2Logo({ className = "h-16" }: { className?: string }) {
  return (
    <img 
      src={logoUrl}
      alt="C2 Capital Dois" 
      className={`object-contain ${className}`} 
    />
  );
}

