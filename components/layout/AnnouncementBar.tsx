"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface AnnouncementBarProps {
  messages: string[];
  intervalMs?: number;
}

export function AnnouncementBar({ messages, intervalMs = 5000 }: AnnouncementBarProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages.length, intervalMs]);

  if (messages.length === 0) return null;

  return (
    <div className="relative z-50 flex h-9 items-center justify-center overflow-hidden bg-luxe-black px-4 text-luxe-white">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[11px] tracking-[0.15em] uppercase"
        >
          {messages[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
