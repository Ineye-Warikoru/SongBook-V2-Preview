"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 3000);
    const hideTimer = setTimeout(() => setVisible(false), 3600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`loading-screen ${fading ? "fade-out" : ""}`}>
      <Image src="/images/kasg-logo.png" alt="kasg.co.uk" width={280} height={120} className="loading-logo" priority />
      <p className="loading-caption">Broadfield Christian Fellowship</p>
    </div>
  );
}
