import { useEffect, useRef } from 'react';
import { lerp } from '../utils/helpers';

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let glowX = mouseX;
    let glowY = mouseY;
    let isMouseMoving = false;
    let rafId: number | null = null;

    glow.style.transform = `translate(${glowX}px, ${glowY}px)`;

    const animateGlow = () => {
      glowX = lerp(glowX, mouseX, 0.08);
      glowY = lerp(glowY, mouseY, 0.08);
      glow.style.transform = `translate(${glowX}px, ${glowY}px)`;

      if (Math.abs(mouseX - glowX) > 0.05 || Math.abs(mouseY - glowY) > 0.05) {
        rafId = requestAnimationFrame(animateGlow);
      } else {
        rafId = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isMouseMoving) {
        glow.style.opacity = '1';
        isMouseMoving = true;
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(animateGlow);
      }
    };

    const handleMouseOut = () => {
      glow.style.opacity = '0';
      isMouseMoving = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return <div ref={glowRef} className="cursor-glow" aria-hidden="true" />;
}
