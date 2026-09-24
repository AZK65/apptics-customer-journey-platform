"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem, fadeIn, fadeInUp } from "@/lib/motion";

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      {...fadeIn}
      transition={{ ...fadeIn.transition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeInUp({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

export function AnimatedBar({
  width,
  color,
  className,
}: {
  width: string;
  color: string;
  className?: string;
}) {
  return (
    <motion.span
      className={className}
      initial={{ width: 0 }}
      animate={{ width }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
      }}
      aria-hidden
    />
  );
}
