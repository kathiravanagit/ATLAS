import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import { AnimatePresence, MotionValue, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, useState, useCallback } from "react";

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: { title: string; icon: React.ReactNode; href: string; onClick?: () => void }[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop items={items} className={desktopClassName} />
      <FloatingDockMobile items={items} className={mobileClassName} />
    </>
  );
};

const FloatingDockMobile = ({
  items,
  className,
}: {
  items: { title: string; icon: React.ReactNode; href: string; onClick?: () => void }[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10, transition: { delay: idx * 0.05 } }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <button
                  onClick={() => { item.onClick?.(); setOpen(false); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] transition-colors"
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] transition-colors"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-[#e4e4e7]" />
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({
  items,
  className,
}: {
  items: { title: string; icon: React.ReactNode; href: string; onClick?: () => void }[];
  className?: string;
}) => {
  const mouseX = useMotionValue(Infinity);
  const rafRef = useRef(0);
  const pendingX = useRef(Infinity);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    pendingX.current = e.pageX;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        mouseX.set(pendingX.current);
        rafRef.current = 0;
      });
    }
  }, [mouseX]);

  const onMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    mouseX.set(Infinity);
  }, [mouseX]);

  return (
    <motion.div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn(
        "mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-[#18181b] px-4 pb-3 md:flex border border-[#27272a] will-change-transform",
        className
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
};

function IconContainer({
  mouseX,
  title,
  icon,
  onClick,
}: {
  mouseX: MotionValue;
  title: string;
  icon: React.ReactNode;
  href: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const boundsRef = useRef({ x: 0, width: 0 });
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    if (val === Infinity) return 300;
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      boundsRef.current = { x: r.x, width: r.width };
    }
    return val - boundsRef.current.x - boundsRef.current.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 72, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 72, 40]);
  const widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 36, 20]);
  const heightTransformIcon = useTransform(distance, [-150, 0, 150], [20, 36, 20]);

  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 250, damping: 18 });
  const height = useSpring(heightTransform, { mass: 0.1, stiffness: 250, damping: 18 });
  const widthIcon = useSpring(widthTransformIcon, { mass: 0.1, stiffness: 250, damping: 18 });
  const heightIcon = useSpring(heightTransformIcon, { mass: 0.1, stiffness: 250, damping: 18 });

  return (
    <button onClick={onClick} title={title}>
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex aspect-square items-center justify-center rounded-full bg-[#27272a] hover:bg-[#71717a] transition-colors will-change-transform"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: 0.12 }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border border-[#27272a] bg-[#18181b] px-2 py-0.5 text-sm whitespace-pre text-[#e4e4e7] pointer-events-none"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </button>
  );
}
